import fs from 'fs';
import path from 'path';
import os from 'os';

const BASE_URL = 'https://www.tomwagg.com/software-citation-station/data/';
const WEBSITE_REFRESH_HOUR_UTC = 6;

export function getCacheDir(): string {
  const cacheDir = process.env.XDG_CACHE_HOME 
    ? path.join(process.env.XDG_CACHE_HOME, 'scs')
    : path.join(os.homedir(), '.cache', 'scs');
  
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
  return cacheDir;
}

export function getCachedDataPath(filename: string): string {
  return path.join(getCacheDir(), filename);
}

export function shouldRefreshCache(fetchedAt: string): boolean {
  const fetched = new Date(fetchedAt);
  const now = new Date();
  
  const fetchedDate = fetched.toISOString().split('T')[0];
  const today = now.toISOString().split('T')[0];
  
  // If fetched today but before 6 AM UTC, and it's now after 6 AM UTC, refresh
  if (fetchedDate === today) {
    if (fetched.getUTCHours() < WEBSITE_REFRESH_HOUR_UTC && now.getUTCHours() >= WEBSITE_REFRESH_HOUR_UTC) {
      return true;
    }
    return false; // Already fetched after today's refresh or it's not yet refresh time
  }
  
  // If fetched on a previous day, refresh if it's now past 6 AM UTC
  return now.getUTCHours() >= WEBSITE_REFRESH_HOUR_UTC;
}

async function fetchData(filename: string, forceRefresh = false) {
  const cachePath = getCachedDataPath(filename);
  const metaPath = cachePath + '.meta.json';
  
  if (!forceRefresh && fs.existsSync(cachePath) && fs.existsSync(metaPath)) {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    if (!shouldRefreshCache(meta.fetchedAt)) {
      return fs.readFileSync(cachePath, 'utf8');
    }
  }
  
  console.error(`Fetching ${filename} from website...`);
  const response = await fetch(BASE_URL + filename);
  if (!response.ok) {
    if (fs.existsSync(cachePath)) {
      console.warn(`Failed to fetch ${filename}, using stale cache.`);
      return fs.readFileSync(cachePath, 'utf8');
    }
    throw new Error(`Failed to fetch ${filename}: ${response.statusText}`);
  }
  
  const data = await response.text();
  fs.writeFileSync(cachePath, data);
  fs.writeFileSync(metaPath, JSON.stringify({ fetchedAt: new Date().toISOString() }));
  return data;
}

export async function fetchCitations(forceRefresh = false): Promise<any> {
  const data = await fetchData('citations.json', forceRefresh);
  return JSON.parse(data);
}

export async function fetchBibtex(forceRefresh = false): Promise<string> {
  return await fetchData('bibtex.bib', forceRefresh);
}

export async function refreshCache(): Promise<void> {
  await fetchCitations(true);
  await fetchBibtex(true);
}
