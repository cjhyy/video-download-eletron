export function toFileUrl(p: string): string {
  // Windows paths: C:\a\b -> file:///C:/a/b
  const normalized = p.replace(/\\/g, '/');
  if (/^[a-zA-Z]:\//.test(normalized)) {
    return `file:///${normalized}`;
  }
  // Already looks like a unix absolute path
  if (normalized.startsWith('/')) return `file://${normalized}`;
  return `file:///${normalized}`;
}


