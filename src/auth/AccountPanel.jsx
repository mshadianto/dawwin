import { useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "./AuthContext";

const mono = { fontFamily: "'JetBrains Mono', monospace", letterSpacing: 0.5 };
const inputStyle = {
  width: "100%", boxSizing: "border-box", padding: "9px 10px", borderRadius: 3,
  border: "1px solid #CBD5E1", fontSize: 13, fontFamily: "'DM Sans', sans-serif", marginTop: 4,
};

function LoginDialog({ onClose }) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await signIn(email, password);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  // Portal ke body: sidebar ber-`position: sticky` membuat stacking context sendiri.
  return createPortal(
    <div role="dialog" aria-modal="true" aria-labelledby="login-title" onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <form onSubmit={submit} onClick={e => e.stopPropagation()} style={{
        background: "#fff", borderRadius: 4, padding: 28, width: 340, color: "#0F172A",
        borderTop: "3px solid #C9A84C", fontFamily: "'DM Sans', sans-serif",
      }}>
        <h2 id="login-title" style={{ margin: "0 0 4px", fontFamily: "'Source Serif 4', serif", fontSize: 20 }}>Masuk ke DAWWIN</h2>
        <p style={{ margin: "0 0 18px", fontSize: 12, color: "#64748B" }}>
          Gunakan akun yang diundang oleh administrator organisasi Anda.
        </p>
        <label style={{ fontSize: 11, fontWeight: 600, color: "#475569", display: "block", marginBottom: 12 }}>
          Email
          <input type="email" required autoFocus autoComplete="username" value={email}
            onChange={e => setEmail(e.target.value)} style={inputStyle} />
        </label>
        <label style={{ fontSize: 11, fontWeight: 600, color: "#475569", display: "block", marginBottom: 12 }}>
          Kata sandi
          <input type="password" required autoComplete="current-password" value={password}
            onChange={e => setPassword(e.target.value)} style={inputStyle} />
        </label>
        {error && <div role="alert" style={{ fontSize: 12, color: "#DC2626", marginBottom: 12 }}>{error}</div>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" onClick={onClose} style={{
            background: "transparent", border: "1px solid #CBD5E1", borderRadius: 3, padding: "8px 14px",
            fontSize: 12, cursor: "pointer", color: "#475569",
          }}>Batal</button>
          <button type="submit" disabled={busy} style={{
            background: "#0F172A", border: "none", borderRadius: 3, padding: "8px 18px",
            fontSize: 12, fontWeight: 700, cursor: busy ? "wait" : "pointer", color: "#fff",
          }}>{busy ? "Memeriksa..." : "Masuk"}</button>
        </div>
      </form>
    </div>,
    document.body
  );
}

/** Blok akun di kaki sidebar: status mode, tombol Masuk / Keluar. */
export default function AccountPanel() {
  const { status, user, tenant, role, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const button = {
    background: "#1E293B", border: "1px solid #334155", borderRadius: 3, padding: "6px 10px",
    color: "#CBD5E1", fontSize: 10, cursor: "pointer", fontWeight: 600, ...mono,
  };

  return (
    <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid #1E293B" }}>
      {status === "tenant" ? (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#F8FAFC", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {tenant.name}
          </div>
          <div style={{ fontSize: 10, color: "#64748B", marginBottom: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {user.email} · {role}
          </div>
          <button onClick={signOut} style={button}>KELUAR</button>
        </>
      ) : (
        <>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#C9A84C", marginBottom: 4, ...mono }}>
            {status === "no_tenant" ? "BELUM ADA ORGANISASI" : "MODE DEMO"}
          </div>
          <div style={{ fontSize: 10, color: "#64748B", marginBottom: 8, lineHeight: 1.4 }}>
            {status === "no_tenant"
              ? "Akun Anda belum terhubung ke organisasi. Hubungi administrator."
              : "Data contoh, tersimpan hanya di browser ini."}
          </div>
          {status === "no_tenant"
            ? <button onClick={signOut} style={button}>KELUAR</button>
            : <button onClick={() => setOpen(true)} style={{ ...button, background: "#C9A84C", borderColor: "#C9A84C", color: "#0F172A" }}>MASUK</button>}
        </>
      )}
      {open && <LoginDialog onClose={() => setOpen(false)} />}
    </div>
  );
}
