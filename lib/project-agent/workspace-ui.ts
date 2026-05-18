export type ProjectAgentSessionSummary = {
  sessionId: string;
  title?: string | null;
  updatedAt?: string | null;
};

export type ProjectAgentSessionItem = ProjectAgentSessionSummary & {
  label: string;
  isActive: boolean;
};

export function getProjectAgentSessionLabel({
  title,
  index,
}: {
  title?: string | null;
  index: number;
}) {
  const normalizedTitle = title?.trim();
  return normalizedTitle || `Canvas ${index + 1}`;
}

export function buildProjectAgentSessionItems({
  activeSessionId,
  historyIds,
  sessions,
}: {
  activeSessionId: string;
  historyIds: string[];
  sessions: ProjectAgentSessionSummary[];
}): ProjectAgentSessionItem[] {
  const dedupedIds = [
    activeSessionId,
    ...historyIds.filter((sessionId) => sessionId !== activeSessionId),
  ].filter((sessionId, index, ids) => Boolean(sessionId) && ids.indexOf(sessionId) === index);
  const summaries = new Map(sessions.map((session) => [session.sessionId, session]));

  return dedupedIds.map((sessionId, index) => {
    const summary = summaries.get(sessionId);
    return {
      sessionId,
      title: summary?.title || null,
      updatedAt: summary?.updatedAt || null,
      label: getProjectAgentSessionLabel({ title: summary?.title, index }),
      isActive: sessionId === activeSessionId,
    };
  });
}
