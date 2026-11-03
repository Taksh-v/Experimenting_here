/** SDK upload errors can be plain JSON, including FastAPI validation arrays.
 * Read only error fields: never echo request bodies, headers, or input values.
 */
export function providerErrorMessage(error: unknown): string {
  const seen = new Set<object>();
  function read(value: unknown, depth = 0): string {
    if (depth > 5 || value == null) return "";
    if (typeof value === "string") return value;
    if (typeof value !== "object" || seen.has(value)) return "";
    seen.add(value);
    if (Array.isArray(value)) return value.map((item) => read(item, depth + 1)).filter(Boolean).join("; ");
    const record = value as Record<string, unknown>;
    const message = ["detail", "message", "msg", "error", "errors"]
      .map((key) => read(record[key], depth + 1)).find(Boolean);
    const location = Array.isArray(record.loc)
      ? record.loc.filter((part) => typeof part === "string" || typeof part === "number").join(".")
      : "";
    return message ? (location ? location + ": " + message : message) : "";
  }
  let message = read(error) || "LlamaParse returned an unrecognized error response.";
  for (const key of [process.env.LLAMA_CLOUD_API_KEY, process.env.LLAMAPARSE_API_KEY, process.env.GROQ_API_KEY]) {
    if (key?.trim()) message = message.split(key.trim()).join("[redacted]");
  }
  return message.replace(/\b(?:llx|gsk)_[A-Za-z0-9_-]+/g, "[redacted]").slice(0, 1500);
}
