// bibtex regular expression to extract the tags
export const bibtex_re = /@\w*{(?<tag>.*)(?=\,)/gmi;

// latex regular expression to extract each command and arguments
export const latex_re = /(?<command>\\[^\\{]*)\{(?<args>[^\}]*)\}/gmi;

// parse the bibtex file into a dictionary of tags and entries
export function parseBibtex(bibtex_text) {
    let bibtex_obj = {};
    let match;
    // reset regex index
    bibtex_re.lastIndex = 0;
    while ((match = bibtex_re.exec(bibtex_text)) != null) {
        bibtex_obj[match.groups["tag"]] = isolateBibtexEntry(bibtex_text, match.index);
    }
    return bibtex_obj
}

// isolate a bibtex entry based on closing curly braces
export function isolateBibtexEntry(s, start) {
    let braces = 0;
    let cursor = start;
    let not_opened = true;
    while (braces > 0 || not_opened) {
        if (s[cursor] == "{") {
            braces += 1
            not_opened = false
        } else if (s[cursor] == "}") {
            braces -= 1
        }
        cursor += 1
    }
    return s.slice(start, cursor)
}

// recursively gather dependencies for a given software package
export function collectDependencies(dep_set, id) {
    // recursively gather dependencies for a given software package
    const software_btn = document.querySelector(\`.software-button[data-key='\${id}']\`)
    if (software_btn === null) {
        return dep_set;
    }
    const new_deps = software_btn.getAttribute("data-dependencies");

    if (new_deps !== "") {
        for (let dep of new_deps.split(",")) {
            if (!dep_set.has(dep)) {
                dep_set.add(dep);
                dep_set.add(...collectDependencies(dep_set, dep));
            }
        }
    }
    return dep_set;
}

// Function to fetch records from Zenodo API
export async function fetchZenodoBibtex(doi) {
    // Build the complete URL with the query parameter for concept DOI
    const url = \`https://zenodo.org/api/records/\${doi}\`;
    try {
        // Make the API request with the Accept header for BibTeX format
        const response = await fetch(url, {
            headers: {
                'Accept': 'application/x-bibtex'
            }
        });
        
        // Check if the response is OK (status code 200-299)
        if (!response.ok) {
            throw new Error(\`HTTP error! Status: \${response.status}\`);
        }
        
        // Get the text response (BibTeX format)
        const data = await response.text();
        return data;
    } catch (error) {
        console.error('Error fetching records:', error);
    }
}

// Function to fetch records from Zenodo API
export async function getZenodoVersionInfo(concept_doi, vp) {
    // Build the complete URL with the query parameter for concept DOI
    const PAGE_SIZE = 25;
    const base_url = \`https://zenodo.org/api/records?q=conceptdoi:"\${concept_doi}"&all_versions=true&size=\${PAGE_SIZE}\`;
    try {
        // keep track of which versions we've seen so far
        let version_and_doi = []
        let versions_so_far = new Set()

        // start with an absurd number of expected versions to enter the loop
        let expected_versions = 100000;
        let n_bad_versions = 0;
        let page = 1;

        while (version_and_doi.length + n_bad_versions < expected_versions) {
            let url = base_url + \`&page=\${page}\`;

            // NOTE: THIS ASSUMES NO SOFTWARE HAS MORE THAN 1000 (40 * 25) VERSIONS, CHANGE IF NECESSARY
            if (page > 40) {
                console.warn(\`Exceeded 40 pages of results for concept DOI \${concept_doi}. Stopping further requests to avoid rate limiting.\`);
                console.log(\`Fetched \${version_and_doi.length} versions so far.\`);
                console.log(version_and_doi)
                break;
            }

            // make the API request with the Accept header for BibTeX format
            const response = await fetch(url);

            // check if it's a 429 (too many requests) error
            if (response.status === 429) {
                const rateLimitResetHeader = response.headers.get('x-ratelimit-reset');
                let waitTime = 60000;     // default wait time of 60 seconds
                if (rateLimitResetHeader) {
                    const resetTimeInMilliseconds = parseInt(rateLimitResetHeader, 10) * 1000;
                    const currentTime = Date.now();
                    waitTime = Math.max(0, resetTimeInMilliseconds - currentTime);
                }
                console.warn(\`Received 429 Too Many Requests response. Retrying after \${waitTime}ms...\`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                continue;   // retry the same page
            }
            
            // check if the response is OK (status code 200-299)
            if (!response.ok) {
                throw new Error(\`HTTP error! Status: \${response.status}\`);
            }
            
            const data = await response.json();

            // update the expected versions based on the total hits
            expected_versions = data.hits.total;

            for (let hit of data.hits.hits) {
                if (!versions_so_far.has(hit.metadata.version) && hit.metadata.version !== undefined) {
                    version_and_doi.push({"version": hit.metadata.version, "doi": hit.id})
                    versions_so_far.add(hit.metadata.version)
                } else {
                    n_bad_versions += 1;
                }
            }
            page += 1;
        }

        const select = vp.querySelector(".version-select")
        for (let i = 0; i < version_and_doi.length; i++) {
            let opt = document.createElement("option")
            opt.value = version_and_doi[i].doi;
            opt.innerText = version_and_doi[i].version;
            select.appendChild(opt);
        }

        vp.querySelector(".waiter").classList.add("hide");
        vp.querySelector(".version-select").classList.remove("hide");

        // if user just wants to select the latest version then do it
        if (document.getElementById("latest_version").classList.contains("active")) {
            select.value = version_and_doi[0].doi;
            select.dispatchEvent(new Event('change'));
        }
    } catch (error) {
        // Handle errors
        console.error('Error fetching records:', error);
    }
}

export function parseFeatureTags(arr) {
    /* Convert [{name: "tag"}, ...] to a flat {name: "tag"} lookup object */
    const out = {};
    for (const item of arr) {
        const k = Object.keys(item)[0];
        out[k] = item[k];
    }
    return out;
}

export function parsePackageInput(line) {
    line = line.trim();
    if (line === "" || line.startsWith("#")) {
        return null;
    }
    const [key, version] = line.split("==");
    return {name: key.toLowerCase(), version: version};
}
