/**
 * Short, glanceable ages — "just now", "4m ago". Precision past the minute is
 * noise here: the only question the UI is answering is "is this the screenshot I
 * just took, or an older one?".
 */
export function formatTimeAgo(timestamp: number, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds < 45) return 'just now';

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${Math.max(1, minutes)}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  return `${Math.round(hours / 24)}d ago`;
}
