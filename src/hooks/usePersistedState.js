import { useState, useEffect } from "react";

export function usePersistedState(key, defaultValue) {
  const [data, setData] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored) return { ...defaultValue, ...JSON.parse(stored) };
    } catch { /* first load or corrupt data */ }
    return defaultValue;
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSaving(true);
      try {
        localStorage.setItem(key, JSON.stringify(data));
      } catch (e) {
        console.error("Failed to save:", e);
      }
      setTimeout(() => setSaving(false), 800);
    }, 1000);
    return () => clearTimeout(timer);
  }, [data, key]);

  return { data, setData, saving };
}
