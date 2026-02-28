import { isKlingPromptValidationError } from '@/lib/kling-prompt-budget';

export const getKlingPromptValidationResponse = (error: unknown): { error: string; status: 422 } | null => {
  if (!isKlingPromptValidationError(error)) {
    return null;
  }

  return {
    error: error.message,
    status: 422
  };
};
