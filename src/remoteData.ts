import { parseBibtexTable } from "./bibtex";
import { CitationPackage, DataProvider, ZenodoVersion } from "./citationTypes";

const DEFAULT_BASE_URL = "https://www.tomwagg.com/software-citation-station";
const DEFAULT_TIMEOUT_MS = 15_000;

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetchWithTimeout(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`);
  }
  return await response.json() as T;
}

async function fetchText(url: string, init?: RequestInit): Promise<string> {
  const response = await fetchWithTimeout(url, init);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`);
  }
  return await response.text();
}

export class RemoteDataProvider implements DataProvider {
  private readonly baseUrl: string;
  private citationsPromise: Promise<Record<string, CitationPackage>> | null = null;
  private bibtexTablePromise: Promise<Record<string, string>> | null = null;

  constructor(baseUrl = DEFAULT_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  async getCitations(): Promise<Record<string, CitationPackage>> {
    if (!this.citationsPromise) {
      const url = joinUrl(this.baseUrl, "data/citations.json");
      this.citationsPromise = fetchJson<Record<string, CitationPackage>>(url);
    }
    return await this.citationsPromise;
  }

  async getBibtexTable(): Promise<Record<string, string>> {
    if (!this.bibtexTablePromise) {
      const url = joinUrl(this.baseUrl, "data/bibtex.bib");
      this.bibtexTablePromise = fetchText(url).then(parseBibtexTable);
    }
    return await this.bibtexTablePromise;
  }

  async getVersions(packageName: string): Promise<ZenodoVersion[]> {
    const path = `data/zenodo-versions/${encodeURIComponent(packageName)}.json`;
    const url = joinUrl(this.baseUrl, path);
    return await fetchJson<ZenodoVersion[]>(url);
  }

  async getZenodoBibtex(doi: string): Promise<string> {
    const url = `https://zenodo.org/api/records/${encodeURIComponent(doi)}`;
    return await fetchText(url, {
      headers: {
        Accept: "application/x-bibtex"
      }
    });
  }
}

export { DEFAULT_BASE_URL };
