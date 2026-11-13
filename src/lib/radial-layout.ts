/** Retain the arc with complete single-line labels. When system text cannot
 * fit, switch every control to an accessible icon rather than cutting words. */
export function radialLayout(viewportWidth: number, fontScale = 1) {
  const width = Math.min(440, Math.max(0, viewportWidth - 24));
  const scale = Math.max(1, fontScale);
  const nodeWidth = Math.min(132, (width - 16) / 2);
  const iconOnly = 13 * 8 * scale + 16 > nodeWidth;
  const nodeHeight = iconOnly ? 64 : Math.ceil(48 + 8 + 20 * scale + 8 + 2);
  const step = nodeHeight + 12;
  const spread = width / 2 - nodeWidth / 2;
  const inner = (nodeWidth + 12) / 2;
  const middle = 8 + (spread - inner >= nodeWidth + 12 ? 48 : step);
  const lower = middle + step;
  const positions = [
    [-spread, middle],
    [spread, middle],
    [-inner, 8],
    [inner, 8],
    [-inner, lower],
    [inner, lower],
  ];
  return {
    width,
    height: lower + nodeHeight,
    nodeWidth,
    nodeHeight,
    iconOnly,
    points: positions.map(([x, top]) => ({
      left: width / 2 + x - nodeWidth / 2,
      top,
    })),
  };
}
