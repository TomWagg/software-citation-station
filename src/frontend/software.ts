/**
 * Main frontend application for Software Citation Station
 * Ported from js/software.js to TypeScript with shared module reuse
 */

import { initDarkMode } from './darkMode';
import { FrontendDataProvider, parseBibtex } from './citationCore';
import { CitationPackage, ZenodoVersion } from '../citationTypes';
import { expandDependencies } from '../shared/dependencyResolver';
import { parseEnvironmentFile } from '../shared/fileParser';

// Constants
const BASE_ISSUE_TEXT = `# TODO before submitting

- [ ] Attach or link a logo (preferably square, no background)
    - If no logo is available then instead write that in a comment and change the data to have \`"logo": ""\`
- [ ] Update the logo file extension in the data below (change ".png" to the correct extension)
- [ ] Optionally add comments to the issue with questions or additional information

**Delete this list before submitting the issue!**

# Citation information\n`;

const BADGE_HTML = `<a href="https://www.tomwagg.com/software-citation-station/?auto-select=PACKAGENAME">
    <img src="https://img.shields.io/badge/Cite-PACKAGENAME-blue" />
</a>`;

// Global state
let citations: Record<string, CitationPackage> = {};
let bibtexTable: Record<string, string> = {};
let dataProvider: FrontendDataProvider;

/**
 * Capitalize first letter of a string
 */
function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Parse BibTeX from frontend (browser-compatible)
 */
function parseBibtexFrontend(bibtexText: string): Record<string, string> {
  const table: Record<string, string> = {};
  const bibtexRe = /@\w*{(?<tag>.*?)(?=,)/gms;
  let match: RegExpExecArray | null;

  while ((match = bibtexRe.exec(bibtexText)) !== null) {
    const tag = match.groups?.tag?.trim();
    if (tag) {
      table[tag] = match[0];
    }
  }

  return table;
}

/**
 * Highlight LaTeX syntax for display
 */
function highlightLatex(latex: string): string {
  return latex
    .replace(/\\cite[pt]*\{[^}]*\}/g, '<span class="latex-command">$&</span>')
    .replace(/\\texttt\{[^}]*\}/g, '<span class="latex-command">$&</span>')
    .replace(/\\href\{[^}]*\}\{[^}]*\}/g, '<span class="latex-command">$&</span>');
}

/**
 * Highlight BibTeX for display
 */
function highlightBibtex(bibtex: string): string {
  return bibtex
    .replace(/@\w+/g, '<span class="bibtex-type">$&</span>')
    .replace(/\b\w+\s*=/g, '<span class="bibtex-key">$&</span>');
}

/**
 * Create a copy button for text content
 */
function createCopyButton(text: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = 'btn btn-primary copy-btn';
  btn.innerHTML = '<i class="fa fa-copy"></i>';
  btn.addEventListener('click', () => {
    navigator.clipboard.writeText(text);
    // Show feedback
    const originalIcon = btn.innerHTML;
    btn.innerHTML = '<i class="fa fa-check"></i>';
    setTimeout(() => {
      btn.innerHTML = originalIcon;
    }, 2000);
  });
  return btn;
}

/**
 * Create a download button for text content
 */
function createDownloadButton(text: string, filename: string = 'citation.bib'): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = 'btn btn-primary download-btn';
  btn.innerHTML = '<i class="fa fa-download"></i>';
  btn.addEventListener('click', () => {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  });
  return btn;
}

/**
 * Collect all dependencies for a package (recursive)
 */
function collectDependencies(visited: Set<string>, packageName: string): string[] {
  if (visited.has(packageName)) {
    return [];
  }
  visited.add(packageName);

  const citation = citations[packageName];
  if (!citation?.dependencies) {
    return [packageName];
  }

  const allDeps: string[] = [packageName];
  for (const dep of citation.dependencies) {
    allDeps.push(...collectDependencies(visited, dep));
  }
  return allDeps;
}
