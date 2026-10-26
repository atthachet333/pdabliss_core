/*
 * Email links carry their one-time token in the URL fragment
 * (`/verify-email?lang=en#token=…`): a fragment is never sent to a server or
 * in a Referer. The page reads it once and immediately removes it from the
 * address bar and the history entry, keeping it only in memory.
 */
export function takeLinkToken(): string | null {
  const match = window.location.hash.match(/(?:^#|&)token=([A-Za-z0-9_-]{20,128})/);
  if (window.location.hash) {
    const { pathname, search } = window.location;
    window.history.replaceState(window.history.state, '', `${pathname}${search}`);
  }
  return match?.[1] ?? null;
}
