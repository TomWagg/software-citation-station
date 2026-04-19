export const bibtex_re: RegExp;
export const latex_re: RegExp;

export function parseBibtex(bibtex_text: string): Record<string, string>;
export function isolateBibtexEntry(s: string, start: number): string;
export function collectDependencies(depSet: Set<string>, packageKey: string, citationsData: Record<string, any>): Set<string>;
export function fetchZenodoBibtex(doi: string): Promise<string>;
export function getZenodoVersionInfo(concept_doi: string): Promise<Array<{version: string, doi: string}>>;
export function parseFeatureTags(arr: Array<{[key: string]: string[]}>): Record<string, string[]>;
export function parsePackageInput(packageString: string): {name: string, version?: string, features?: string[]};
export function generateAcknowledgment(selectedPackages: string[], citationsData: Record<string, any>, featureSelections?: Record<string, string[]>, zenodoBibtexMap?: Map<string, {bibtex: string, tag: string}>): string;
export function generateBibtex(selectedPackages: string[], citationsData: Record<string, any>, bibtexTable: Record<string, string>, featureSelections?: Record<string, string[]>, zenodoBibtexMap?: Map<string, {bibtex: string, tag: string}>): string;
