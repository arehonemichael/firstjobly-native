/** Keep accessible brand type large while budgeting the complete 10-letter run,
 * not separate flex children. 6px reserves the final glyph's ink and padding. */
export function brandWordmarkSize(availableWidth: number, fontScale = 1) {
  return Math.min(22, (Math.max(120, availableWidth) - 6) / (6.4 * Math.max(1, fontScale)));
}
