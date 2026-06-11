export function extractPlainTextFromRichText(value: string) {
  if (!value.trim()) {
    return "";
  }

  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
