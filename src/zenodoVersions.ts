/**
 * Zenodo version information fetcher
 * Extracts and rewrites the get_zenodo_version_info function from software.js with strict TypeScript typing
 */

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
}

export interface ZenodoHits {
  total: number;
  hits: ZenodoHit[];
}

export interface ZenodoApiResponse {
  hits: ZenodoHits;
}

/**
 * Custom function for sorting version strings
 * Ported from software.js compare_versions function
 */
export function compareVersions(a: string, b: string): number {
  // Normalize versions by removing 'v' prefix
  let versionA = a[0] === "v" ? a.slice(1) : a;
  let versionB = b[0] === "v" ? b.slice(1) : b;
  
  if (versionA === versionB) {
    return 0;
  }
  
  const splitA = versionA.split('.');
  const splitB = versionB.split('.');
  const length = Math.max(splitA.length, splitB.length);
  
  for (let i = 0; i < length; i++) {
    // Default to '0' for missing parts (e.g., '1.0' vs '1.0.0')
    const partA = splitA[i] ?? '0';
    const partB = splitB[i] ?? '0';
    const numA = parseInt(partA);
    const numB = parseInt(partB);
    
    // Simple numeric comparison
    if (numA > numB) {
      return 1;
    }
    if (numA < numB) {
      return -1;
    }
    // If equal, continue to next part
  }
  
  return 0;
}

/**
 * Fetches version information for a package from Zenodo API
 * 
 * @param conceptDoi - The concept DOI for the package (e.g., "10.5281/zenodo.1234567")
 * @returns Promise resolving to array of version information sorted by version (newest first)
 */
export async function getZenodoVersionInfo(conceptDoi: string): Promise<ZenodoVersion[]> {
  const PAGE_SIZE = 25;
  const baseUrl = `https://zenodo.org/api/records?q=conceptdoi:"${conceptDoi}"&all_versions=true&size=${PAGE_SIZE}`;
  
  const versionAndDoi: ZenodoVersion[] = [];
  const versionsSoFar = new Set<string>();
  
  // Start with a large number to ensure we enter the loop at least once
  // This will be updated with the actual total from the API response
  const UNKNOWN_TOTAL_COUNT = Number.MAX_SAFE_INTEGER;
  let expectedVersions = UNKNOWN_TOTAL_COUNT;
  let nBadVersions = 0;
  let page = 1;
  
  while (versionAndDoi.length + nBadVersions < expectedVersions) {
    const url = `${baseUrl}&page=${page}`;
    
    // NOTE: THIS ASSUMES NO SOFTWARE HAS MORE THAN 250 (10 * 25) VERSIONS
    if (page > 10) {
      console.warn(`Exceeded 10 pages of results for concept DOI ${conceptDoi}. Stopping further requests to avoid rate limiting.`);
      console.log(`Fetched ${versionAndDoi.length} versions so far.`);
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

      if (versionsSoFar.has(version)) {
        nBadVersions += 1;
        continue;
      }

      // Ensure DOI is always stored as string (Zenodo returns numeric IDs sometimes)
      versionAndDoi.push({
        version,
        doi: String(hit.id)
      });
      versionsSoFar.add(version);
    }
    
    page += 1;
  }
  
  // Sort versions (newest first)
  versionAndDoi.sort((a, b) => compareVersions(a.version, b.version)).reverse();
  
  return versionAndDoi;
}
