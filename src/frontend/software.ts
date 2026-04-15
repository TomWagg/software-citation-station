/**
 * Main frontend application for Software Citation Station
 * Ported from js/software.js to TypeScript with shared module reuse
 */

import { initDarkMode } from './darkMode';
import { FrontendDataProvider, parseBibtexFrontend } from './citationCore';
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
export function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
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

/**
 * Create an option element
 */
function createOption(value: string, text: string): HTMLOptionElement {
  const opt = document.createElement('option');
  opt.value = value;
  opt.textContent = text;
  return opt;
}

/**
 * Initialize the software citation station frontend
 */
export async function initSoftwareCitationStation(): Promise<void> {
  dataProvider = new FrontendDataProvider('');
  
  try {
    // Fetch citation data and bibtex in parallel
    const [citationsData, bibtexText] = await Promise.all([
      dataProvider.getCitations(),
      fetch('data/bibtex.bib').then(r => r.text())
    ]);

    citations = citationsData;
    bibtexTable = parseBibtexFrontend(bibtexText);

    // Get DOM elements
    const templateBtn = document.getElementById('software-btn-template');
    const softwareList = document.getElementById('software-list');
    const categorySelect = document.getElementById('software-category') as HTMLSelectElement;
    const languageSelect = document.getElementById('software-language') as HTMLSelectElement;
    const depToggleBox = document.getElementById('new-software-dependencies');

    if (!templateBtn || !softwareList) {
      console.error('Required DOM elements not found');
      return;
    }

    // Track unique categories and languages
    const categories = new Set<string>();
    const languages = new Set<string>();

    // Sort keys: frequently_used first, then alphabetically
    let sortedKeys = Object.keys(citations).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    sortedKeys.sort((a, b) => {
      const aFreq = citations[a].frequently_used ?? false;
      const bFreq = citations[b].frequently_used ?? false;
      if (aFreq && !bFreq) return -1;
      if (!aFreq && bFreq) return 1;
      return 0;
    });

    // Create software buttons
    for (const key of sortedKeys) {
      const citation = citations[key];
      const btn = templateBtn.cloneNode(true) as HTMLButtonElement;
      btn.setAttribute('data-key', key);
      btn.setAttribute('data-tags', citation.tags?.join(',') || '');
      btn.setAttribute('data-keywords', citation.keywords?.join(',') || '');
      btn.setAttribute('data-pypi-name', citation.pypi_name || '');
      btn.setAttribute('data-dependencies', citation.dependencies?.join(',') || '');
      btn.setAttribute('data-category', capitalize(citation.category));
      
      const lang = citation.language;
      if (typeof lang === 'string') {
        btn.setAttribute('data-language', capitalize(lang));
      } else {
        btn.setAttribute('data-language', lang.map(l => capitalize(l)).join(', '));
      }

      btn.querySelector('.software-name')!.innerHTML = `<pre>${key}</pre>`;
      btn.id = '';

      // Handle logo
      const logoImg = btn.querySelector('.software-logo') as HTMLImageElement;
      if (citation.logo === '') {
        logoImg?.remove();
        const el = document.createElement('span');
        el.className = 'software-no-logo-text';
        el.innerText = key;
        btn.insertBefore(el, btn.querySelector('.software-name'));
      } else {
        if (logoImg) {
          logoImg.src = citation.logo;
          if (citation.logo_background) {
            logoImg.classList.add('bg-white', 'p-1');
          }
        }
      }

      // Unhide and add to list
      btn.classList.remove('hide');
      softwareList.appendChild(btn);

      // Add dependency toggle for new software form
      if (depToggleBox) {
        const depToggle = document.getElementById('dependency-template')?.cloneNode(true) as HTMLElement;
        depToggle.id = '';
        depToggle.innerText = key;
        depToggle.classList.remove('hide');
        depToggle.addEventListener('click', function() {
          if (this.classList.contains('text-bg-secondary')) {
            this.classList.remove('text-bg-secondary');
            this.classList.add('text-bg-primary');
          } else {
            this.classList.remove('text-bg-primary');
            this.classList.add('text-bg-secondary');
          }
        });
        depToggleBox.appendChild(depToggle);
      }

      // Setup click handler
      btn.addEventListener('click', () => handleSoftwareClick(btn));
    }

    // Populate category and language selects
    for (const cat of [...categories].sort()) {
      categorySelect.appendChild(createOption(cat, cat));
    }
    for (const lang of [...languages].sort()) {
      languageSelect.appendChild(createOption(lang, lang));
    }

    // Hide loading indicator
    const loadingEl = document.getElementById('software-loading');
    if (loadingEl) {
      loadingEl.classList.add('hide');
    }

    // Handle URL auto-select parameter
    const params = new URLSearchParams(window.location.search);
    if (params.has('auto-select')) {
      const toSelect = params.get('auto-select')!.split(',');
      for (const key of toSelect) {
        const btn = document.querySelector(`.software-button[data-key="${key.trim()}"]`) as HTMLButtonElement;
        if (btn && !btn.classList.contains('active')) {
          btn.click();
        }
      }
    }

    // Setup event listeners
    setupEventListeners();

  } catch (error) {
    console.error('Failed to initialize software citation station:', error);
  }
}

/**
 * Handle software button click
 */
function handleSoftwareClick(btn: HTMLButtonElement): void {
  btn.classList.toggle('active');

  if (!btn.classList.contains('active')) {
    const vp = document.getElementById(`${btn.getAttribute('data-key')}-version-picker`);
    if (vp) {
      vp.classList.add('hide');
    }
    return;
  }

  // Check auto-add dependencies
  const autoAddDeps = document.getElementById('auto-deps-toggle')?.classList.contains('active');
  
  if (autoAddDeps) {
    const visited = new Set<string>();
    const deps = collectDependencies(visited, btn.getAttribute('data-key')!);
    const previouslyUnselected: string[] = [];
    
    for (const dep of deps) {
      const depBtn = document.querySelector(`.software-button[data-key="${dep}"]`) as HTMLButtonElement;
      if (depBtn && !depBtn.classList.contains('active')) {
        previouslyUnselected.push(dep);
        depBtn.classList.add('active');
      }
    }

    if (previouslyUnselected.length > 0) {
      // Show toast notification
      const toast = document.getElementById('toast-template')?.cloneNode(true) as HTMLElement;
      if (toast) {
        toast.id = '';
        toast.classList.remove('hide');
        toast.querySelector('.main-package')!.textContent = btn.getAttribute('data-key')!;
        toast.querySelector('.dependencies')!.textContent = previouslyUnselected.join(', ');
        document.getElementById('toaster')?.appendChild(toast);
        
        const bsToast = new (window as any).bootstrap.Toast(toast);
        bsToast.show();
        
        toast.addEventListener('hidden.bs.toast', () => {
          toast.remove();
        });
      }
    }
  }

  // Update acknowledgements and BibTeX
  updateCitationDisplay();
}

/**
 * Update the citation display (acknowledgements and BibTeX)
 */
function updateCitationDisplay(): void {
  const ack = document.getElementById('acknowledgement');
  const bibtexBox = document.getElementById('bibtex');
  const activeButtons = document.querySelectorAll('.software-button.active');

  if (!ack || !bibtexBox) return;

  if (activeButtons.length === 0) {
    ack.innerHTML = '<i>Acknowledgement will go here</i>';
    bibtexBox.innerHTML = '<i>Bibtex will go here</i>';
    return;
  }

  const ackToAdd: string[] = [];
  const customAcksToAdd: string[] = [];
  const bibsToAdd: string[] = [];

  activeButtons.forEach(btn => {
    const key = btn.getAttribute('data-key')!;
    const citation = citations[key];
    const tags = citation.tags || [];
    
    let acknowledgement = `\\texttt{${key}}`;
    if (tags.length > 0 && tags[0] !== '') {
      acknowledgement += ` \\citep{${tags.join(',')}}`;
    }
    
    const customAck = citation.custom_citation || '';

    // Handle Zenodo DOI
    if (citation.zenodo_doi) {
      // TODO: Version picker integration
      acknowledgement += '\\footnote{{TODO}: Need to choose a version to cite!!}';
      if (customAck) {
        customAcksToAdd.push(highlightLatex(customAck + '\\footnote{{TODO}: Need to choose a version to cite!!}'));
      } else {
        ackToAdd.push(highlightLatex(acknowledgement));
      }
    } else {
      if (customAck) {
        customAcksToAdd.push(highlightLatex(customAck));
      } else {
        ackToAdd.push(highlightLatex(acknowledgement));
      }
    }

    // Add BibTeX entries
    for (const tag of tags) {
      if (tag && bibtexTable[tag]) {
        bibsToAdd.push(highlightBibtex(bibtexTable[tag]));
      }
    }

    if (citation.extra_bibtex) {
      bibsToAdd.push(highlightBibtex(citation.extra_bibtex));
    }
  });

  // Build acknowledgement text
  ack.innerHTML = '';
  if (ackToAdd.length > 0) {
    ack.innerHTML = 'This work made use of the following software packages: ';
    ack.innerHTML += ackToAdd.slice(0, -1).join(', ') + 
                     (ackToAdd.length > 2 ? ',' : '') + 
                     (ackToAdd.length > 1 ? ' and ' : '') + 
                     ackToAdd.slice(-1) + '.';
  }
  
  if (customAcksToAdd.length > 0 && ackToAdd.length > 0) {
    ack.innerHTML += '\n\n';
  }
  ack.innerHTML += customAcksToAdd.join('\n\n');
  ack.innerHTML += '\n\n' + highlightLatex('Software citation information aggregated using \\texttt{\\href{https://www.tomwagg.com/software-citation-station/}{The Software Citation Station}} \\citep{software-citation-station-paper,software-citation-station-zenodo}.');

  // Add BibTeX
  bibtexBox.innerHTML = bibsToAdd.join('\n\n');

  // Add copy/download buttons
  const oldButtons = bibtexBox.parentElement?.querySelector('.btn-group');
  if (oldButtons) {
    oldButtons.remove();
  }

  const btnGroup = document.createElement('div');
  btnGroup.className = 'btn-group corner-button';
  btnGroup.appendChild(createCopyButton(bibtexBox.innerText));
  btnGroup.appendChild(createDownloadButton(bibtexBox.innerText));
  bibtexBox.parentElement?.appendChild(btnGroup);

  ack.appendChild(createCopyButton(ack.innerText));
}

/**
 * Setup event listeners for the UI
 */
function setupEventListeners(): void {
  // Software search
  let typingTimer: ReturnType<typeof setTimeout>;
  const searchInput = document.getElementById('software-search') as HTMLInputElement;
  const searchClear = document.getElementById('software-search-clear');
  const filterClear = document.getElementById('software-filter-clear');
  const categorySelect = document.getElementById('software-category') as HTMLSelectElement;
  const languageSelect = document.getElementById('software-language') as HTMLSelectElement;

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(typingTimer);
      typingTimer = setTimeout(handleSearch, 200);
    });
  }

  if (searchClear) {
    searchClear.addEventListener('click', () => {
      searchInput.value = '';
      handleSearch();
    });
  }

  if (filterClear) {
    filterClear.addEventListener('click', () => {
      categorySelect.value = 'all';
      languageSelect.value = 'all';
      handleSearch();
    });
  }

  if (categorySelect) {
    categorySelect.addEventListener('change', handleSearch);
  }
  if (languageSelect) {
    languageSelect.addEventListener('change', handleSearch);
  }

  // Clear all software
  const clearBtn = document.getElementById('software-clear');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      const buttons = document.querySelectorAll('.software-button.active');
      buttons.forEach(btn => {
        btn.classList.remove('active');
        const vp = document.getElementById(`${btn.getAttribute('data-key')}-version-picker`);
        if (vp) vp.classList.add('hide');
      });
      updateCitationDisplay();
    });
  }

  // Version selector toggle
  const versionButtons = document.querySelectorAll('#version-selector button');
  versionButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const activeBtn = btn.parentElement?.querySelector('.active');
      if (activeBtn !== btn) {
        activeBtn?.classList.remove('active');
        btn.classList.add('active');
        
        if (btn.id === 'latest_version') {
          document.querySelectorAll('.version-picker:not(.hide) .version-select').forEach(select => {
            const firstOption = (select as HTMLSelectElement).options[1];
            if (firstOption) {
              (select as HTMLSelectElement).value = firstOption.value;
              select.dispatchEvent(new Event('change'));
            }
          });
        }
      }
    });
  });
}

/**
 * Handle software search/filtering
 */
function handleSearch(): void {
  const searchTerm = (document.getElementById('software-search') as HTMLInputElement)?.value.toLowerCase() || '';
  const selectedCategory = (document.getElementById('software-category') as HTMLSelectElement)?.value || 'all';
  const selectedLanguage = (document.getElementById('software-language') as HTMLSelectElement)?.value || 'all';

  const buttons = document.querySelectorAll('.software-button');
  let visibleCount = 0;

  buttons.forEach(btn => {
    const name = btn.getAttribute('data-key')?.toLowerCase() || '';
    const category = btn.getAttribute('data-category') || '';
    const language = btn.getAttribute('data-language') || '';
    const keywords = btn.getAttribute('data-keywords')?.toLowerCase() || '';

    const matchesSearch = !searchTerm || name.includes(searchTerm) || keywords.includes(searchTerm);
    const matchesCategory = selectedCategory === 'all' || category === selectedCategory;
    const matchesLanguage = selectedLanguage === 'all' || language.includes(selectedLanguage);

    if (matchesSearch && matchesCategory && matchesLanguage) {
      btn.classList.remove('hide');
      visibleCount++;
    } else {
      btn.classList.add('hide');
    }
  });

  // Show/hide "no results" message
  const noResults = document.getElementById('software-search-empty');
  if (noResults) {
    if (visibleCount === 0 && searchTerm) {
      noResults.classList.remove('hide');
    } else {
      noResults.classList.add('hide');
    }
  }
}
