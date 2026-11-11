/** Compact six-point arc. At narrow widths it grows vertically to keep the
 * entire labelled hit rectangles separate, including larger text settings. */
export function radialLayout(viewportWidth: number, fontScale = 1) {
  const width = Math.min(440, Math.max(280, viewportWidth - 24));
  const nodeWidth = 82;
  const nodeHeight = Math.ceil(58 + 30 * Math.min(Math.max(fontScale, 1), 1.3));
  const step = nodeHeight + 10;
  const spread = width / 2 - nodeWidth / 2;
  const inner = 46;
  const middle = 8 + (spread - inner >= nodeWidth + 8 ? 48 : step);
  const lower = middle + step;
  const positions = [
    [-spread, middle], [spread, middle], [-inner, 8], [inner, 8],
    [-spread * 0.72, lower], [spread * 0.72, lower],
  ];
  return { width, height: lower + nodeHeight, nodeWidth, nodeHeight, points: positions.map(([x, top]) => ({ left: width / 2 + x - nodeWidth / 2, top })) };
}
