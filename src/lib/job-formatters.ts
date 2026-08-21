export function formatCategoryLabel(value?: string | null) {
  const normalized = String(value ?? "")
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

  if (!normalized) return "";

  return normalized
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}
