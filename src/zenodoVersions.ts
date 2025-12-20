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
    if (page > 10) {
      console.warn(`Exceeded 10 pages of results for concept DOI ${conceptDoi}. Stopping further requests to avoid rate limiting.`);
      console.log(`Fetched ${versionCandidates.size} versions so far.`);
      break;
    }

    // Make the API request
    const response = await fetch(url);

    // Handle rate limiting (429 Too Many Requests)
    if (response.status === 429) {
      const rateLimitResetHeader = response.headers.get('x-ratelimit-reset');
      let waitTime = 60000; // Default wait time of 60 seconds

      if (rateLimitResetHeader) {
        const resetTimeInMilliseconds = parseInt(rateLimitResetHeader, 10) * 1000;
        const currentTime = Date.now();
        waitTime = Math.max(0, resetTimeInMilliseconds - currentTime);
      }

      console.warn(`Received 429 Too Many Requests response. Retrying after ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      continue; // Retry the same page
    }

    // Check if the response is OK
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
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
