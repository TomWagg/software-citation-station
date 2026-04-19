/**
 * Regular expression to extract the tags from BibTeX.
 */
export const bibtex_re = /@\w*{(?<tag>.*)(?=\,)/gmi;

/**
 * Regular expression to extract each LaTeX command and arguments.
 */
export const latex_re = /(?<command>\\[^\\{]*)\{(?<args>[^\}]*)\}/gmi;

/**
 * Parse the bibtex file into a dictionary of tags and entries.
 * @param {string} bibtex_text - The raw BibTeX text.
 * @returns {Object} A map of tag to BibTeX entry.
 */
export function parseBibtex(bibtex_text) {
    let bibtex_obj = {};
    let match;
    // reset regex index
    bibtex_re.lastIndex = 0;
    while ((match = bibtex_re.exec(bibtex_text)) != null) {
        bibtex_obj[match.groups["tag"]] = isolateBibtexEntry(bibtex_text, match.index);
    }
    return bibtex_obj;
}

/**
 * Isolate a bibtex entry based on closing curly braces.
 * @param {string} s - The text containing the BibTeX entry.
 * @param {number} start - The starting index of the entry.
 * @returns {string} The isolated BibTeX entry.
 */
export function isolateBibtexEntry(s, start) {
    let braces = 0;
    let cursor = start;
    let not_opened = true;
    while (braces > 0 || not_opened) {
        if (s[cursor] == "{") {
            braces += 1;
            not_opened = false;
        } else if (s[cursor] == "}") {
            braces -= 1;
        }
        cursor += 1;
    }
    return s.slice(start, cursor);
}

/**
 * Recursively gather dependencies for a given software package.
 * @param {Set<string>} depSet - The set to store dependencies.
 * @param {string} packageKey - The key of the package to collect dependencies for.
 * @param {Object} citationsData - The full citations data object.
 * @returns {Set<string>} The updated dependency set.
 */
export function collectDependencies(depSet, packageKey, citationsData) {
    const entry = citationsData[packageKey];
    if (!entry) return depSet;
    const dependencies = entry.dependencies || [];
    for (let dep of dependencies) {
        if (!depSet.has(dep)) {
            depSet.add(dep);
            collectDependencies(depSet, dep, citationsData);
        }
    }
    return depSet;
}

/**
 * Function to fetch records from Zenodo API.
 * @param {string} doi - The record DOI.
 * @returns {Promise<string>} The BibTeX string from Zenodo.
 */
export async function fetchZenodoBibtex(doi) {
    const url = `https://zenodo.org/api/records/${doi}`;
    try {
        const response = await fetch(url, {
            headers: {
                'Accept': 'application/x-bibtex'
            }
        });
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return await response.text();
    } catch (error) {
        console.error('Error fetching records:', error);
        throw error;
    }
}

/**
 * Function to fetch version info from Zenodo API.
 * @param {string} concept_doi - The concept DOI of the software.
 * @returns {Promise<Array<{version: string, doi: string}>>} List of versions and their record DOIs.
 */
export async function getZenodoVersionInfo(concept_doi) {
    const PAGE_SIZE = 25;
    const base_url = `https://zenodo.org/api/records?q=conceptdoi:"${concept_doi}"&all_versions=true&size=${PAGE_SIZE}`;
    try {
        let version_and_doi = [];
        let versions_so_far = new Set();
        let expected_versions = 100000;
        let n_bad_versions = 0;
        let page = 1;

        while (version_and_doi.length + n_bad_versions < expected_versions) {
            let url = base_url + `&page=${page}`;
            if (page > 40) break;

            const response = await fetch(url);
            if (response.status === 429) {
                const rateLimitResetHeader = response.headers.get('x-ratelimit-reset');
                let waitTime = 60000;
                if (rateLimitResetHeader) {
                    const resetTimeInMilliseconds = parseInt(rateLimitResetHeader, 10) * 1000;
                    waitTime = Math.max(0, resetTimeInMilliseconds - Date.now());
                }
                await new Promise(resolve => setTimeout(resolve, waitTime));
                continue;
            }
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            
            const data = await response.json();
            expected_versions = data.hits.total;

            for (let hit of data.hits.hits) {
                if (!versions_so_far.has(hit.metadata.version) && hit.metadata.version !== undefined) {
                    version_and_doi.push({"version": hit.metadata.version, "doi": hit.id});
                    versions_so_far.add(hit.metadata.version);
                } else {
                    n_bad_versions += 1;
                }
            }
            page += 1;
        }
        return version_and_doi;
    } catch (error) {
        console.error('Error fetching records:', error);
        throw error;
    }
}

/**
 * Convert feature_tags array to lookup object.
 * @param {Array} arr - The feature_tags array.
 * @returns {Object} A map of feature name to tags array.
 */
export function parseFeatureTags(arr) {
    const out = {};
    for (const item of arr) {
        const k = Object.keys(item)[0];
        out[k] = item[k];
    }
    return out;
}

/**
 * Parse package name, version and features from a string.
 * @param {string} packageString - e.g. "numpy", "astropy==6.0.1", "astropy[fitting,io]"
 * @returns {Object} Parsed package info {name, version, features}.
 */
export function parsePackageInput(packageString) {
    const match = packageString.match(/^([^=\[\]]+)(?:==([^\[\]]+))?(?:\[([^\]]+)\])?$/);
    if (!match) return { name: packageString.trim().toLowerCase() };
    
    const name = match[1].trim().toLowerCase();
    const version = match[2] ? match[2].trim() : undefined;
    const features = match[3] ? match[3].split(",").map(f => f.trim()) : undefined;
    
    return { name, version, features };
}

/**
 * Generate LaTeX acknowledgment string.
 * @param {string[]} selectedPackages - List of selected package keys.
 * @param {Object} citationsData - Full citations.json data.
 * @param {Object} featureSelections - Map of packageKey -> selectedFeatures[].
 * @param {Map<string, Object>} zenodoBibtexMap - Map of packageKey -> {bibtex, tag}.
 * @returns {string} The generated LaTeX acknowledgment.
 */
export function generateAcknowledgment(selectedPackages, citationsData, featureSelections = {}, zenodoBibtexMap = new Map()) {
    if (selectedPackages.length === 0) return "";

    let acks = [];
    let customAcks = [];
    let featureSentences = [];

    for (const key of selectedPackages) {
        const entry = citationsData[key];
        if (!entry) continue;

        let tags = [...(entry.tags || [])];
        const zenodoInfo = zenodoBibtexMap.get(key);
        let zenodoTag = zenodoInfo ? zenodoInfo.tag : null;

        let pkgAck = `\\texttt{${key}}`;
        let mainTags = [...tags];
        if (zenodoTag) {
            mainTags.push(zenodoTag);
        }
        
        if (mainTags.length > 0) {
            pkgAck += ` \\citep{${mainTags.join(",")}}`;
        } else if (entry.zenodo_doi && !zenodoTag) {
            pkgAck += "\\footnote{{TODO}: Need to choose a version to cite!!}";
        }
        acks.push(pkgAck);

        let customAck = entry.custom_citation || "";
        if (customAck) {
            if (zenodoTag) {
                if (customAck.includes("\\citep")) {
                     let open_braces = 0;
                     const citepIdx = customAck.indexOf("\\citep");
                     for (let i = citepIdx + 6; i < customAck.length; i++) {
                         if (customAck[i] == "{") {
                             open_braces += 1;
                         } else if (customAck[i] == "}") {
                             open_braces -= 1;
                         }
                         if (open_braces == 0) {
                             customAck = customAck.slice(0, i) + "," + zenodoTag + customAck.slice(i);
                             break;
                         }
                     }
                } else {
                     if (customAck.endsWith(".")) customAck = customAck.slice(0, -1);
                     customAck += ` \\citep{${zenodoTag}}.`;
                }
            } else if (entry.zenodo_doi) {
                customAck += "\\footnote{{TODO}: Need to choose a version to cite!!}";
            }
            customAcks.push(customAck);
        }

        const selectedFeatures = featureSelections[key] || [];
        if (selectedFeatures.length > 0 && entry.feature_tags) {
            const featureTagsLookup = parseFeatureTags(entry.feature_tags);
            const featureParts = selectedFeatures.map(f => {
                const fTags = featureTagsLookup[f] || [];
                return `\\texttt{${f}} \\citep{${fTags.join(",")}}`;
            });
            
            let featureList;
            if (featureParts.length === 1) {
                featureList = featureParts[0];
            } else if (featureParts.length === 2) {
                featureList = featureParts[0] + " and " + featureParts[1];
            } else {
                featureList = featureParts.slice(0, -1).join(", ") + ", and " + featureParts[featureParts.length - 1];
            }
            featureSentences.push(`The following features of \\texttt{${key}} were used: ${featureList}.`);
        }
    }

    let result = "This research made use of ";
    if (acks.length === 1) {
        result += acks[0];
    } else if (acks.length === 2) {
        result += acks[0] + " and " + acks[1];
    } else {
        result += acks.slice(0, -1).join(", ") + ", and " + acks[acks.length - 1];
    }
    result += ".";

    if (customAcks.length > 0) {
        result += " " + customAcks.join(" ");
    }
    
    if (featureSentences.length > 0) {
        result += " " + featureSentences.join(" ");
    }

    return result;
}

/**
 * Generate BibTeX string for selected packages.
 * @param {string[]} selectedPackages - List of selected package keys.
 * @param {Object} citationsData - Full citations.json data.
 * @param {Object} bibtexTable - Map of tag to BibTeX entry.
 * @param {Object} featureSelections - Map of packageKey -> selectedFeatures[].
 * @param {Map<string, Object>} zenodoBibtexMap - Map of packageKey -> {bibtex, tag}.
 * @returns {string} The combined BibTeX entries.
 */
export function generateBibtex(selectedPackages, citationsData, bibtexTable, featureSelections = {}, zenodoBibtexMap = new Map()) {
    let bibs = [];
    
    for (const key of selectedPackages) {
        const entry = citationsData[key];
        if (!entry) continue;

        for (const tag of (entry.tags || [])) {
            if (bibtexTable[tag]) {
                bibs.push(bibtexTable[tag]);
            }
        }

        const zenodoInfo = zenodoBibtexMap.get(key);
        if (zenodoInfo && zenodoInfo.bibtex) {
            bibs.push(zenodoInfo.bibtex);
        }

        const selectedFeatures = featureSelections[key] || [];
        if (selectedFeatures.length > 0 && entry.feature_tags) {
            const featureTagsLookup = parseFeatureTags(entry.feature_tags);
            for (const f of selectedFeatures) {
                const fTags = featureTagsLookup[f] || [];
                for (const tag of fTags) {
                    if (bibtexTable[tag]) {
                        bibs.push(bibtexTable[tag]);
                    }
                }
            }
        }
    }

    return [...new Set(bibs)].join("\n\n");
}
