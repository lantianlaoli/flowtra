export const MY_ADS_RETENTION_DAYS = 14;
export const MY_ADS_RETENTION_MS = MY_ADS_RETENTION_DAYS * 24 * 60 * 60 * 1000;

export function isMyAdExpired(createdAt: string | Date, now: Date = new Date()): boolean {
  const createdAtDate = createdAt instanceof Date ? createdAt : new Date(createdAt);

  if (Number.isNaN(createdAtDate.getTime())) {
    return false;
  }

  return now.getTime() - createdAtDate.getTime() >= MY_ADS_RETENTION_MS;
}
