export type SupportedSite = 'youtube' | 'bilibili' | 'tiktok' | 'unknown';

export interface SiteInfo {
  site: SupportedSite;
  hostname?: string;
  displayName: string;
}

function safeParseUrl(input: string): URL | null {
  try {
    return new URL(input);
  } catch {
    return null;
  }
}

export function getSiteInfoFromUrl(url: string): SiteInfo {
  const parsed = safeParseUrl(url.trim());
  if (!parsed) return { site: 'unknown', displayName: '未知站点' };

  const host = parsed.hostname.toLowerCase();
  const is = (suffix: string) => host === suffix || host.endsWith(`.${suffix}`);

  if (is('youtube.com') || host === 'youtu.be') return { site: 'youtube', hostname: host, displayName: 'YouTube' };
  if (is('bilibili.com') || host === 'b23.tv') return { site: 'bilibili', hostname: host, displayName: 'Bilibili' };
  if (is('tiktok.com')) return { site: 'tiktok', hostname: host, displayName: 'TikTok' };

  return { site: 'unknown', hostname: host, displayName: host };
}

/**
 * Normalize cookie profile domain matching.
 * Supports patterns like youtube.com matching www.youtube.com, m.youtube.com, etc.
 */
export function hostnameMatchesDomain(hostname: string, domain: string): boolean {
  const host = hostname.toLowerCase();
  const dom = domain.toLowerCase().replace(/^\.+/, '');
  return host === dom || host.endsWith(`.${dom}`);
}



