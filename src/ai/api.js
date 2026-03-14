export async function callAnthropicAPI(prompt) {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || "/api/anthropic";
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY || "";

  const headers = { "Content-Type": "application/json" };
  if (apiKey) {
    headers["x-api-key"] = apiKey;
    headers["anthropic-version"] = "2023-06-01";
  }

  const response = await fetch(`${baseUrl}/v1/messages`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => "");
    throw new Error(`API ${response.status}: ${err.slice(0, 200)}`);
  }

  const data = await response.json();
  return (data.content || [])
    .map(b => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();
}
