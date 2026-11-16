export function safeUpperCase(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).toUpperCase();
}
