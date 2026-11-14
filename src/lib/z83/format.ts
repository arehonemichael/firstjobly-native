/** Z83 requires block capitals. Keep enum keys and signature image bytes intact. */
export function z83Name(value: string): string {
  return value.replace(/,/g, " ").replace(/\s+/g, " ").trim().toUpperCase();
}
export function z83Text(value: string): string {
  return value.toUpperCase();
}
