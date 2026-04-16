/**
 * Zenodo version information fetcher
 * Extracts and rewrites the get_zenodo_version_info function from software.js with strict TypeScript typing
 */

import semver from 'semver';

export interface ZenodoVersion {
  version: string;
  doi: string;
}

export interface ZenodoMetadata {
  version?: string;
}

export interface ZenodoHit {
  id: string;
  metadata: ZenodoMetadata;
  updated?: string;
  created?: string;
}

export interface ZenodoHits {
  total: number;
  hits: ZenodoHit[];
}

export interface ZenodoApiResponse {
  hits: ZenodoHits;
}

interface ZenodoVersionCandidate {
  version: string;
  doi: string;
  updated?: string;
  created?: string;
}

const MAX_PAGE_COUNT = 10;
const RETRY_DELAYS_MS = [10_000, 30_000, 90_000] as const;
const RETRYABLE_STATUS_CODES = new Set([408, 500, 502, 503, 504]);

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseRetryAfterHeader(retryAfterHeader: string | null): number | null {
  if (!retryAfterHeader) {
    return null;
  }

  const retryAfterSeconds = Number.parseInt(retryAfterHeader, 10);
  if (!Number.isNaN(retryAfterSeconds) && retryAfterSeconds >= 0) {
    return retryAfterSeconds * 1000;
  }

  const retryAfterDate = Date.parse(retryAfterHeader);
  if (!Number.isNaN(retryAfterDate)) {
    return Math.max(0, retryAfterDate - Date.now());
  }

  return null;
}

function getRateLimitWaitTime(response: Response): number {
  const rateLimitResetHeader = response.headers.get('x-ratelimit-reset');
  if (rateLimitResetHeader) {
    const resetTimeInMilliseconds = parseInt(rateLimitResetHeader, 10) * 1000;
    const currentTime = Date.now();
    return Math.max(0, resetTimeInMilliseconds - currentTime);
  }

  return parseRetryAfterHeader(response.headers.get('retry-after')) ?? 60_000;
}

function getRetryWaitTime(response: Response, attemptIndex: number): number {
  if (response.status === 429) {
    return getRateLimitWaitTime(response);
  }

  if (response.status === 503) {
    const retryAfterWaitTime = parseRetryAfterHeader(response.headers.get('retry-after'));
    if (retryAfterWaitTime !== null) {
      return retryAfterWaitTime;
    }
  }

  return RETRY_DELAYS_MS[attemptIndex];
}

/**
 * Compares version strings using the semver library.
 * Replaces the custom compare_versions function from software.js.
 */
export function compareVersions(a: string, b: string): number {
  const versionA = semver.coerce(a)?.version;
  const versionB = semver.coerce(b)?.version;

  if (!versionA && !versionB) {
    return a.localeCompare(b);
  }
  if (!versionA) {
    return -1;
  }
  if (!versionB) {
    return 1;
  }

  return semver.compare(versionA, versionB);
}

const getRecordTimestamp = (candidate: Pick<ZenodoVersionCandidate, 'updated' | 'created'>): number | null => {
  const timestamp = candidate.updated ?? candidate.created;
  if (!timestamp) {
    return null;
  }
  const parsed = Date.parse(timestamp);
  return Number.isNaN(parsed) ? null : parsed;
};

/**
 * Fetches version information for a package from Zenodo API
 *
 * @param conceptDoi - The concept DOI for the package (e.g., "10.5281/zenodo.1234567")
 * @returns Promise resolving to array of version information sorted by version (newest first)
 */
export async function getZenodoVersionInfo(conceptDoi: string): Promise<ZenodoVersion[]> {
  const PAGE_SIZE = 25;
  const baseUrl = `https://zenodo.org/api/records?q=conceptdoi:"${conceptDoi}"&all_versions=true&size=${PAGE_SIZE}`;

  const versionCandidates = new Map<string, ZenodoVersionCandidate>();

  // Start with a large number to ensure we enter the loop at least once
  // This will be updated with the actual total from the API response
  const UNKNOWN_TOTAL_COUNT = Number.MAX_SAFE_INTEGER;
  let expectedVersions = UNKNOWN_TOTAL_COUNT;
  let nBadVersions = 0;
  let page = 1;

  while (versionCandidates.size + nBadVersions < expectedVersions) {
    const url = `${baseUrl}&page=${page}`;

    // NOTE: THIS ASSUMES NO SOFTWARE HAS MORE THAN 250 (10 * 25) VERSIONS
    if (page > MAX_PAGE_COUNT) {
      console.warn(`Exceeded 10 pages of results for concept DOI ${conceptDoi}. Stopping further requests to avoid rate limiting.`);
      console.log(`Fetched ${versionCandidates.size} versions so far.`);
      break;
    }

    let response: Response | undefined;
    for (let attemptIndex = 0; attemptIndex <= RETRY_DELAYS_MS.length; attemptIndex++) {
      try {
        response = await fetch(url);
      } catch (error) {
        if (attemptIndex === RETRY_DELAYS_MS.length) {
          const message = error instanceof Error ? error.message : String(error);
          const err = new Error(
            `Failed to fetch Zenodo concept DOI ${conceptDoi} page ${page} after ${attemptIndex} retries: ${message}`
          );
          (err as any).cause = error;
          throw err;
        }

        const waitTime = RETRY_DELAYS_MS[attemptIndex];
        console.warn(`Fetch error for concept DOI ${conceptDoi} page ${page}. Retrying after ${waitTime}ms...`);
        await sleep(waitTime);
        continue;
      }

      if (response.status === 429 || RETRYABLE_STATUS_CODES.has(response.status)) {
        if (attemptIndex === RETRY_DELAYS_MS.length) {
          throw new Error(
            `Failed to fetch Zenodo concept DOI ${conceptDoi} page ${page} after ${attemptIndex} retries: HTTP ${response.status}`
          );
        }

        const waitTime = getRetryWaitTime(response, attemptIndex);
        console.warn(`Received HTTP ${response.status} for concept DOI ${conceptDoi} page ${page}. Retrying after ${waitTime}ms...`);
        await sleep(waitTime);
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      break;
    }

    if (!response || !response.ok) {
      throw new Error(`Failed to fetch Zenodo concept DOI ${conceptDoi} page ${page}: no successful response received`);
    }

    const data = await response.json() as ZenodoApiResponse;

    // Update the expected versions based on the total hits
    expectedVersions = data.hits.total;

    // Process each hit
    for (const hit of data.hits.hits) {
      const version = hit.metadata.version;

      // Skip entries without a version before checking duplicates
      if (version === undefined) {
        nBadVersions += 1;
        continue;
      }

      const existing = versionCandidates.get(version);
      if (!existing) {
        versionCandidates.set(version, {
          version,
          doi: String(hit.id),
          updated: hit.updated,
          created: hit.created
        });
        continue;
      }

      nBadVersions += 1;
      const existingTimestamp = getRecordTimestamp(existing);
      const currentTimestamp = getRecordTimestamp(hit);
      if (currentTimestamp !== null && (existingTimestamp === null || currentTimestamp > existingTimestamp)) {
        versionCandidates.set(version, {
          version,
          doi: String(hit.id),
          updated: hit.updated,
          created: hit.created
        });
      }
    }

    page += 1;
  }

  // Sort versions (newest first)
  const versionAndDoi = Array.from(versionCandidates.values()).map((candidate) => ({
    version: candidate.version,
    doi: candidate.doi
  }));

  versionAndDoi.sort((a, b) => compareVersions(a.version, b.version)).reverse();

  return versionAndDoi;
}
