export function formatDuration(seconds?: number): string {
  if (!seconds) return '未知';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// Keep output identical to existing UI usage in DownloadPage:
// - returns '' when bytes is falsy
// - MB with 2 decimals; if > 1024MB, show GB with 2 decimals
export function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  const mb = bytes / (1024 * 1024);
  if (mb > 1024) {
    return ` (${(mb / 1024).toFixed(2)} GB)`;
  }
  return ` (${mb.toFixed(2)} MB)`;
}




