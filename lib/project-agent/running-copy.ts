export const PROJECT_AGENT_RUNNING_MESSAGES = [
  'Running',
  'Grab a coffee ☕',
  'Brewing ideas ☕',
  'Hang tight ✨',
  'Pixels at work 🎬',
  'Cooking the cut 🔥',
  'Polishing output ✨',
  'Almost there',
  'Rendering magic 🪄',
  'Worth the wait',
] as const;

export function getNextProjectAgentRunningMessage(
  current: string,
  random: () => number = Math.random,
) {
  if (PROJECT_AGENT_RUNNING_MESSAGES.length <= 1) {
    return PROJECT_AGENT_RUNNING_MESSAGES[0];
  }

  const candidates = PROJECT_AGENT_RUNNING_MESSAGES.filter((message) => message !== current);
  const index = Math.floor(random() * candidates.length);
  return candidates[Math.max(0, Math.min(index, candidates.length - 1))];
}
