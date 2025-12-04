# Zenodo Version Caching System

## Overview

This project implements a caching system for Zenodo version information to reduce API calls and improve performance.
The repository ships only `data/zenodo-versions/scipy.json` as a lightweight example; the fetch script and CI workflow regenerate the full cache as needed.

## Architecture

### TypeScript Module (`src/zenodoVersions.ts`)

The core functionality has been extracted from `software.js` and rewritten in TypeScript with strict type checking:

- **`compareVersions(a: string, b: string): number`** - Compares version strings, handling semantic versioning and "v" prefixes
- **`getZenodoVersionInfo(conceptDoi: string): Promise<ZenodoVersion[]>`** - Fetches version information from the Zenodo API with:
  - Pagination support (up to 10 pages)
  - Rate limiting handling (429 responses)
  - Duplicate version filtering
  - Sorted results (newest first)

### Fetching Script (`src/fetchVersions.ts`)

A Node.js script that:
1. Reads all packages from `data/citations.json`
2. For each package with a `zenodo_doi`, fetches version information using `getZenodoVersionInfo()`
3. Saves results to individual JSON files in `data/zenodo-versions/{package-name}.json`
4. Overwrites previous versions each time
5. Waits 500ms between requests to reduce rate limiting

### Frontend Integration (`js/software.js`)

The original `get_zenodo_version_info()` function remains for fallback, but a new `get_zenodo_version_info_cached()` function:
1. Attempts to load version data from `data/zenodo-versions/{package-name}.json`
2. Falls back to the API if the cached file doesn't exist
3. Populates the version picker UI with cached data

### Automated Updates (`.github/workflows/fetch-zenodo-versions.yml`)

A GitHub Action that:
- Runs daily at 6:00 AM UTC
- Can be manually triggered via workflow_dispatch
- Fetches fresh version data for all packages
- Commits and pushes changes if any updates are found

## Testing

Comprehensive unit tests in `__tests__/zenodoVersions.test.ts` cover:
- Version comparison logic (15 test cases)
- API fetching with mocked responses
- Pagination handling
- Rate limiting scenarios
- Error handling
- Edge cases (empty results, duplicates, etc.)

Run tests with:
```bash
npm test
```

## Usage

### Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run tests
npm test

# Fetch latest versions
npm run fetch-versions
```

### Production

The GitHub Action automatically updates the cache daily. No manual intervention is required unless:
- Adding a new package with a `zenodo_doi`
- Needing to force an immediate update (use "Run workflow" button in GitHub Actions)

## Benefits

1. **Reduced API Calls**: Zenodo version information is cached, reducing load on Zenodo's API
2. **Improved Performance**: Frontend loads version data instantly from cached files
3. **Type Safety**: TypeScript implementation with strict typing prevents runtime errors
4. **Maintainability**: Comprehensive test coverage ensures reliability
5. **Automation**: Daily updates keep version data fresh without manual intervention

## Data Format

Cached files contain an array of version objects:

```json
[
  {
    "version": "2.0.0",
    "doi": "12345678"
  },
  {
    "version": "1.0.0",
    "doi": "87654321"
  }
]
```

Versions are sorted from newest to oldest.
