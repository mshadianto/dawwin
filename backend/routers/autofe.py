"""
─── DAWWIN ML Platform — Auto Feature Engineering Router ───

Automated feature creation with FULL audit trail.
Every transformation is logged — black-box manipulation is prohibited.

The pipeline returns:
  1. Transformed dataset (as JSON records)
  2. Structured Audit Report (JSON) detailing every action taken

Supports: imputation, encoding, collinearity pruning, automated
feature generation via Featuretools, and outlier flagging.
"""

import io
import time
import hashlib
from typing import Any

import numpy as np
import pandas as pd
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/autofe", tags=["Auto-FE"])


# ─── Response Models ───


class AuditEntry(BaseModel):
    """Single audit trail entry — one transformation step."""
    step: int
    action: str                  # e.g. "imputation", "encoding", "drop_column"
    column: str | None = None
    detail: str                  # human-readable description
    rows_affected: int = 0
    values_changed: int = 0
    before_snapshot: dict[str, Any] | None = None
    after_snapshot: dict[str, Any] | None = None
    timestamp_ms: int = 0


class AutoFEResult(BaseModel):
    """Complete Auto-FE pipeline result with audit trail."""
    success: bool
    dataset_shape: list[int]           # [rows, cols]
    columns_before: list[str]
    columns_after: list[str]
    columns_added: list[str]
    columns_removed: list[str]
    preview: list[dict[str, Any]]      # first 20 rows
    audit_trail: list[AuditEntry]      # every transformation logged
    data_hash: str                     # SHA-256 of output for integrity
    pipeline_duration_ms: int
    summary: str                       # human-readable summary


# ─── Pipeline Functions ───


def _audit(
    step: int,
    action: str,
    detail: str,
    column: str | None = None,
    rows_affected: int = 0,
    values_changed: int = 0,
    before_snapshot: dict | None = None,
    after_snapshot: dict | None = None,
) -> AuditEntry:
    """Create a single audit trail entry with timestamp."""
    return AuditEntry(
        step=step,
        action=action,
        column=column,
        detail=detail,
        rows_affected=rows_affected,
        values_changed=values_changed,
        before_snapshot=before_snapshot,
        after_snapshot=after_snapshot,
        timestamp_ms=int(time.time() * 1000),
    )


def _step_missing_analysis(df: pd.DataFrame, trail: list[AuditEntry], step: int) -> int:
    """Step 1: Analyze and impute missing values."""
    for col in df.columns:
        missing_count = int(df[col].isna().sum())
        if missing_count == 0:
            continue

        missing_pct = missing_count / len(df) * 100
        before = {"missing_count": missing_count, "missing_pct": round(missing_pct, 2)}

        # Strategy: drop column if >60% missing, else impute
        if missing_pct > 60:
            df.drop(columns=[col], inplace=True)
            trail.append(_audit(
                step=step,
                action="drop_column",
                column=col,
                detail=f"Dropped column '{col}': {missing_pct:.1f}% missing values "
                       f"({missing_count}/{len(df)} rows) exceeds 60% threshold",
                rows_affected=len(df),
                values_changed=missing_count,
                before_snapshot=before,
                after_snapshot={"status": "column_removed"},
            ))
        elif df[col].dtype in ("float64", "int64", "float32", "int32"):
            # Numeric: median imputation (robust to outliers)
            median_val = df[col].median()
            df[col].fillna(median_val, inplace=True)
            trail.append(_audit(
                step=step,
                action="imputation",
                column=col,
                detail=f"Imputed {missing_count} missing values in '{col}' "
                       f"with median={median_val:.4f}",
                rows_affected=len(df),
                values_changed=missing_count,
                before_snapshot=before,
                after_snapshot={"strategy": "median", "fill_value": round(float(median_val), 4)},
            ))
        else:
            # Categorical: mode imputation
            mode_val = df[col].mode()[0] if not df[col].mode().empty else "UNKNOWN"
            df[col].fillna(mode_val, inplace=True)
            trail.append(_audit(
                step=step,
                action="imputation",
                column=col,
                detail=f"Imputed {missing_count} missing values in '{col}' "
                       f"with mode='{mode_val}'",
                rows_affected=len(df),
                values_changed=missing_count,
                before_snapshot=before,
                after_snapshot={"strategy": "mode", "fill_value": str(mode_val)},
            ))
        step += 1

    return step


def _step_encoding(df: pd.DataFrame, trail: list[AuditEntry], step: int) -> int:
    """Step 2: Encode categorical variables with audit logging."""
    cat_cols = df.select_dtypes(include=["object", "category"]).columns.tolist()

    for col in cat_cols:
        n_unique = df[col].nunique()
        before = {"dtype": str(df[col].dtype), "n_unique": n_unique, "sample": df[col].head(3).tolist()}

        if n_unique == 2:
            # Binary: label encode (0/1)
            vals = df[col].unique()
            mapping = {vals[0]: 0, vals[1]: 1}
            df[col] = df[col].map(mapping).astype(int)
            trail.append(_audit(
                step=step,
                action="label_encoding",
                column=col,
                detail=f"Binary label-encoded '{col}': {vals[0]}→0, {vals[1]}→1",
                rows_affected=len(df),
                values_changed=len(df),
                before_snapshot=before,
                after_snapshot={"encoding": "label", "mapping": {str(k): v for k, v in mapping.items()}},
            ))
        elif n_unique <= 10:
            # Low cardinality: one-hot encode
            dummies = pd.get_dummies(df[col], prefix=col, dtype=int)
            new_cols = dummies.columns.tolist()
            df = pd.concat([df.drop(columns=[col]), dummies], axis=1)
            trail.append(_audit(
                step=step,
                action="one_hot_encoding",
                column=col,
                detail=f"One-hot encoded '{col}' ({n_unique} categories) → "
                       f"created {len(new_cols)} binary columns: {new_cols}",
                rows_affected=len(df),
                values_changed=len(df) * len(new_cols),
                before_snapshot=before,
                after_snapshot={"encoding": "one_hot", "new_columns": new_cols},
            ))
        else:
            # High cardinality: frequency encoding
            freq = df[col].value_counts(normalize=True)
            df[f"{col}_freq"] = df[col].map(freq).astype(float)
            df.drop(columns=[col], inplace=True)
            trail.append(_audit(
                step=step,
                action="frequency_encoding",
                column=col,
                detail=f"Frequency-encoded '{col}' ({n_unique} categories) → "
                       f"'{col}_freq' (normalized value counts)",
                rows_affected=len(df),
                values_changed=len(df),
                before_snapshot=before,
                after_snapshot={"encoding": "frequency", "new_column": f"{col}_freq"},
            ))
        step += 1

    return step, df  # df may have changed shape from one-hot


def _step_collinearity(
    df: pd.DataFrame, trail: list[AuditEntry], step: int, threshold: float = 0.95
) -> int:
    """Step 3: Remove highly correlated features (collinearity pruning)."""
    numeric_df = df.select_dtypes(include=[np.number])
    if numeric_df.shape[1] < 2:
        return step

    corr_matrix = numeric_df.corr().abs()
    upper = corr_matrix.where(np.triu(np.ones(corr_matrix.shape), k=1).astype(bool))
    to_drop = []

    for col in upper.columns:
        correlated_with = upper.index[upper[col] > threshold].tolist()
        if correlated_with:
            to_drop.append(col)
            trail.append(_audit(
                step=step,
                action="drop_collinear",
                column=col,
                detail=f"Dropped '{col}' due to collinearity (r>{threshold:.2f}) "
                       f"with: {correlated_with}",
                rows_affected=len(df),
                values_changed=len(df),
                before_snapshot={"correlated_with": correlated_with,
                                 "correlation": [round(float(upper[col][c]), 4) for c in correlated_with]},
                after_snapshot={"status": "column_removed"},
            ))
            step += 1

    if to_drop:
        df.drop(columns=to_drop, inplace=True, errors="ignore")

    return step


def _step_outlier_flag(df: pd.DataFrame, trail: list[AuditEntry], step: int) -> int:
    """Step 4: Flag outliers using IQR method (non-destructive)."""
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()

    for col in numeric_cols:
        q1 = df[col].quantile(0.25)
        q3 = df[col].quantile(0.75)
        iqr = q3 - q1

        if iqr == 0:
            continue

        lower = q1 - 1.5 * iqr
        upper = q3 + 1.5 * iqr
        outlier_mask = (df[col] < lower) | (df[col] > upper)
        n_outliers = int(outlier_mask.sum())

        if n_outliers > 0:
            flag_col = f"{col}_outlier"
            df[flag_col] = outlier_mask.astype(int)
            trail.append(_audit(
                step=step,
                action="outlier_flag",
                column=col,
                detail=f"Flagged {n_outliers} outliers in '{col}' "
                       f"(IQR method: values outside [{lower:.2f}, {upper:.2f}]) → "
                       f"created binary flag '{flag_col}'",
                rows_affected=n_outliers,
                values_changed=n_outliers,
                before_snapshot={"Q1": round(float(q1), 4), "Q3": round(float(q3), 4),
                                 "IQR": round(float(iqr), 4)},
                after_snapshot={"flag_column": flag_col, "n_outliers": n_outliers,
                                "bounds": [round(float(lower), 4), round(float(upper), 4)]},
            ))
            step += 1

    return step


def _step_auto_features(df: pd.DataFrame, trail: list[AuditEntry], step: int) -> int:
    """Step 5: Generate interaction features for numeric columns."""
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    # Filter out flag columns to avoid noise
    base_cols = [c for c in numeric_cols if not c.endswith("_outlier") and not c.endswith("_freq")]

    if len(base_cols) < 2:
        return step

    # Limit to top 5 columns by variance to avoid combinatorial explosion
    variances = df[base_cols].var().sort_values(ascending=False)
    top_cols = variances.head(5).index.tolist()

    generated = []
    for i, col_a in enumerate(top_cols):
        for col_b in top_cols[i + 1:]:
            # Ratio feature (with safe division)
            ratio_col = f"{col_a}_div_{col_b}"
            df[ratio_col] = df[col_a] / df[col_b].replace(0, np.nan)
            df[ratio_col].fillna(0, inplace=True)
            generated.append(ratio_col)

            # Product feature
            product_col = f"{col_a}_x_{col_b}"
            df[product_col] = df[col_a] * df[col_b]
            generated.append(product_col)

    if generated:
        trail.append(_audit(
            step=step,
            action="auto_feature_generation",
            column=None,
            detail=f"Generated {len(generated)} interaction features from top-{len(top_cols)} "
                   f"numeric columns by variance: {top_cols}. "
                   f"New features: {generated}",
            rows_affected=len(df),
            values_changed=len(df) * len(generated),
            before_snapshot={"source_columns": top_cols, "method": "pairwise_ratio_and_product"},
            after_snapshot={"generated_columns": generated, "total_new": len(generated)},
        ))
        step += 1

    return step


# ─── Main Pipeline ───


def run_auto_fe_pipeline(
    df: pd.DataFrame,
    target_col: str | None = None,
    enable_outlier_flags: bool = True,
    enable_auto_features: bool = True,
    collinearity_threshold: float = 0.95,
) -> AutoFEResult:
    """
    Execute the full Auto-FE pipeline with comprehensive audit trail.

    Steps:
      1. Missing value analysis & imputation
      2. Categorical encoding (binary/one-hot/frequency)
      3. Collinearity pruning
      4. Outlier flagging (IQR method)
      5. Automated feature generation (interactions)

    Returns transformed data + structured audit report.
    """
    start_time = time.time()
    trail: list[AuditEntry] = []
    columns_before = df.columns.tolist()
    step = 1

    # Exclude target from transformations
    target_series = None
    if target_col and target_col in df.columns:
        target_series = df[target_col].copy()
        df = df.drop(columns=[target_col])

    # Step 1: Missing values
    step = _step_missing_analysis(df, trail, step)

    # Step 2: Encoding
    step, df = _step_encoding(df, trail, step)

    # Step 3: Collinearity
    step = _step_collinearity(df, trail, step, threshold=collinearity_threshold)

    # Step 4: Outlier flags
    if enable_outlier_flags:
        step = _step_outlier_flag(df, trail, step)

    # Step 5: Auto features
    if enable_auto_features:
        step = _step_auto_features(df, trail, step)

    # Reattach target
    if target_series is not None:
        df[target_col] = target_series.values

    columns_after = df.columns.tolist()
    added = [c for c in columns_after if c not in columns_before]
    removed = [c for c in columns_before if c not in columns_after]

    # Data integrity hash
    data_bytes = df.to_csv(index=False).encode("utf-8")
    data_hash = hashlib.sha256(data_bytes).hexdigest()[:16]

    duration_ms = int((time.time() - start_time) * 1000)

    # Summary
    n_actions = len(trail)
    summary_parts = []
    if any(t.action == "imputation" for t in trail):
        n_imp = sum(1 for t in trail if t.action == "imputation")
        summary_parts.append(f"{n_imp} imputation(s)")
    if any(t.action in ("label_encoding", "one_hot_encoding", "frequency_encoding") for t in trail):
        n_enc = sum(1 for t in trail if "encoding" in t.action)
        summary_parts.append(f"{n_enc} encoding(s)")
    if any(t.action == "drop_collinear" for t in trail):
        n_drop = sum(1 for t in trail if t.action == "drop_collinear")
        summary_parts.append(f"{n_drop} collinear column(s) removed")
    if any(t.action == "outlier_flag" for t in trail):
        n_out = sum(1 for t in trail if t.action == "outlier_flag")
        summary_parts.append(f"{n_out} outlier flag(s)")
    if any(t.action == "auto_feature_generation" for t in trail):
        summary_parts.append(f"{len(added)} auto-generated features")

    summary = (
        f"Pipeline completed in {duration_ms}ms with {n_actions} transformation(s): "
        + ", ".join(summary_parts) + ". "
        + f"Shape: {columns_before.__len__()} cols → {len(columns_after)} cols."
        if summary_parts
        else f"Pipeline completed in {duration_ms}ms — no transformations needed."
    )

    return AutoFEResult(
        success=True,
        dataset_shape=[len(df), len(df.columns)],
        columns_before=columns_before,
        columns_after=columns_after,
        columns_added=added,
        columns_removed=removed,
        preview=df.head(20).replace({np.nan: None}).to_dict(orient="records"),
        audit_trail=trail,
        data_hash=data_hash,
        pipeline_duration_ms=duration_ms,
        summary=summary,
    )


# ─── Endpoint ───


@router.post("/run", response_model=AutoFEResult)
async def run_autofe(
    file: UploadFile = File(...),
    target_col: str = Form(default=""),
    enable_outlier_flags: bool = Form(default=True),
    enable_auto_features: bool = Form(default=True),
    collinearity_threshold: float = Form(default=0.95),
):
    """
    Upload a CSV and run the full Auto-FE pipeline.
    Returns transformed data preview + structured audit trail.
    """
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")

    try:
        content = await file.read()
        df = pd.read_csv(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV: {str(e)}")

    if df.empty:
        raise HTTPException(status_code=400, detail="Dataset is empty")

    target = target_col if target_col and target_col in df.columns else None

    result = run_auto_fe_pipeline(
        df=df,
        target_col=target,
        enable_outlier_flags=enable_outlier_flags,
        enable_auto_features=enable_auto_features,
        collinearity_threshold=collinearity_threshold,
    )

    return result
