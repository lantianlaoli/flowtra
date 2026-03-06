export type CloneSelectionItem = {
  id: string;
  name: string;
  photoUrl?: string | null;
  brandName?: string | null;
};

type CloneSelectionStateLike<T extends CloneSelectionItem> = {
  selectedItems?: T[] | null;
  selectedItem?: T | null;
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

const hasOwn = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);

export const hasExplicitCloneAvatarSelectionState = (
  draft: { selectedAvatars?: unknown; selectedAvatar?: unknown } | null | undefined
) => Boolean(draft && (hasOwn(draft, 'selectedAvatars') || hasOwn(draft, 'selectedAvatar')));

export const hasExplicitCloneProductSelectionState = (
  draft: { selectedProducts?: unknown; selectedProduct?: unknown } | null | undefined
) => Boolean(draft && (hasOwn(draft, 'selectedProducts') || hasOwn(draft, 'selectedProduct')));

export const resolveCloneSelection = <T extends CloneSelectionItem>(
  input: CloneSelectionStateLike<T> & {
    fallbackSelection?: T | null;
    allowFallback?: boolean;
    limit?: number;
  }
) => {
  const selections = normalizeCloneSelections(input.selectedItems, input.selectedItem);
  const useFallback = Boolean(input.allowFallback && selections.length === 0 && input.fallbackSelection);
  const primarySelection = getPrimaryCloneSelection(selections) ?? (useFallback ? input.fallbackSelection ?? null : null);
  const selectedIds = normalizeSelectedIds(
    useFallback ? input.fallbackSelection?.id : undefined,
    selections.map((item) => item.id),
    input.limit
  );

  return {
    selections,
    primarySelection,
    selectedIds
  };
};
