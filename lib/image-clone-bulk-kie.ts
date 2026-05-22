export function isRetryableImageCloneBulkKieError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /\binternal error\b|please try again later|temporar|timeout|timed out|5\d\d|bad gateway|service unavailable|gateway timeout/i.test(message);
}
