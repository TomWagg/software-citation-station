/**
 * Software Citation Station - Frontend Bundle
 * Generated automatically by bundle-frontend.js
 * Build time: 2026-04-15T23:11:53.903Z
 */

(function() {
  'use strict';

  // Shared modules
  /**
 * Dependency resolver for auto-expanding package dependencies
 * Used by both CLI and frontend
 */
/**
 * Expand a list of packages with their dependencies
 * @param packages - Initial list of package names
 * @param citations - Citation database
 * @param options - Dependency resolution options
 * @returns Expanded list of packages including dependencies
 */
function expandDependencies(packages, citations, options = {}) {
    const { autoExpand = true, maxDepth } = options;
    if (!autoExpand) {
        return packages;
    }
    const allPackages = new Set();
    const toProcess = packages.map(p => ({ pkg: p, depth: 0 }));
    while (toProcess.length > 0) {
        const { pkg: current, depth } = toProcess.shift();
        // Skip if already processed
        if (allPackages.has(current)) {
            continue;
        }
        // Skip if we've reached max depth
        if (maxDepth !== undefined && depth >= maxDepth) {
            continue;
        }
        allPackages.add(current);
        // Get dependencies for this package
        const citation = citations[current];
        if (citation?.dependencies) {
            for (const dep of citation.dependencies) {
                if (!allPackages.has(dep) && citations[dep]) {
                    toProcess.push({ pkg: dep, depth: depth + 1 });
                }
            }
        }
    }
    return Array.from(allPackages);
}
/**
 * Get direct dependencies for a package
 * @param packageName - Package name
 * @param citations - Citation database
 * @returns List of direct dependencies (empty if none)
 */
function getDirectDependencies(packageName, citations) {
    const citation = citations[packageName];
    return citation?.dependencies || [];
}
/**
 * Get all transitive dependencies for a package
 * @param packageName - Package name
 * @param citations - Citation database
 * @returns List of all dependencies (transitive)
 */
function getAllDependencies(packageName, citations) {
    return expandDependencies([packageName], citations, { autoExpand: true });
}
/**
 * Check if a package is a dependency of another package
 * @param packageName - Main package name
 * @param potentialDep - Potential dependency name
 * @param citations - Citation database
 * @returns True if potentialDep is a dependency of packageName
 */
function isDependency(packageName, potentialDep, citations) {
    const allDeps = getAllDependencies(packageName, citations);
    return allDeps.includes(potentialDep);
}
/**
 * Get dependency tree for visualization
 * @param packageName - Package name
 * @param citations - Citation database
 * @returns Nested dependency structure
 */
function getDependencyTree(packageName, citations) {
    const visited = new Set();
    function buildTree(pkg) {
        if (visited.has(pkg)) {
            return { name: pkg, dependencies: [], circular: true };
        }
        visited.add(pkg);
        const deps = getDirectDependencies(pkg, citations);
        const children = deps.map(dep => buildTree(dep));
        return {
            name: pkg,
            dependencies: children
        };
    }
    return buildTree(packageName);
}
//# sourceMappingURL=dependencyResolver.js.map
  /**
 * File parser for requirements.txt and conda environment files
 * Used by both CLI and frontend for parsing package lists
 */
/**
 * Parse a requirements.txt file (pip freeze output)
 * Handles formats like:
 * - package==1.0.0
 * - package>=1.0.0
 * - package~=1.0.0
 * - package (no version)
 */
function parseRequirementsTxt(content) {
    const packages = [];
    const lines = content.split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        // Skip empty lines and comments
        if (!trimmed || trimmed.startsWith('#')) {
            continue;
        }
        // Skip -r includes (other requirements files)
        if (trimmed.startsWith('-r ') || trimmed.startsWith('--requirement')) {
            continue;
        }
        // Skip other pip options
        if (trimmed.startsWith('-')) {
            continue;
        }
        // Extract package name (before any version specifier)
        // Handles ==, >=, <=, !=, ~=, >, <, @, [extras]
        const match = trimmed.match(/^([a-zA-Z0-9_-]+(?:\[[a-zA-Z0-9_,-]+\])?)/);
        if (match) {
            // Remove extras like [dev,test] from package name
            const packageName = match[1].split('[')[0].toLowerCase();
            packages.push(packageName);
        }
    }
    return {
        packages,
        source: 'requirements'
    };
}
/**
 * Parse a conda environment export YAML file
 * Handles both simple list and pip nested sections
 */
function parseCondaEnvYaml(content) {
    const packages = [];
    let pythonVersion;
    let inPipSection = false;
    let inDependenciesSection = false;
    const lines = content.split('\n');
    for (const line of lines) {
        // Check for section headers
        if (line.startsWith('dependencies:')) {
            inDependenciesSection = true;
            inPipSection = false;
            continue;
        }
        if (inDependenciesSection) {
            // Check for pip subsection
            const pipMatch = line.match(/^\s+- pip:\s*$/);
            if (pipMatch) {
                inPipSection = true;
                continue;
            }
            // Check if we're leaving the dependencies section
            if (line.match(/^\w/)) {
                inDependenciesSection = false;
                inPipSection = false;
                continue;
            }
            // Parse package entries (start with -)
            const pkgMatch = line.match(/^\s+-\s*(.+)$/);
            if (pkgMatch) {
                const pkgSpec = pkgMatch[1].trim();
                // Skip pip itself
                if (pkgSpec === 'pip') {
                    continue;
                }
                // Extract package name from conda spec
                // Handles: package, package=1.0.0, package==1.0.0, package>=1.0.0
                const nameMatch = pkgSpec.match(/^([a-zA-Z0-9_-]+)(?:[=<>!~]+.*)?$/);
                if (nameMatch) {
                    const packageName = nameMatch[1].toLowerCase();
                    // Track Python version separately
                    if (packageName === 'python') {
                        const versionMatch = pkgSpec.match(/=(\d+\.\d+(?:\.\d+)?)/);
                        if (versionMatch) {
                            pythonVersion = versionMatch[1];
                        }
                    }
                    packages.push(packageName);
                }
            }
        }
    }
    return {
        packages,
        source: 'conda',
        pythonVersion
    };
}
/**
 * Auto-detect file type and parse
 */
function parseEnvironmentFile(content, filename) {
    // Try to detect based on filename
    if (filename) {
        const lowerFilename = filename.toLowerCase();
        if (lowerFilename.endsWith('.yaml') || lowerFilename.endsWith('.yml')) {
            return parseCondaEnvYaml(content);
        }
        if (lowerFilename.endsWith('.txt') || lowerFilename.includes('requirements')) {
            return parseRequirementsTxt(content);
        }
    }
    // Auto-detect based on content
    if (content.includes('dependencies:') || content.includes('name:')) {
        return parseCondaEnvYaml(content);
    }
    // Default to requirements.txt format
    return parseRequirementsTxt(content);
}
/**
 * Parse package specification with version
 * Returns package name and version separately
 */
function parsePackageSpec(spec) {
    const trimmed = spec.trim();
    // Handle various version specifiers: ==, >=, <=, !=, ~=, >, <, =
    const match = trimmed.match(/^([a-zA-Z0-9_-]+)(?:\[.*?\])?(?:==|>=|<=|!=|~=|>|<|=)?(.*)$/);
    if (match) {
        const name = match[1].toLowerCase();
        const version = match[2] || undefined;
        return { name, version };
    }
    return { name: trimmed.toLowerCase() };
}
//# sourceMappingURL=fileParser.js.map

  // Dark mode module
  /**
 * Dark mode toggle functionality
 * Ported from js/dark_mode.js to TypeScript
 */
/**
 * Check if dark mode should be active based on time of day
 * Active between 7 PM and 6 AM
 */
function shouldDarkModeBeActive() {
    const hour = new Date().getHours();
    return hour >= 19 || hour < 6;
}
/**
 * Initialize dark mode toggle
 */
function initDarkMode() {
    const checkbox = document.getElementById('dark-mode-checkbox');
    if (!checkbox) {
        console.warn('Dark mode checkbox not found');
        return;
    }
    // Auto-detect based on time of day
    if (shouldDarkModeBeActive()) {
        checkbox.checked = true;
        document.body.classList.add('dark-mode');
    }
    // Toggle dark mode on checkbox change
    checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
            document.body.classList.add('dark-mode');
        }
        else {
            document.body.classList.remove('dark-mode');
        }
    });
}
//# sourceMappingURL=darkMode.js.map

  // Citation core module
  /**
 * Frontend citation core - browser-compatible citation logic
 * Wraps shared modules for use in the browser
 */
/**
 * Frontend-compatible data provider
 * Fetches data from local files instead of remote API
 */
class FrontendDataProvider {
    constructor(baseUrl = '') {
        this.citationsPromise = null;
        this.bibtexTablePromise = null;
        this.baseUrl = baseUrl;
    }
    /**
     * Fetch and parse citations.json
     */
    async getCitations() {
        if (!this.citationsPromise) {
            this.citationsPromise = fetch(this.baseUrl + 'data/citations.json')
                .then(response => {
                if (!response.ok) {
                    throw new Error(`Failed to fetch citations: ${response.status}`);
                }
                return response.json();
            });
        }
        return await this.citationsPromise;
    }
    /**
     * Fetch and parse bibtex.bib
     */
    async getBibtexTable() {
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
    async getVersions(packageName) {
        const url = this.baseUrl + `data/zenodo-versions/${encodeURIComponent(packageName)}.json`;
        try {
            const response = await fetch(url);
            if (!response.ok) {
                return [];
            }
            return await response.json();
        }
        catch {
            return [];
        }
    }
    /**
     * Fetch BibTeX from Zenodo API
     */
    async getZenodoBibtex(doi) {
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
        }
        catch (error) {
            console.error(`Error fetching Zenodo bibtex for ${doi}:`, error);
            return '';
        }
    }
    /**
     * Expand packages with their dependencies
     */
    async expandWithDependencies(packages, autoExpand = true) {
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
function parseBibtexFrontend(bibtexText) {
    const bibtexTable = {};
    const bibtexRe = /@\w*{(?<tag>.*?)(?=,)/gms;
    let match;
    while ((match = bibtexRe.exec(bibtexText)) !== null) {
        const tag = match.groups?.tag?.trim();
        if (tag) {
            bibtexTable[tag] = match[0];
        }
    }
    return bibtexTable;
}
//# sourceMappingURL=citationCore.js.map

  // Software UI module
  /**
 * Main frontend application for Software Citation Station
 * Ported from js/software.js to TypeScript with shared module reuse
 */
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
let citations = {};
let bibtexTable = {};
let dataProvider;
/**
 * Capitalize first letter of a string
 */
function capitalize(str) {
    if (!str)
        return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
}
/**
 * Highlight LaTeX syntax for display
 */
function highlightLatex(latex) {
    return latex
        .replace(/\\cite[pt]*\{[^}]*\}/g, '<span class="latex-command">$&</span>')
        .replace(/\\texttt\{[^}]*\}/g, '<span class="latex-command">$&</span>')
        .replace(/\\href\{[^}]*\}\{[^}]*\}/g, '<span class="latex-command">$&</span>');
}
/**
 * Highlight BibTeX for display
 */
function highlightBibtex(bibtex) {
    return bibtex
        .replace(/@\w+/g, '<span class="bibtex-type">$&</span>')
        .replace(/\b\w+\s*=/g, '<span class="bibtex-key">$&</span>');
}
/**
 * Create a copy button for text content
 */
function createCopyButton(text) {
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
function createDownloadButton(text, filename = 'citation.bib') {
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
function collectDependencies(visited, packageName) {
    if (visited.has(packageName)) {
        return [];
    }
    visited.add(packageName);
    const citation = citations[packageName];
    if (!citation?.dependencies) {
        return [packageName];
    }
    const allDeps = [packageName];
    for (const dep of citation.dependencies) {
        allDeps.push(...collectDependencies(visited, dep));
    }
    return allDeps;
}
/**
 * Create an option element
 */
function createOption(value, text) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = text;
    return opt;
}
/**
 * Initialize the software citation station frontend
 */
async function initSoftwareCitationStation() {
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
        const categorySelect = document.getElementById('software-category');
        const languageSelect = document.getElementById('software-language');
        const depToggleBox = document.getElementById('new-software-dependencies');
        if (!templateBtn || !softwareList) {
            console.error('Required DOM elements not found');
            return;
        }
        // Track unique categories and languages
        const categories = new Set();
        const languages = new Set();
        // Sort keys: frequently_used first, then alphabetically
        let sortedKeys = Object.keys(citations).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
        sortedKeys.sort((a, b) => {
            const aFreq = citations[a].frequently_used ?? false;
            const bFreq = citations[b].frequently_used ?? false;
            if (aFreq && !bFreq)
                return -1;
            if (!aFreq && bFreq)
                return 1;
            return 0;
        });
        // Create software buttons
        for (const key of sortedKeys) {
            const citation = citations[key];
            const btn = templateBtn.cloneNode(true);
            btn.setAttribute('data-key', key);
            btn.setAttribute('data-tags', citation.tags?.join(',') || '');
            btn.setAttribute('data-keywords', citation.keywords?.join(',') || '');
            btn.setAttribute('data-pypi-name', citation.pypi_name || '');
            btn.setAttribute('data-dependencies', citation.dependencies?.join(',') || '');
            btn.setAttribute('data-category', capitalize(citation.category));
            const lang = citation.language;
            if (typeof lang === 'string') {
                btn.setAttribute('data-language', capitalize(lang));
            }
            else {
                btn.setAttribute('data-language', lang.map(l => capitalize(l)).join(', '));
            }
            btn.querySelector('.software-name').innerHTML = `<pre>${key}</pre>`;
            btn.id = '';
            // Handle logo
            const logoImg = btn.querySelector('.software-logo');
            if (citation.logo === '') {
                logoImg?.remove();
                const el = document.createElement('span');
                el.className = 'software-no-logo-text';
                el.innerText = key;
                btn.insertBefore(el, btn.querySelector('.software-name'));
            }
            else {
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
                const depToggle = document.getElementById('dependency-template')?.cloneNode(true);
                depToggle.id = '';
                depToggle.innerText = key;
                depToggle.classList.remove('hide');
                depToggle.addEventListener('click', function () {
                    if (this.classList.contains('text-bg-secondary')) {
                        this.classList.remove('text-bg-secondary');
                        this.classList.add('text-bg-primary');
                    }
                    else {
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
            const toSelect = params.get('auto-select').split(',');
            for (const key of toSelect) {
                const btn = document.querySelector(`.software-button[data-key="${key.trim()}"]`);
                if (btn && !btn.classList.contains('active')) {
                    btn.click();
                }
            }
        }
        // Setup event listeners
        setupEventListeners();
    }
    catch (error) {
        console.error('Failed to initialize software citation station:', error);
    }
}
/**
 * Handle software button click
 */
function handleSoftwareClick(btn) {
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
        const visited = new Set();
        const deps = collectDependencies(visited, btn.getAttribute('data-key'));
        const previouslyUnselected = [];
        for (const dep of deps) {
            const depBtn = document.querySelector(`.software-button[data-key="${dep}"]`);
            if (depBtn && !depBtn.classList.contains('active')) {
                previouslyUnselected.push(dep);
                depBtn.classList.add('active');
            }
        }
        if (previouslyUnselected.length > 0) {
            // Show toast notification
            const toast = document.getElementById('toast-template')?.cloneNode(true);
            if (toast) {
                toast.id = '';
                toast.classList.remove('hide');
                toast.querySelector('.main-package').textContent = btn.getAttribute('data-key');
                toast.querySelector('.dependencies').textContent = previouslyUnselected.join(', ');
                document.getElementById('toaster')?.appendChild(toast);
                const bsToast = new window.bootstrap.Toast(toast);
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
function updateCitationDisplay() {
    const ack = document.getElementById('acknowledgement');
    const bibtexBox = document.getElementById('bibtex');
    const activeButtons = document.querySelectorAll('.software-button.active');
    if (!ack || !bibtexBox)
        return;
    if (activeButtons.length === 0) {
        ack.innerHTML = '<i>Acknowledgement will go here</i>';
        bibtexBox.innerHTML = '<i>Bibtex will go here</i>';
        return;
    }
    const ackToAdd = [];
    const customAcksToAdd = [];
    const bibsToAdd = [];
    activeButtons.forEach(btn => {
        const key = btn.getAttribute('data-key');
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
            }
            else {
                ackToAdd.push(highlightLatex(acknowledgement));
            }
        }
        else {
            if (customAck) {
                customAcksToAdd.push(highlightLatex(customAck));
            }
            else {
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
function setupEventListeners() {
    // Software search
    let typingTimer;
    const searchInput = document.getElementById('software-search');
    const searchClear = document.getElementById('software-search-clear');
    const filterClear = document.getElementById('software-filter-clear');
    const categorySelect = document.getElementById('software-category');
    const languageSelect = document.getElementById('software-language');
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
                if (vp)
                    vp.classList.add('hide');
            });
            updateCitationDisplay();
        });
    }
    // File upload
    const fileUploadGo = document.getElementById('file-upload-go');
    const fileUpload = document.getElementById('file-upload');
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
                        const firstOption = select.options[1];
                        if (firstOption) {
                            select.value = firstOption.value;
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
function handleSearch() {
    const searchTerm = document.getElementById('software-search')?.value.toLowerCase() || '';
    const selectedCategory = document.getElementById('software-category')?.value || 'all';
    const selectedLanguage = document.getElementById('software-language')?.value || 'all';
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
        }
        else {
            btn.classList.add('hide');
        }
    });
    // Show/hide "no results" message
    const noResults = document.getElementById('software-search-empty');
    if (noResults) {
        if (visibleCount === 0 && searchTerm) {
            noResults.classList.remove('hide');
        }
        else {
            noResults.classList.add('hide');
        }
    }
}
/**
 * Handle file upload and parse
 */
function handleFileUpload(event) {
    const input = event.target;
    const file = input.files?.[0];
    if (!file)
        return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const content = e.target?.result;
        const filename = file.name.toLowerCase();
        // Parse the file content
        const parsed = parseEnvironmentFile(content, filename);
        // Get citations for dependency expansion
        const autoAddDeps = document.getElementById('auto-deps-toggle')?.classList.contains('active');
        // Expand dependencies if enabled
        let packagesToSelect = parsed.packages;
        if (autoAddDeps) {
            packagesToSelect = expandDependencies(parsed.packages, citations, { autoExpand: true });
        }
        // Select the packages
        for (const pkgName of packagesToSelect) {
            const btn = document.querySelector(`.software-button[data-key="${pkgName}"]`);
            if (btn && !btn.classList.contains('active')) {
                btn.click();
            }
        }
        // Show toast notification
        const toast = document.getElementById('toast-template')?.cloneNode(true);
        if (toast) {
            toast.id = '';
            toast.classList.remove('hide');
            toast.querySelector('.main-package').textContent = file.name;
            toast.querySelector('.dependencies').textContent = `${packagesToSelect.length} packages selected`;
            document.getElementById('toaster')?.appendChild(toast);
            const bsToast = new window.bootstrap.Toast(toast);
            bsToast.show();
            toast.addEventListener('hidden.bs.toast', () => {
                toast.remove();
            });
        }
        // Reset file input
        input.value = '';
    };
    reader.readAsText(file);
}
//# sourceMappingURL=software.js.map

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initDarkMode();
      initSoftwareCitationStation();
    });
  } else {
    initDarkMode();
    initSoftwareCitationStation();
  }
})();
