import crypto from 'crypto';

const PROJECT_AGENT_INTERNAL_PURPOSE = 'project-agent-clone-create';

const getInternalSigningSecret = () => {
  return process.env.CLERK_SECRET_KEY || process.env.SUPABASE_SECRET_KEY || '';
};

const buildPayload = (userId: string, timestamp: string, purpose: string) =>
  `${purpose}:${userId}:${timestamp}`;

export const signInternalUserRequest = (userId: string, timestamp: string, purpose = PROJECT_AGENT_INTERNAL_PURPOSE) => {
  const secret = getInternalSigningSecret();
  if (!secret) {
    throw new Error('Missing internal signing secret');
  }

  return crypto
    .createHmac('sha256', secret)
    .update(buildPayload(userId, timestamp, purpose))
    .digest('hex');
};

export const verifyInternalUserRequest = (options: {
  userId: string | null;
  timestamp: string | null;
  signature: string | null;
  purpose?: string;
  maxAgeMs?: number;
}) => {
  const { userId, timestamp, signature, purpose = PROJECT_AGENT_INTERNAL_PURPOSE, maxAgeMs = 5 * 60 * 1000 } = options;
  if (!userId || !timestamp || !signature) {
    return false;
  }

  const secret = getInternalSigningSecret();
  if (!secret) {
    return false;
  }

  const parsedTimestamp = Number(timestamp);
  if (!Number.isFinite(parsedTimestamp)) {
    return false;
  }

  if (Math.abs(Date.now() - parsedTimestamp) > maxAgeMs) {
    return false;
  }

  const expected = signInternalUserRequest(userId, timestamp, purpose);
  const provided = signature.trim();
  if (expected.length !== provided.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
};
