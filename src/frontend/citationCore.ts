/**
 * Frontend citation core - browser-compatible citation logic
 * Wraps shared modules for use in the browser
 */

import { CitationPackage, ZenodoVersion } from '../citationTypes';
import { expandDependencies } from '../shared/dependencyResolver';

/**
 * Frontend-compatible data provider
 * Fetches data from local files instead of remote API
 */
export class FrontendDataProvider {
  private readonly baseUrl: string;
  private citationsPromise: Promise<Record<string, CitationPackage>> | null = null;
  private bibtexTablePromise: Promise<Record<string, string>> | null = null;

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
  }

  /**
   * Fetch and parse citations.json
   */
  async getCitations(): Promise<Record<string, CitationPackage>> {
    if (!this.citationsPromise) {
      this.citationsPromise = fetch(this.baseUrl + 'data/citations.json')
        .then(response => {
          if (!response.ok) {
            throw new Error(`Failed to fetch citations: ${response.status}`);
          }
          return response.json() as Promise<Record<string, CitationPackage>>;
        });
    }
    return await this.citationsPromise;
  }

  /**
   * Fetch and parse bibtex.bib
   */
  async getBibtexTable(): Promise<Record<string, string>> {
    if (!this.bibtexTablePromise) {
      this.bibtexTablePromise = fetch(this.baseUrl + 'data/bibtex.bib')
        .then(response => {
          if (!response.ok) {
            throw new Error(`Failed to fetch bibtex: ${response.status}`);
          }
          return response.text();
        })
        .then(parseBibtexFrontend);
    }
    return await this.bibtexTablePromise;
  }

  /**
   * Fetch cached Zenodo versions for a package
   */
  async getVersions(packageName: string): Promise<ZenodoVersion[]> {
    const url = this.baseUrl + `data/zenodo-versions/${encodeURIComponent(packageName)}.json`;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        return [];
      }
      return await response.json() as Promise<ZenodoVersion[]>;
    } catch {
      return [];
    }
  }

  /**
   * Fetch BibTeX from Zenodo API
   */
  async getZenodoBibtex(doi: string): Promise<string> {
    const url = `https://zenodo.org/api/records/${encodeURIComponent(doi)}`;
    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/x-bibtex'
        }
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch Zenodo bibtex: ${response.status}`);
      }
      return await response.text();
    } catch (error) {
      console.error(`Error fetching Zenodo bibtex for ${doi}:`, error);
      return '';
    }
  }

  /**
   * Expand packages with their dependencies
   */
  async expandWithDependencies(
    packages: string[],
    autoExpand: boolean = true
  ): Promise<string[]> {
    if (!autoExpand) {
      return packages;
    }

    const citations = await this.getCitations();
    return expandDependencies(packages, citations, { autoExpand: true });
  }
}

/**
 * Parse BibTeX content into a lookup table (frontend version)
 * @param bibtexText - Raw BibTeX text
 * @returns Object mapping tags to BibTeX entries
 */
export function parseBibtexFrontend(bibtexText: string): Record<string, string> {
  const bibtexTable: Record<string, string> = {};
  const bibtexRe = /@\w*{(?<tag>.*?)(?=,)/gms;
  
  let match: RegExpExecArray | null;
  while ((match = bibtexRe.exec(bibtexText)) !== null) {
    const tag = match.groups?.tag?.trim();
    if (tag) {
      bibtexTable[tag] = match[0];
    }
  }
  
  return bibtexTable;
}
