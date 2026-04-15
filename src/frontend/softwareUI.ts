/**
 * Frontend software module - UI initialization and event handlers
 * Part 2: Main initialization and UI setup
 */

import { FrontendDataProvider } from './citationCore';
import { CitationPackage } from '../citationTypes';
import { expandDependencies } from '../shared/dependencyResolver';

declare global {
  interface Window {
    bootstrap: any;
  }
}

/**
 * Initialize the software citation station frontend
 */
export async function initSoftwareCitationStation(): Promise<void> {
  const dataProvider = new FrontendDataProvider('');
  
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
      createSoftwareButton(key, citations[key], templateBtn, softwareList, depToggleBox);
      
      const cat = capitalize(citations[key].category);
      categories.add(cat);
      
      const lang = citations[key].language;
      if (typeof lang === 'string') {
        languages.add(capitalize(lang));
      } else {
        lang.forEach(l => languages.add(capitalize(l)));
      }
    }

    // Populate category and language selects
    for (const cat of [...categories].sort()) {
      categorySelect.appendChild(createOption(cat, cat));
    }
    for (const lang of [...languages].sort()) {
      languageSelect.appendChild(createOption(lang, lang));
    }

    // Populate new software form selects
    populateNewSoftwareForm(categorySelect, languageSelect);

    // Hide loading indicator
    const loadingEl = document.getElementById('software-loading');
    if (loadingEl) {
      loadingEl.classList.add('hide');
    }

    // Handle URL auto-select parameter
    handleAutoSelect();

    // Setup event listeners
    setupEventListeners();

  } catch (error) {
    console.error('Failed to initialize software citation station:', error);
  }
}

/**
 * Create a software button
 */
function createSoftwareButton(
  key: string,
  citation: CitationPackage,
  templateBtn: HTMLElement,
  softwareList: HTMLElement,
  depToggleBox: HTMLElement | null
): void {
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
    addDependencyToggle(key, depToggleBox, btn);
  }

  // Setup right-click tooltip
  setupSoftwareTooltip(btn, citation);

  // Setup click handler
  btn.addEventListener('click', () => handleSoftwareClick(btn, citation));
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
 * Populate new software form selects
 */
function populateNewSoftwareForm(categorySelect: HTMLSelectElement, languageSelect: HTMLSelectElement): void {
  const newSoftwareCategory = document.getElementById('new-software-category') as HTMLSelectElement;
  const newSoftwareLanguage = document.getElementById('new-software-language') as HTMLSelectElement;

  if (!newSoftwareCategory || !newSoftwareLanguage) return;

  if (newSoftwareCategory.children.length === 0) {
    newSoftwareCategory.appendChild(createOption('-', 'Select category'));
    for (let i = 0; i < categorySelect.options.length; i++) {
      if (categorySelect.options[i].value === 'all') continue;
      newSoftwareCategory.appendChild(createOption(
        categorySelect.options[i].value,
        categorySelect.options[i].textContent || ''
      ));
    }
    newSoftwareCategory.appendChild(createOption('new', 'New category'));
  }

  if (newSoftwareLanguage.children.length === 0) {
    newSoftwareLanguage.appendChild(createOption('-', 'Select language'));
    for (let i = 0; i < languageSelect.options.length; i++) {
      if (languageSelect.options[i].value === 'all') continue;
      newSoftwareLanguage.appendChild(createOption(
        languageSelect.options[i].value,
        languageSelect.options[i].textContent || ''
      ));
    }
    newSoftwareLanguage.appendChild(createOption('new', 'New language'));
  }
}

/**
 * Handle URL auto-select parameter
 */
function handleAutoSelect(): void {
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
}
