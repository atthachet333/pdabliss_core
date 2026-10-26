/* Display helpers for the signed-in areas (EP23). */

export function formatDateTime(iso: string, htmlLang: string) {
  return new Intl.DateTimeFormat(htmlLang, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  );
}

/** "Chrome · Windows" from a user agent — coarse on purpose. */
export function describeDevice(ua: string | null): string | null {
  if (!ua) return null;
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Firefox\//.test(ua)
      ? 'Firefox'
      : /Chrome\//.test(ua)
        ? 'Chrome'
        : /Safari\//.test(ua)
          ? 'Safari'
          : null;
  const os = /Windows/.test(ua)
    ? 'Windows'
    : /Android/.test(ua)
      ? 'Android'
      : /iPhone|iPad/.test(ua)
        ? 'iOS'
        : /Mac OS X/.test(ua)
          ? 'macOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : null;
  return [browser, os].filter(Boolean).join(' · ') || null;
}
