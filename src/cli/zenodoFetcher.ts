import { fetchZenodoBibtex, getZenodoVersionInfo } from '../../js/citationCore.js';
import { getCachedDataPath, shouldRefreshCache } from './dataFetcher.js';
import type { CachedVersionData, ZenodoBibtexInfo } from './types.js';

export async function getZenodoVersionInfoCached(packageName: string, conceptDoi: string, refresh = false): Promise<CachedVersionData> {
    const cachePath = getCachedDataPath(`zenodo-versions/${packageName}.json`);
    const cacheDir = cachePath.substring(0, cachePath.lastIndexOf('/'));

    if (!refresh) {
        try {
            const cached = await import('fs').then(fs => fs.readFileSync(cachePath, 'utf-8'));
            const parsed = JSON.parse(cached) as CachedVersionData;
            if (!shouldRefreshCache(parsed.fetchedAt)) {
                return parsed;
            }
        } catch (error) {
            console.debug(`No cached version data found for ${packageName}`);
        }
    }

    console.log(`Fetching Zenodo versions for ${packageName}...`);
    const versions = await getZenodoVersionInfo(conceptDoi);

    const cacheData: CachedVersionData = {
        fetchedAt: new Date().toISOString(),
        versions
    };

    const fs = await import('fs');
    if (!await import('fs').then(fs => fs.existsSync(cacheDir))) {
        await import('fs').then(fs => fs.mkdirSync(cacheDir, { recursive: true }));
    }
    await import('fs').then(fs => fs.writeFileSync(cachePath, JSON.stringify(cacheData, null, 2)));

    return cacheData;
}

export async function fetchZenodoBibtexLive(recordId: string): Promise<string> {
    return await fetchZenodoBibtex(recordId);
}

export function getVersionDoi(packageName: string, version: string, cachedData: CachedVersionData): string | undefined {
    const versionData = cachedData.versions.find(v => v.version === version || v.version === `v${version}`);
    return versionData?.doi;
}

export async function getZenodoBibtexInfo(packageName: string, version: string, conceptDoi: string, refresh = false): Promise<ZenodoBibtexInfo | undefined> {
    const cachedData = await getZenodoVersionInfoCached(packageName, conceptDoi, refresh);
    const recordId = getVersionDoi(packageName, version, cachedData);

    if (!recordId) {
        console.warn(`Version ${version} not found for ${packageName}`);
        return undefined;
    }

    const bibtex = await fetchZenodoBibtexLive(recordId);
    const tag = `${packageName}_${version}`;

    return { bibtex, tag, version };
}
