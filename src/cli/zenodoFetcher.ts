import fs from 'fs';
import path from 'path';
import { getCacheDir, shouldRefreshCache } from './dataFetcher.js';
// @ts-ignore
import { getZenodoVersionInfo, fetchZenodoBibtex, bibtex_re } from '../../js/citationCore.js';

export interface ZenodoVersion {
  version: string;
  doi: string;
}

export async function getZenodoVersionInfoCached(packageName: string, conceptDoi: string): Promise<ZenodoVersion[]> {
    const versionsDir = path.join(getCacheDir(), 'zenodo-versions');
    if (!fs.existsSync(versionsDir)) {
        fs.mkdirSync(versionsDir, { recursive: true });
    }
    
    const cachePath = path.join(versionsDir, `${packageName}.json`);
    
    if (fs.existsSync(cachePath)) {
        const cachedData = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
        if (!shouldRefreshCache(cachedData.fetchedAt)) {
            return cachedData.versions;
        }
    }
    
    console.error(`Fetching Zenodo versions for ${packageName}...`);
    const versions = await getZenodoVersionInfo(conceptDoi);
    const dataToCache = {
        fetchedAt: new Date().toISOString(),
        versions: versions
    };
    fs.writeFileSync(cachePath, JSON.stringify(dataToCache, null, 2));
    return versions;
}

export async function fetchZenodoBibtexLive(recordId: string, packageName: string): Promise<string> {
    let bibtex = await fetchZenodoBibtex(recordId);
    // Apply tag replacement as in software.js
    if (bibtex) {
        bibtex = bibtex.replace(bibtex_re, `@software{${packageName}_${recordId}`);
    }
    return bibtex;
}

export async function getVersionDoi(packageName: string, conceptDoi: string, version: string): Promise<string | null> {
    const versions = await getZenodoVersionInfoCached(packageName, conceptDoi);
    const v = version.toLowerCase();
    const match = versions.find((item: ZenodoVersion) => 
        item.version.toLowerCase() === v || 
        item.version.toLowerCase() === 'v' + v ||
        'v' + item.version.toLowerCase() === v
    );
    return match ? match.doi : null;
}
