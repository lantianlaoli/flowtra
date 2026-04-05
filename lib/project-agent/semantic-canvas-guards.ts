export const safelyResolveSemanticCanvasStep = async <T>(input: {
  step: string;
  latestUserTurn: string;
  workflow?: string | null;
  fn: () => Promise<T>;
}): Promise<T | null> => {
  try {
    return await input.fn();
  } catch (error) {
    console.error('[Project Agent] Semantic canvas planning failed:', {
      step: input.step,
      latestUserTurn: input.latestUserTurn,
      workflow: input.workflow ?? null,
      error,
    });
    return null;
  }
};
