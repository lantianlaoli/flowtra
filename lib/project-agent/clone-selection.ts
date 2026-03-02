export type CloneSelectionItem = {
  id: string;
  name: string;
  photoUrl?: string | null;
  brandName?: string | null;
};

const isCloneSelectionItem = <T extends CloneSelectionItem>(value: T | null | undefined): value is T => (
  Boolean(value?.id?.trim())
);

export const dedupeCloneSelections = <T extends CloneSelectionItem>(items: Array<T | null | undefined>) => {
  const seen = new Set<string>();
  return items.filter((item): item is T => {
    if (!isCloneSelectionItem(item)) return false;
    const normalizedId = item.id.trim();
    if (seen.has(normalizedId)) return false;
    seen.add(normalizedId);
    return true;
  });
};

export const normalizeCloneSelections = <T extends CloneSelectionItem>(
  selections?: T[] | null,
  legacySelection?: T | null
) => {
  const nextSelections = Array.isArray(selections) ? selections : [];
  return dedupeCloneSelections([
    ...nextSelections,
    legacySelection ?? undefined
  ]);
};

export const getPrimaryCloneSelection = <T extends CloneSelectionItem>(
  selections?: T[] | null,
  legacySelection?: T | null
) => normalizeCloneSelections(selections, legacySelection)[0] ?? null;

export const normalizeSelectedIds = (
  primaryId?: string | null,
  selectedIds?: string[] | null,
  limit = 8
) => {
  const seen = new Set<string>();
  const normalized = [
    ...(primaryId ? [primaryId] : []),
    ...(Array.isArray(selectedIds) ? selectedIds : [])
  ].reduce<string[]>((acc, value) => {
    const trimmed = typeof value === 'string' ? value.trim() : '';
    if (!trimmed || seen.has(trimmed)) return acc;
    seen.add(trimmed);
    acc.push(trimmed);
    return acc;
  }, []);

  return normalized.slice(0, limit);
};
