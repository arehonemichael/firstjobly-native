/** Seven complete labels need at least 80dp apiece. Narrow screens use one
 * consistent icon-only bar, while accessibility labels always stay complete. */
export function tabPresentation(width: number) {
  return { showLabels: width >= 7 * 80, iconSize: 24, labelSize: 11 };
}
export function categoryPresentation(availableWidth: number, fontScale = 1) {
  const columns = availableWidth < 300 || fontScale > 1.3 ? 1 : 2;
  return {
    columns,
    gap: 12,
    width: (availableWidth - (columns - 1) * 12) / columns,
    labelHeight: 40 * Math.max(1, fontScale),
  };
}
