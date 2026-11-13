/** Keep the six-point arc, reserving complete multiline label rectangles.
 * Large text grows the scrollable arc vertically rather than reducing type. */
export function radialLayout(viewportWidth: number, fontScale = 1) {
  const width = Math.min(440, Math.max(0, viewportWidth - 24));
  const scale = Math.max(1, fontScale);
  const nodeWidth = Math.min(132, (width - 16) / 2);
  // Longest destination is 13 characters. Budget generously for font metrics,
  // two-sided label padding and arbitrary system text scaling.
  const lines = Math.ceil((13 * 8 * scale) / Math.max(1, nodeWidth - 16));
  const nodeHeight = Math.ceil(48 + 8 + lines * 20 * scale + 8);
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
    points: positions.map(([x, top]) => ({
      left: width / 2 + x - nodeWidth / 2,
      top,
    })),
  };
}
