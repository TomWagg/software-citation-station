import fs from 'fs';
import path from 'path';
import os from 'os';

const CACHE_DIR = path.join(os.homedir(), '.cache', 'scs');
const WEBSITE_BASE_URL = 'https://www.tomwagg.com/software-citation-station';
const WEBSITE_REFRESH_HOUR_UTC = 6;

export interface CachedData<T> {
    fetchedAt: string;
    data: T;
}

export function getCacheDir(): string {
    return CACHE_DIR;
}

export function getCachedDataPath(filename: string): string {
    const fullDir = path.join(CACHE_DIR, path.dirname(filename));
    if (!fs.existsSync(fullDir)) {
        fs.mkdirSync(fullDir, { recursive: true });
    }
    return path.join(CACHE_DIR, filename);
}

export function shouldRefreshCache(fetchedAt: string): boolean {
    const fetched = new Date(fetchedAt);
    const now = new Date();

    const fetchedDate = fetched.toISOString().split('T')[0];
    const today = now.toISOString().split('T')[0];

    if (fetchedDate === today && fetched.getUTCHours() >= WEBSITE_REFRESH_HOUR_UTC) {
        return false;
    }

    return now.getUTCHours() >= WEBSITE_REFRESH_HOUR_UTC;
}

export async function fetchCitations(refresh = false): Promise<Record<string, any>> {
    const cachePath = getCachedDataPath('citations.json');

    if (!refresh && fs.existsSync(cachePath)) {
        try {
            const cached = fs.readFileSync(cachePath, 'utf-8');
            const parsed = JSON.parse(cached) as CachedData<Record<string, any>>;
            if (!shouldRefreshCache(parsed.fetchedAt)) {
                return parsed.data;
            }
        } catch (error) {
            console.warn('Failed to read or parse cached citations, fetching fresh data');
        }
    }

    console.log('Fetching citations from website...');
    const response = await fetch(`${WEBSITE_BASE_URL}/data/citations.json`);
    if (!response.ok) {
        throw new Error(`Failed to fetch citations: ${response.statusText}`);
    }
    const data = await response.json();

    const cacheData: CachedData<Record<string, any>> = {
        fetchedAt: new Date().toISOString(),
        data
    };
    fs.writeFileSync(cachePath, JSON.stringify(cacheData, null, 2));

    return data;
}

export async function fetchBibtex(refresh = false): Promise<string> {
    const cachePath = getCachedDataPath('bibtex.bib');

    if (!refresh && fs.existsSync(cachePath)) {
        try {
            const cached = fs.readFileSync(cachePath, 'utf-8');
            const parsed = JSON.parse(cached) as CachedData<string>;
            if (!shouldRefreshCache(parsed.fetchedAt)) {
                return parsed.data;
            }
        } catch (error) {
            console.warn('Failed to read or parse cached BibTeX, fetching fresh data');
        }
    }

    console.log('Fetching BibTeX from website...');
    const response = await fetch(`${WEBSITE_BASE_URL}/data/bibtex.bib`);
    if (!response.ok) {
        throw new Error(`Failed to fetch BibTeX: ${response.statusText}`);
    }
    const data = await response.text();

    const cacheData: CachedData<string> = {
        fetchedAt: new Date().toISOString(),
        data
    };
    fs.writeFileSync(cachePath, JSON.stringify(cacheData, null, 2));

    return data;
}

export function refreshCache(): void {
    const files = ['citations.json', 'bibtex.bib'];
    const zenodoVersionsDir = path.join(CACHE_DIR, 'zenodo-versions');

    for (const file of files) {
        const filePath = getCachedDataPath(file);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`Deleted cached ${file}`);
        }
    }

    if (fs.existsSync(zenodoVersionsDir)) {
        const versionFiles = fs.readdirSync(zenodoVersionsDir);
        for (const file of versionFiles) {
            fs.unlinkSync(path.join(zenodoVersionsDir, file));
        }
        console.log(`Deleted cached Zenodo versions`);
    }

    console.log('Cache cleared successfully');
}
