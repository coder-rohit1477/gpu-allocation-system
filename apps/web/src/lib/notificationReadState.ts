/**
 * Read/unread tracking for the derived notification feed (see
 * notifications.ts). There's no backend field to persist this in, so it
 * lives in localStorage, namespaced per user so switching accounts on the
 * same browser doesn't leak one student's read state into another's.
 */

function storageKey(userId: string): string {
  return `gpu-portal:notifications-read:${userId}`;
}

export function loadReadIds(userId: string): Set<string> {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.filter((v): v is string => typeof v === "string")) : new Set();
  } catch {
    return new Set();
  }
}

export function saveReadIds(userId: string, ids: Set<string>): void {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify([...ids]));
  } catch {
    // Best-effort only — a full/unavailable localStorage shouldn't break the page.
  }
}
