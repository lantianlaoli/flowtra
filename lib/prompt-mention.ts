export type ActiveMentionQuery = {
  start: number;
  query: string;
};

const isWordChar = (char: string) => /[A-Za-z0-9_-]/.test(char);

const isValidMentionStart = (text: string, index: number) => {
  if (index === 0) return true;
  return /\s/.test(text[index - 1]);
};

export const getActiveMentionQuery = (text: string, caret: number): ActiveMentionQuery | null => {
  if (caret < 0 || caret > text.length) return null;
  const textBefore = text.slice(0, caret);
  const atIndex = textBefore.lastIndexOf('@');
  if (atIndex === -1 || !isValidMentionStart(textBefore, atIndex)) return null;

  const afterAt = textBefore.slice(atIndex + 1);
  if (!afterAt) {
    return { start: atIndex, query: '' };
  }

  for (let i = 0; i < afterAt.length; i += 1) {
    const char = afterAt[i];
    if (!isWordChar(char)) {
      return null;
    }
  }

  return { start: atIndex, query: afterAt };
};
