export type ClonePlanStatus = 'collecting' | 'planned' | 'awaiting_confirmation' | 'confirmed';

export type CloneSceneAssignment = {
  sceneIndex: number;
  avatarId?: string | null;
  productId: string;
  source: 'auto' | 'user_override';
};

const PRODUCT_ONLY_PATTERNS = [
  /\bonly\b[\s\w-]{0,24}\b(product|products)\b/i,
  /\bjust\b[\s\w-]{0,24}\b(product|products)\b/i,
  /只换产品|仅换产品|只替换产品|仅替换产品/
];

const AVATAR_INTENT_PATTERNS = [
  /\bavatar\b/i,
  /\bperson\b/i,
  /\bcharacter\b/i,
  /\bpeople\b/i,
  /\bman\b/i,
  /\bwoman\b/i,
  /\bfemale\b/i,
  /\bmale\b/i,
  /人物|角色|模特|人像/
];

export const isProductOnlyIntent = (text: string) => {
  const normalized = text.trim();
  if (!normalized) return false;
  return PRODUCT_ONLY_PATTERNS.some((pattern) => pattern.test(normalized));
};

export const hasExplicitAvatarIntent = (text: string) => {
  const normalized = text.trim();
  if (!normalized) return false;
  return AVATAR_INTENT_PATTERNS.some((pattern) => pattern.test(normalized));
};

const SELECTION_CONTINUE_PATTERNS = [
  /\bi have made (a )?choice\b/i,
  /\bi made (a )?choice\b/i,
  /\bi selected\b/i,
  /\bi already selected\b/i,
  /\bi have chosen\b/i,
  /\bi chose\b/i,
  /\bcontinue\b/i,
  /\bnext step\b/i,
  /\bproceed\b/i,
  /\bdone\b/i,
  /我选好了|我已经选了|继续|下一步|好了/
];

export const isSelectionContinueIntent = (text: string) => {
  const normalized = text.trim();
  if (!normalized) return false;
  return SELECTION_CONTINUE_PATTERNS.some((pattern) => pattern.test(normalized));
};

export const normalizeSceneAssignments = (
  assignments: Array<CloneSceneAssignment | null | undefined> | null | undefined,
  maxScenes = 8
): CloneSceneAssignment[] => {
  if (!Array.isArray(assignments)) return [];
  const seen = new Set<number>();

  return assignments
    .filter((assignment): assignment is CloneSceneAssignment => Boolean(assignment && Number.isFinite(assignment.sceneIndex) && assignment.sceneIndex >= 1 && typeof assignment.productId === 'string' && assignment.productId.trim().length > 0))
    .sort((a, b) => a.sceneIndex - b.sceneIndex)
    .reduce<CloneSceneAssignment[]>((acc, assignment) => {
      if (assignment.sceneIndex > maxScenes) return acc;
      if (seen.has(assignment.sceneIndex)) return acc;
      seen.add(assignment.sceneIndex);
      acc.push({
        sceneIndex: assignment.sceneIndex,
        avatarId: assignment.avatarId?.trim() || null,
        productId: assignment.productId.trim(),
        source: assignment.source === 'user_override' ? 'user_override' : 'auto'
      });
      return acc;
    }, []);
};

export const buildCartesianSceneAssignments = (input: {
  sceneCount: number;
  avatarIds: string[];
  productIds: string[];
  existingAssignments?: CloneSceneAssignment[];
  maxScenes?: number;
}): CloneSceneAssignment[] => {
  const sceneCount = Math.max(0, Math.floor(input.sceneCount || 0));
  const maxScenes = Math.max(1, Math.floor(input.maxScenes || 8));
  const totalScenes = Math.min(sceneCount, maxScenes);
  if (totalScenes === 0) return [];

  const avatarIds = Array.from(new Set((input.avatarIds || []).map((id) => id.trim()).filter(Boolean)));
  const productIds = Array.from(new Set((input.productIds || []).map((id) => id.trim()).filter(Boolean)));
  if (productIds.length === 0) return [];

  const existingByScene = new Map(
    normalizeSceneAssignments(input.existingAssignments, maxScenes)
      .map((assignment) => [assignment.sceneIndex, assignment] as const)
  );

  const pairs: Array<{ avatarId?: string | null; productId: string }> = [];
  if (avatarIds.length === 0) {
    for (const productId of productIds) {
      pairs.push({ avatarId: null, productId });
    }
  } else {
    for (const avatarId of avatarIds) {
      for (const productId of productIds) {
        pairs.push({ avatarId, productId });
      }
    }
  }

  const validPairSet = new Set(pairs.map((pair) => `${pair.avatarId || ''}::${pair.productId}`));

  const output: CloneSceneAssignment[] = [];
  for (let index = 0; index < totalScenes; index += 1) {
    const sceneIndex = index + 1;
    const existing = existingByScene.get(sceneIndex);
    if (existing?.source === 'user_override') {
      const key = `${existing.avatarId || ''}::${existing.productId}`;
      if (validPairSet.has(key)) {
        output.push(existing);
        continue;
      }
    }

    const pair = pairs[index % pairs.length];
    output.push({
      sceneIndex,
      avatarId: pair.avatarId || null,
      productId: pair.productId,
      source: 'auto'
    });
  }

  return output;
};
