/** Five tabs leave 72dp per item at 360dp, with complete labels. */
export function tabPresentation(_width: number) {
  return { showLabels: true, iconSize: 24, labelSize: 11 };
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
