/**
 * Alphabetical order for list tables: case- and accent-insensitive, with
 * numbers compared by value ("Shop 2" before "Shop 10").
 */
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

/** Returns a new array sorted A→Z by `key`; ties keep their original order. */
export function sortAlphabetically<T>(items: readonly T[], key: (item: T) => string): T[] {
  return [...items].sort((a, b) => collator.compare(key(a).trim(), key(b).trim()));
}
