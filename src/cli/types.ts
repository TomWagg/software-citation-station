export interface CitationEntry {
    tags: string[];
    logo: string;
    language: string[];
    category: string[];
    keywords: string[];
    description: string;
    link: string;
    zenodo_doi: string;
    attribution_link: string;
    custom_citation: string;
    dependencies: string[];
    feature_tags?: Array<Record<string, string[]>>;
    frequently_used?: boolean;
    pypi_name?: string;
    extra_bibtex?: string;
}

export interface Citations {
    [packageName: string]: CitationEntry;
}

export interface ZenodoVersion {
    version: string;
    doi: string;
}

export interface CachedVersionData {
    fetchedAt: string;
    versions: ZenodoVersion[];
}

export interface ParsedPackage {
    name: string;
    version?: string;
    features?: string[];
}

export interface CitationOutput {
    packages: string[];
    timestamp: string;
    dependencies: Record<string, string[]>;
    acknowledgments: string;
    bibtex: string;
}

export interface ZenodoBibtexInfo {
    bibtex: string;
    tag: string;
    version: string;
}
