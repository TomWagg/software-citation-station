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
  
  // Create version picker if software has Zenodo DOI
  const citation = citations[btn.getAttribute('data-key')!];
  if (citation?.zenodo_doi) {
    createVersionPicker(btn.getAttribute('data-key')!, citation.zenodo_doi);
  }
}

/**
 * Create version picker for a package with Zenodo DOI
 */
async function createVersionPicker(packageName: string, conceptDoi: string): Promise<void> {
  const versionPickerId = `${packageName}-version-picker`;
  let versionPicker = document.getElementById(versionPickerId);
  
  // Don't create if already exists
  if (versionPicker) {
    versionPicker.classList.remove('hide');
    return;
  }
  
  // Get template
  const template = document.getElementById('version-picker-template');
  if (!template) return;
  
  // Clone template
  versionPicker = template.cloneNode(true) as HTMLElement;
  versionPicker.id = versionPickerId;
  versionPicker.classList.remove('hide');
  versionPicker.setAttribute('data-loaded', 'false');
  
  // Set card title
  const cardTitle = versionPicker.querySelector('.card-title');
  if (cardTitle) {
    cardTitle.textContent = packageName;
  }
  
  // Handle logo
  const citation = citations[packageName];
  const logoImg = versionPicker.querySelector('.software-logo') as HTMLImageElement;
  
  if (citation?.logo && citation.logo !== '') {
    logoImg.src = citation.logo;
    logoImg.alt = `${packageName} logo`;
    if (citation.logo_background) {
      logoImg.classList.add('bg-white', 'p-1');
    }
  } else {
    // Remove logo and add text
    logoImg?.remove();
    const cardBody = versionPicker.querySelector('.card-body');
    if (cardBody) {
      const textEl = document.createElement('span');
      textEl.className = 'software-no-logo-text';
      textEl.textContent = packageName;
      const titleEl = cardBody.querySelector('.card-title');
      if (titleEl) {
        cardBody.insertBefore(textEl, titleEl);
      }
    }
  }
  
  // Add to version list
  const versionList = document.getElementById('version-list');
  if (versionList) {
    versionList.appendChild(versionPicker);
  }
  
  // Setup version select change handler
  const versionSelect = versionPicker.querySelector('.version-select') as HTMLSelectElement;
  if (versionSelect) {
    versionSelect.addEventListener('change', async () => {
      const selectedDoi = versionSelect.value;
      if (selectedDoi && selectedDoi !== '-') {
        // Fetch BibTeX for selected version
        const bibtex = await fetchZenodoBibtex(selectedDoi);
        if (bibtex) {
          // Update data attributes
          versionPicker.setAttribute('data-bibtex', bibtex);
          versionPicker.setAttribute('data-selected-doi', selectedDoi);
          
          // Update citation display
          updateCitationDisplay();
        }
      }
    });
  }
  
  // Fetch and populate versions
  await populateVersions(packageName, conceptDoi, versionSelect);
  versionPicker.setAttribute('data-loaded', 'true');
}

/**
 * Fetch versions from Zenodo API and populate dropdown
 */
async function populateVersions(
  packageName: string,
  conceptDoi: string,
  versionSelect: HTMLSelectElement | null
): Promise<void> {
  if (!versionSelect) return;
  
  const pageSize = 25;
  const baseUrl = `https://zenodo.org/api/records?q=conceptdoi:"${conceptDoi}"&all_versions=true&size=${pageSize}`;
  
  const versionAndDoi: Array<{ version: string; doi: string }> = [];
  const versionsSoFar = new Set<string>();
  
  let expectedVersions = 100000;
  let page = 1;
  let nBadVersions = 0;
  
  try {
    while (versionAndDoi.length + nBadVersions < expectedVersions && page <= 40) {
      const url = `${baseUrl}&page=${page}`;
      const response = await fetch(url);
      
      // Handle rate limiting
      if (response.status === 429) {
        const waitTime = 60000; // 60 seconds
        console.warn(`Rate limited. Waiting ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const data = await response.json();
      expectedVersions = data.hits.total;
      
      for (const hit of data.hits.hits) {
        const version = hit.metadata.version;
        if (version && version !== undefined && !versionsSoFar.has(version)) {
          versionAndDoi.push({ version, doi: String(hit.id) });
          versionsSoFar.add(version);
        } else {
          nBadVersions++;
        }
      }
      page++;
    }
    
    // Populate dropdown
    for (const { version, doi } of versionAndDoi) {
      const option = document.createElement('option');
      option.value = doi;
      option.textContent = version;
      versionSelect.appendChild(option);
    }
    
    // Hide waiter, show select
    const waiter = versionSelect.parentElement?.querySelector('.waiter');
    if (waiter) {
      waiter.classList.add('hide');
    }
    versionSelect.classList.remove('hide');
    
    // Auto-select latest if that option is active
    const latestVersionBtn = document.getElementById('latest_version');
    if (latestVersionBtn?.classList.contains('active') && versionAndDoi.length > 0) {
      versionSelect.value = versionAndDoi[0].doi;
      versionSelect.dispatchEvent(new Event('change'));
    }
  } catch (error) {
    console.error('Error fetching versions:', error);
  }
}

/**
 * Fetch BibTeX from Zenodo API
 */
async function fetchZenodoBibtex(doi: string): Promise<string> {
  const url = `https://zenodo.org/api/records/${doi}`;
  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/x-bibtex'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch BibTeX: ${response.status}`);
    }
    
    return await response.text();
  } catch (error) {
    console.error('Error fetching BibTeX:', error);
    return '';
  }
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

    // Handle Zenodo DOI - check for version picker
    if (citation.zenodo_doi) {
      const versionPicker = document.getElementById(`${key}-version-picker`);

      if (versionPicker && versionPicker.hasAttribute('data-bibtex')) {
        // User has selected a version
        const versionSelect = versionPicker.querySelector('.version-select') as HTMLSelectElement;
        const selectedVersion = versionSelect?.value;
        const chosenVersionDoi = versionSelect?.selectedOptions[0]?.getAttribute('data-doi');

        if (selectedVersion && chosenVersionDoi) {
          // Update acknowledgement with version-specific citation
          const newTag = `${key}_${selectedVersion.replace(/\./g, '')}`;
          acknowledgement += ` \\citep{${newTag}}`;

          // Get BibTeX from version picker
          const versionBibtex = versionPicker.getAttribute('data-bibtex') || '';
          if (versionBibtex) {
            bibsToAdd.push(highlightBibtex(versionBibtex));
          }
          
          if (customAck) {
            customAcksToAdd.push(highlightLatex(customAck));
          }
        } else {
          // Version picker exists but no version selected yet
          acknowledgement += '\\footnote{{TODO}: Need to choose a version to cite!!}';
          if (customAck) {
            customAcksToAdd.push(highlightLatex(customAck + '\\footnote{{TODO}: Need to choose a version to cite!!}'));
          } else {
            ackToAdd.push(highlightLatex(acknowledgement));
          }
        }
      } else {
        // No version picker - show TODO message
        acknowledgement += '\\footnote{{TODO}: Need to choose a version to cite!!}';
        if (customAck) {
          customAcksToAdd.push(highlightLatex(customAck + '\\footnote{{TODO}: Need to choose a version to cite!!}'));
        } else {
          ackToAdd.push(highlightLatex(acknowledgement));
        }
      }
    } else {
      if (customAck) {
        customAcksToAdd.push(highlightLatex(customAck));
      } else {
        ackToAdd.push(highlightLatex(acknowledgement));
      }
    }

    // Add BibTeX entries (only if not already added from version picker)
    for (const tag of tags) {
      if (tag && bibtexTable[tag] && !bibsToAdd.some(b => b.includes(tag))) {
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

  // File upload
  const fileUploadGo = document.getElementById('file-upload-go');
  const fileUpload = document.getElementById('file-upload') as HTMLInputElement;
  if (fileUploadGo && fileUpload) {
    fileUploadGo.addEventListener('click', () => {
      fileUpload.click();
    });
    fileUpload.addEventListener('change', handleFileUpload);
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

/**
 * Handle file upload and parse
 */
function handleFileUpload(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const content = e.target?.result as string;
    const filename = file.name.toLowerCase();
    
    // Parse based on file type
    let parsedSoftwares: { key: string; version: string }[] = [];
    if (filename.endsWith('.txt')) {
      parsedSoftwares = parsePipFreeze(content);
    } else if (filename.endsWith('.yml') || filename.endsWith('.yaml')) {
      parsedSoftwares = parseCondaEnv(content);
    } else {
      showToastNotification('Error', 'Unsupported file type. Please upload a .txt, .yml, or .yaml file.', 'danger');
      return;
    }

    // Turn off auto-add dependencies
    const autoDepsToggle = document.getElementById('auto-deps-toggle');
    if (autoDepsToggle?.classList.contains('active')) {
      autoDepsToggle.classList.remove('active');
    }

    // Track missing software and count selected packages
    const missingSoftwares: { key: string; version: string }[] = [];
    const intervalsRemaining: ReturnType<typeof setInterval>[] = [];
    let selectedCount = 0;

    // Go through each software button
    const softwareBtns = document.querySelectorAll('.software-button:not(#software-btn-template)');
    for (const btn of Array.from(softwareBtns)) {
      const key = btn.getAttribute('data-key')?.toLowerCase() || '';
      const pypiName = btn.getAttribute('data-pypi-name')?.toLowerCase() || '';

      // Check if this button matches any parsed software
      for (const software of parsedSoftwares) {
        if (key === software.key || pypiName === software.key) {
          // Remove this software from the list so we don't keep looping over it
          parsedSoftwares = parsedSoftwares.filter((s) => s.key !== software.key);

          if (!btn.classList.contains('active')) {
            selectedCount++;
            (btn as HTMLButtonElement).click();
          } else {
            // Already selected, still count it
            selectedCount++;
          }

          // If version picker exists, wait for data to load and select version
          const vp = document.getElementById(`${btn.getAttribute('data-key')}-version-picker`);
          if (vp) {
            const interval = setInterval(() => {
              if (vp.getAttribute('data-loaded') === 'true') {
                const select = vp.querySelector('.version-select') as HTMLSelectElement;
                let foundVersion = false;

                if (select) {
                  for (const opt of Array.from(select.options)) {
                    const optText = opt.text.toLowerCase().trim();
                    const versionFromFile = software.version.toLowerCase().trim();
                    if (optText === versionFromFile || optText === 'v' + versionFromFile) {
                      select.value = opt.value;
                      select.dispatchEvent(new Event('change'));
                      foundVersion = true;
                      break;
                    }
                  }
                }

                // If we can't find the version, note it
                if (!foundVersion) {
                  missingSoftwares.push(software);
                }

                clearInterval(interval);
                // Remove interval from remaining list
                const idx = intervalsRemaining.indexOf(interval);
                if (idx > -1) {
                  intervalsRemaining.splice(idx, 1);
                }
              }
            }, 500);
            intervalsRemaining.push(interval);
          }
        }
      }
    }

    // Check intervals until all are cleared
    const checkIntervals = setInterval(() => {
      if (intervalsRemaining.length === 0) {
        clearInterval(checkIntervals);

        // Show toast for missing packages
        if (missingSoftwares.length > 0) {
          let body = "<p class='m-0' style='font-size: 0.7rem;'>The following packages and versions are not available on Zenodo: ";
          const bodySoftwares = missingSoftwares.map((s) => `<code>${s.key}==${s.version}</code>`);
          body += bodySoftwares.join(', ') + '</p>';
          showToastNotification('Missing versions', body, '', false);
        }

        // Show success toast for packages that were found
        if (selectedCount > 0 || missingSoftwares.length > 0) {
          const toast = document.getElementById('toast-template')?.cloneNode(true) as HTMLElement;
          if (toast) {
            toast.id = '';
            toast.classList.remove('hide');
            toast.querySelector('.main-package')!.textContent = file.name;
            toast.querySelector('.dependencies')!.textContent = `${selectedCount} packages selected${missingSoftwares.length > 0 ? `, ${missingSoftwares.length} missing` : ''}`;
            document.getElementById('toaster')?.appendChild(toast);

            const bsToast = new (window as any).bootstrap.Toast(toast);
            bsToast.show();

            toast.addEventListener('hidden.bs.toast', () => {
              toast.remove();
            });
          }
        }
      }
    }, 500);

    // Reset file input
    input.value = '';
  };

  reader.readAsText(file);
}

/**
 * Parse pip freeze output
 */
function parsePipFreeze(content: string): { key: string; version: string }[] {
  const softwares: { key: string; version: string }[] = [];
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine === '' || trimmedLine.startsWith('#')) {
      continue;
    }
    const [key, version] = trimmedLine.split('==');
    if (key && version) {
      softwares.push({ key: key.toLowerCase(), version: version.trim() });
    }
  }
  return softwares;
}

/**
 * Parse conda env export output
 */
function parseCondaEnv(content: string): { key: string; version: string }[] {
  const softwares: { key: string; version: string }[] = [];
  const lines = content.split('\n');
  let inDeps = false;
  let inPipDeps = false;

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine === 'dependencies:') {
      inDeps = true;
      continue;
    }
    if (inPipDeps) {
      if (trimmedLine.startsWith('- ')) {
        const depLine = trimmedLine.slice(2);
        const [key, version] = depLine.split('==');
        if (key && version) {
          softwares.push({ key: key.toLowerCase(), version: version.trim() });
        }
      } else {
        inPipDeps = false;
      }
    } else if (inDeps) {
      if (trimmedLine === '- pip:') {
        inPipDeps = true;
        continue;
      }
      if (trimmedLine.startsWith('- ')) {
        const depLine = trimmedLine.slice(2);
        const parts = depLine.split('=');
        const key = parts[0];
        const version = parts[1] || '';
        if (key && version) {
          softwares.push({ key: key.toLowerCase(), version: version.trim() });
        }
      } else if (!trimmedLine.startsWith('#') && trimmedLine !== '') {
        break;
      }
    }
  }
  return softwares;
}

/**
 * Show toast notification
 */
function showToastNotification(title: string, body: string, type: string, isHtml: boolean = true): void {
  const toastContainer = document.getElementById('toaster');
  if (!toastContainer) return;

  const toast = document.createElement('div');
  toast.className = `toast align-items-center text-bg-${type || 'primary'} border-0`;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'assertive');
  toast.setAttribute('aria-atomic', 'true');

  toast.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">
        <strong>${title}</strong>
        ${isHtml ? body : `<span>${body}</span>`}
      </div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
    </div>
  `;

  toastContainer.appendChild(toast);
  const bsToast = new (window as any).bootstrap.Toast(toast);
  bsToast.show();

  toast.addEventListener('hidden.bs.toast', () => {
    toast.remove();
  });
}
