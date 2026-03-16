import crypto from 'crypto';

const normalizeSignatureCandidates = (rawHeader: string | null) => {
  if (!rawHeader) return [];

  return rawHeader
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .flatMap((entry) => {
      if (entry.startsWith('sha256=')) {
        return [entry.slice('sha256='.length)];
      }

      const equalsIndex = entry.indexOf('=');
      if (equalsIndex > 0) {
        return [entry.slice(equalsIndex + 1).trim()];
      }

      return [entry];
    });
};

const createHmacHex = (body: string, secret: string) =>
  crypto.createHmac('sha256', secret).update(body).digest('hex');

const createHmacBase64 = (body: string, secret: string) =>
  crypto.createHmac('sha256', secret).update(body).digest('base64');

const safeCompare = (left: string, right: string) => {
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(Buffer.from(left), Buffer.from(right));
};

export const verifyCreemWebhookSignature = (body: string, request: Request) => {
  const secret = process.env.CREEM_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error('CREEM_WEBHOOK_SECRET is not configured');
  }

  const headerValue =
    request.headers.get('creem-signature') ||
    request.headers.get('x-creem-signature') ||
    request.headers.get('x-webhook-signature') ||
    request.headers.get('webhook-signature');

  const candidates = normalizeSignatureCandidates(headerValue);
  if (candidates.length === 0) {
    return false;
  }

  const expectedHex = createHmacHex(body, secret);
  const expectedBase64 = createHmacBase64(body, secret);

  return candidates.some((candidate) =>
    safeCompare(candidate, expectedHex) || safeCompare(candidate, expectedBase64)
  );
};
