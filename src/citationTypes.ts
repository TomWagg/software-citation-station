export interface CitationPackage {
  tags: string[];
  logo: string;
  logo_background?: boolean;
  language: string | string[];
  category: string | string[];
  keywords: string[];
  description: string;
  link: string;
  zenodo_doi: string;
  attribution_link: string;
  custom_citation: string;
  dependencies?: string[];
  extra_bibtex?: string;
  frequently_used?: boolean;
  pypi_name?: string;
}

export interface ZenodoVersion {
  version: string;
  doi: string;
}

export interface CitationOutput {
  acknowledgement: string;
  bibtex: string;
  packages: Array<{
    name: string;
    selectedVersion?: string;
    selectedDoi?: string;
  }>;
}

export interface DataProvider {
  getCitations(): Promise<Record<string, CitationPackage>>;
  getBibtexTable(): Promise<Record<string, string>>;
  getVersions(packageName: string): Promise<ZenodoVersion[]>;
  getZenodoBibtex(doi: string): Promise<string>;
}
