const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://wgbtsdrgjlmakjoxvvbv.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndnYnRzZHJnamxtYWtqb3h2dmJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0NjI1MTUsImV4cCI6MjA4OTAzODUxNX0.5sAVIDHPN8HeRRzXfhCa7V5nQ7uIL1ZmnwwwwobY8PI";

export async function callAI(prompt) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/ai-proxy`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      prompt,
      model: "llama-3.3-70b-versatile",
      max_tokens: 1000,
    }),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => "");
    throw new Error(`API ${response.status}: ${err.slice(0, 200)}`);
  }

  const data = await response.json();
  if (data.error) throw new Error(data.error);
  return (data.text || "").trim();
}
