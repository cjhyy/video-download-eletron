import type { CookieProfile } from '@/store/types';
import { getSiteInfoFromUrl, hostnameMatchesDomain } from './sites';

export function findBestCookieProfileForUrl(
  url: string,
  profiles: CookieProfile[] | undefined
): CookieProfile | undefined {
  if (!profiles || profiles.length === 0) return undefined;
  const site = getSiteInfoFromUrl(url);
  if (!site.hostname) return undefined;

  // Prefer direct hostname match, otherwise suffix match
  const exact = profiles.find((p) => p.domain.toLowerCase() === site.hostname);
  if (exact) return exact;

  return profiles.find((p) => hostnameMatchesDomain(site.hostname!, p.domain));
}



