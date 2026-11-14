/** Profile only the bounded list transformation, outside React's render logic.
 * No ranking/filter inference: visibility is only the existing withdrawn-saves rule. */
export function prepareCircularItems<T extends { id: string }>(
  first: T[],
  extra: T[],
  visible: (item: T) => boolean,
) {
  const started = performance.now();
  const rows = new Map<string, T>();
  for (const page of [first, extra])
    for (const item of page) if (visible(item)) rows.set(item.id, item);
  const items = Array.from(rows.values());
  return { items, transformMs: performance.now() - started };
}
