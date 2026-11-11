/** A tall elliptical arc keeps all six labelled controls apart at 320px.
 * Coordinates describe full hit rectangles, not only the circular icons. */
export function radialLayout(viewportWidth: number, fontScale = 1) {
  const width = Math.min(440, Math.max(280, viewportWidth - 24));
  const nodeWidth = 88;
  const nodeHeight = Math.ceil(64 + 34 * Math.min(Math.max(fontScale, 1), 1.3));
  const step = nodeHeight + 10;
  const spread = width / 2 - nodeWidth / 2;
  const inner = Math.max(48, spread * 0.4);
  const centers = [-spread, -spread * 0.8, -inner, inner, spread * 0.8, spread];
  const tops = [8 + 2 * step, 8 + step, 8, 8, 8 + step, 8 + 2 * step];
  return { width, height: 8 + 2 * step + nodeHeight, nodeWidth, nodeHeight, points: centers.map((x, index) => ({ left: width / 2 + x - nodeWidth / 2, top: tops[index] })) };
}
