import type { UIMessage } from '@ai-sdk/react';

type MessagePartLike = {
  type?: string;
  text?: unknown;
};

export type ProjectAgentParsedMessage = {
  visibleText: string;
  reasoningText: string;
};

const toPartText = (value: unknown) => (typeof value === 'string' ? value : '');

export const parseProjectAgentMessageParts = (message: UIMessage): ProjectAgentParsedMessage => {
  if (!Array.isArray(message.parts)) {
    return {
      visibleText: '',
      reasoningText: '',
    };
  }

  const visible: string[] = [];
  const reasoning: string[] = [];

  for (const part of message.parts as MessagePartLike[]) {
    const text = toPartText(part?.text);
    if (!text) continue;

    if (part?.type === 'reasoning') {
      reasoning.push(text);
      continue;
    }

    if (part?.type === 'text' || part?.type == null) {
      visible.push(text);
    }
  }

  // If no native reasoning parts, extract <thinking>...</thinking> tags from text
  if (reasoning.length === 0) {
    const combinedVisible = visible.join('');
    const thinkingMatch = combinedVisible.match(/^<thinking>([\s\S]*?)<\/thinking>\s*/);
    if (thinkingMatch) {
      return {
        visibleText: combinedVisible.slice(thinkingMatch[0].length),
        reasoningText: thinkingMatch[1].trim(),
      };
    }
  }

  return {
    visibleText: visible.join(''),
    reasoningText: reasoning.join(''),
  };
};

export const getProjectAgentVisibleMessageText = (message: UIMessage) =>
  parseProjectAgentMessageParts(message).visibleText;
