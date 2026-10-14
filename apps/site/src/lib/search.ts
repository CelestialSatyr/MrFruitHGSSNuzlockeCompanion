export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[-_/]+/g, " ")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function searchTerms(query: string): string[] {
  return normalizeSearchText(query).split(" ").filter(Boolean);
}

export function matchesSearch(value: string, query: string): boolean {
  const normalizedValue = normalizeSearchText(value);
  const terms = searchTerms(query);
  return terms.length > 0 && terms.every((term) => normalizedValue.includes(term));
}

export function searchMatchScore(label: string, searchText: string, query: string): number {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return -1;

  const normalizedLabel = normalizeSearchText(label);
  const normalizedSearchText = normalizeSearchText(searchText);
  const terms = searchTerms(query);
  if (!terms.every((term) => normalizedSearchText.includes(term))) return -1;

  if (normalizedLabel === normalizedQuery) return 120;
  if (normalizedLabel.startsWith(normalizedQuery)) return 100;
  if (normalizedLabel.includes(normalizedQuery)) return 85;

  const firstIndex = normalizedSearchText.indexOf(normalizedQuery);
  if (firstIndex >= 0) return 70 - Math.min(firstIndex, 20);

  return (
    45 +
    terms.reduce((score, term) => {
      const index = normalizedSearchText.indexOf(term);
      return score + (index >= 0 ? Math.max(0, 8 - Math.min(index, 8)) : 0);
    }, 0)
  );
}
