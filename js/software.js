// bibtex regular expression to extract the tags
const bibtex_re = /@\w*{(?<tag>.*)(?=\,)/gmi;

// latex regular expression to extract each command and arguments
const latex_re = /(?<command>\\[^\\{]*)\{(?<args>[^\}]*)\}/gmi;

// Fetch the data and populate the software list
Promise.all([
    fetch('data/citations.json').then(x => x.json()),
    fetch('data/bibtex.bib').then(x => x.text())
]).then(([citations, bibtex_text]) => {
    // parse the bibtex file
    let bibtex_table = parse_bibtex(bibtex_text);

    // grab the relevant elements from the DOM
    const template_btn = document.getElementById('software-btn-template');
    const software_list = document.getElementById('software-list');
    const ack = document.getElementById("acknowledgement");
    const bibtex_box = document.getElementById("bibtex");

    const category_select = document.getElementById("software-category");
    const language_select = document.getElementById("software-language");

    let categories = new Set();
    let languages = new Set();

    // setup each button
    for (var key in citations) {
        // clone the template button and populate it with the relevant data
        const btn = template_btn.cloneNode(true);
        btn.setAttribute("data-key", key)
        btn.setAttribute("data-tags", citations[key]["tags"].join(","))
        btn.setAttribute("data-keywords", citations[key]["keywords"].join(","))
        btn.setAttribute("data-category", citations[key]["category"])
        btn.setAttribute("data-language", citations[key]["language"])
        btn.querySelector(".software-name").innerHTML = "<pre>" + key + "</pre>";

        if (!categories.has(citations[key]["category"])) {
            categories.add(citations[key]["category"]);
        }

        if (!languages.has(citations[key]["language"])) {
            languages.add(citations[key]["language"]);
        }

        if (citations[key]["logo"] === "") {
            btn.querySelector(".software-logo").remove();
            let el = document.createElement("span");
            el.className = "software-no-logo-text";
            el.innerText = key;
            btn.insertBefore(el, btn.querySelector(".software-name"));
        } else {
            btn.querySelector(".software-logo").src = citations[key]["logo"];
            if (citations[key]["logo_background"]) {
                btn.querySelector(".software-logo").classList.add("bg-white", "p-1");
            }
        }
        btn.id = "";

        // unhide the button and add it to the list
        btn.classList.remove("hide");
        software_list.appendChild(btn);

        let tooltip = new bootstrap.Tooltip(btn, {
            title: function() {
                const details = document.getElementById("details").cloneNode(true);
                details.querySelector(".details-name").innerText = btn.getAttribute("data-key");
                details.querySelector(".details-category").innerText = capitalise(btn.getAttribute("data-category"));
                details.querySelector(".details-language").innerText = capitalise(btn.getAttribute("data-language"));
                details.querySelector(".details-desc").innerText = citations[btn.getAttribute("data-key")]["description"];
                if (btn.querySelector(".software-logo") !== null) {
                    details.querySelector(".details-logo").src = btn.querySelector(".software-logo").src
                } else {
                    details.querySelector(".details-logo").remove();
                }
                details.querySelector(".details-docs").href = citations[btn.getAttribute("data-key")]["link"];
                details.querySelector(".details-cite").href = citations[btn.getAttribute("data-key")]["attribution_link"];

                if (citations[btn.getAttribute("data-key")]["zenodo_doi"] === "") {
                    details.querySelector(".details-doi").remove();
                } else {
                    details.querySelector(".details-doi").href = `https://zenodo.org/doi/${citations[btn.getAttribute("data-key")]["zenodo_doi"]}`;
                }
                return details.innerHTML;
            },
            html: true,
            trigger: 'manual'
        });

        btn.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            e.stopPropagation();
            tooltip.toggle();

            document.querySelectorAll(".software-button").forEach(function(btn) {
                if (btn !== e.target) {
                    bootstrap.Tooltip.getOrCreateInstance(btn).hide();
                }
            });
        });
        
        // add a click event to the button
        btn.addEventListener('click', function() {
            // toggle the active class
            this.classList.toggle("active");

            if (!this.classList.contains("active")) {
                const vp = document.getElementById(`${this.getAttribute("data-key")}-version-picker`);
                if (vp !== null) {
                    vp.classList.add("hide");
                }
            }

            tooltip.hide();

            // keep track of the acknowledgements and bibtex entries to add
            let ack_to_add = [];
            let custom_acks_to_add = [];
            let bibs_to_add = [];

            // remove old download buttons
            document.querySelectorAll(".download-button:not(.hide)").forEach(function(btn) {
                btn.remove();
            });

            let active_buttons = document.querySelectorAll(".software-button.active")

            // if no software is selected then reset the acknowledgement and bibtex
            if (active_buttons.length == 0) {
                ack.innerHTML = "<i>Acknowledgement will go here</i>";
                bibtex_box.innerHTML = "<i>Bibtex will go here</i>";
                bibtex_box.parentElement.querySelector(".btn-group").remove();
                return;
            }

            // loop through all active buttons and add the relevant information
            active_buttons.forEach(function(btn) {
                // get the tags for the current button
                let btn_tags = btn.getAttribute("data-tags").split(",");

                // add the acknowledgement and do some simple latex syntax highlighting
                let new_ack = "\\texttt{" + btn.querySelector(".software-name").innerText + "} \\citep{" + btn_tags.join(", ") + "}"

                const zenodo_doi = citations[btn.getAttribute("data-key")]["zenodo_doi"];
                if (zenodo_doi != "") {
                    const version_picker = document.getElementById(`${btn.getAttribute("data-key")}-version-picker`);
                    if (version_picker == null) {
                        let vp = document.getElementById("version-picker-template").cloneNode(true);
                        vp.id = `${btn.getAttribute("data-key")}-version-picker`;
                        vp.classList.remove("hide");
                        vp.querySelector(".card-title").innerText = btn.getAttribute("data-key");
                        
                        if (citations[btn.getAttribute("data-key")]["logo"] === "") {
                            vp.querySelector(".software-logo").remove();
                            let el = document.createElement("span");
                            el.className = "software-no-logo-text";
                            el.innerText = key;
                            vp.insertBefore(el, vp.querySelector(".card-title"));
                        } else {
                            vp.querySelector(".software-logo").src = citations[btn.getAttribute("data-key")]["logo"];
                        }

                        vp.querySelector(".version-select").addEventListener('change', function() {
                            if (this.value !== "-") {
                                fetch_zenodo_bibtex(this.value).then((bibtex) => {
                                    // replace bibtex tag using regular expression
                                    bibtex = bibtex.replace(bibtex_re, "@software{" + btn.getAttribute("data-key") + "_" + this.value);
                                    vp.setAttribute("data-bibtex", bibtex);
                                    btn.click();
                                    btn.click();
                                })
                            }
                        });

                        get_zenodo_version_info(zenodo_doi, vp);

                        document.getElementById("version-list").appendChild(vp);

                        // create a version picker cloned from the template
                        new_ack += "\\footnote{{TODO}: Need to choose a version to cite!!}"
                    } else {
                        version_picker.classList.remove("hide");
                        if (version_picker.hasAttribute("data-bibtex")) {
                            const chosen_version = version_picker.querySelector(".version-select").value;
                            new_ack = new_ack.slice(0, -1) + ", " + btn.getAttribute("data-key") + "_" + chosen_version + "}";
                            bibs_to_add.push(highlight_bibtex(version_picker.getAttribute("data-bibtex")));
                        } else {
                            new_ack += "\\footnote{{TODO}: Need to choose a version to cite!!}"
                        }
                    }
                }

                const custom_ack = citations[btn.getAttribute("data-key")]["custom_citation"];
                if (custom_ack != "") {
                    custom_acks_to_add.push(highlight_latex(custom_ack));
                } else {
                    ack_to_add.push(highlight_latex(new_ack))
                }

                // same for the bibtex
                if (btn_tags[0] != "") {
                    for (let tag of btn_tags) {
                        bibs_to_add.push(highlight_bibtex(bibtex_table[tag]));
                    }
                }

                const extra_bibtex = citations[btn.getAttribute("data-key")]["extra_bibtex"];
                if (extra_bibtex !== undefined) {
                    bibs_to_add.push(highlight_bibtex(extra_bibtex));
                }
            });

            // clear the acknowledgement
            ack.innerHTML = "";

            // add the acknowledgements
            if (ack_to_add.length != 0) {

                // add a preamble to the acknowledgement
                ack.innerHTML = "This work made use of the following software packages: "

                // add add acknowledgements, joining them with commas and adding an "and" before the last one
                ack.innerHTML += ack_to_add.slice(0, -1).join(', ') + (ack_to_add.length > 1 ? ' and ' : '') + ack_to_add.slice(-1) + '.';
            }

            // add the custom acknowledgements (with extra space between them and the main acknowledgements)
            if (custom_acks_to_add.length != 0 && ack_to_add.length != 0) {
                ack.innerHTML += "\n\n";
            }
            ack.innerHTML += custom_acks_to_add.join("\n\n");
            ack.innerHTML += "\n\n" + highlight_latex("Software citation information aggregated using \\textit{The Software Citation Station} \\citep{software_citation_station}.");

            // add the bibtex entries
            bibs_to_add.push(highlight_bibtex(bibtex_table['software_citation_station']))
            bibtex_box.innerHTML = bibs_to_add.join("\n\n");

            // create a button that copies the contents of each
            ack.appendChild(copy_button(ack.innerText));

            // delete old buttons
            const old_buttons = bibtex_box.parentElement.querySelector(".btn-group")
            if (old_buttons !== null) {
                old_buttons.remove();
            }

            // create a button group with a copy and download button for the bibtex
            let btn_group = document.createElement("div");
            btn_group.className = "btn-group corner-button";
            btn_group.appendChild(copy_button(bibtex_box.innerText));
            btn_group.appendChild(download_button(bibtex_box.innerText));
            bibtex_box.parentElement.appendChild(btn_group);
        });
    }

    for (let cat of [...categories].sort()) {
        const cat_caps = capitalise(cat);
        category_select.appendChild(create_option(cat_caps, cat_caps));
    }

    for (let lang of [...languages].sort()) {
        const lang_caps = capitalise(lang);
        language_select.appendChild(create_option(lang_caps, lang_caps));
    }

    // populate the language and category selects based on the ones on the main page
    const new_software_category = document.getElementById("new-software-category");
    const new_software_language = document.getElementById("new-software-language");

    if (new_software_category.children.length == 0) {
        new_software_category.appendChild(create_option("-", "Select category"));
        for (let i = 0; i < category_select.options.length; i++) {
            if (category_select.options[i].value === "all") {
                continue;
            }
            new_software_category.appendChild(create_option(category_select.options[i].value,
                category_select.options[i].innerText));
        }
        new_software_category.appendChild(create_option("new", "New category"));
    }

    if (new_software_language.children.length == 0) {
        new_software_language.appendChild(create_option("-", "Select language"));
        for (let i = 0; i < language_select.options.length; i++) {
            if (language_select.options[i].value === "all") {
                continue;
            }
            new_software_language.appendChild(create_option(language_select.options[i].value,
                language_select.options[i].innerText));
        }
        new_software_language.appendChild(create_option("new", "New language"));
    }

    document.getElementById("software-loading").classList.add("hide");
});

window.addEventListener('DOMContentLoaded', () => {
    let typingTimer;
    let doneTypingInterval = 200;

    window.addEventListener('click', function(e) {
        if (!e.target.classList.contains("software-button")
            && !e.target.className.includes("details")
            && !e.target.classList.contains("tooltip")
            && !e.target.classList.contains("tooltip-inner")) {
            document.querySelectorAll(".software-button").forEach(function(btn) {
                bootstrap.Tooltip.getOrCreateInstance(btn).hide();
            });
        }
    });

    document.getElementById("software-search-clear").addEventListener('click', function() {
        document.getElementById("software-search").value = "";
        handle_search();
    });

    document.getElementById("software-filter-clear").addEventListener('click', function() {
        document.getElementById("software-category").value = "all";
        document.getElementById("software-language").value = "all";
        handle_search();
    });

    document.getElementById("software-search").addEventListener('input', function() {
        clearTimeout(typingTimer);
        typingTimer = setTimeout(handle_search, doneTypingInterval);
    });

    document.getElementById("software-category").addEventListener('change', handle_search);
    document.getElementById("software-language").addEventListener('change', handle_search); 

    function handle_search() {
        let search = document.getElementById("software-search").value.toLowerCase();
        const btns = document.querySelectorAll(".software-button:not(#software-btn-template)")

        const category = document.getElementById("software-category").value.toLowerCase();
        const language = document.getElementById("software-language").value.toLowerCase();

        let all_hidden = true;
        for (let btn of btns) {
            const btn_key = btn.getAttribute("data-key").toLowerCase();
            const btn_keywords = btn.getAttribute("data-keywords").toLowerCase();
            const matches_search = ((btn_key.includes(search) || btn_keywords.includes(search))
                                    && (category === "all" || btn.getAttribute("data-category").toLowerCase() === category)
                                    && (language === "all" || btn.getAttribute("data-language").toLowerCase() === language));
            if (matches_search) {
                all_hidden = false;
            }
            if (btn.classList.contains("hide") && matches_search) {
                btn.classList.remove("hide");
                animateCSS(btn, "bounceIn");
            } else if (!btn.classList.contains("hide") && !matches_search) {
                // btn.classList.add("hide");
                animateCSS(btn, "bounceOut").then(() => {
                    btn.classList.add("hide");
                });
            }
        }

        // if all buttons are hidden then show a message instead
        const empty_msg = document.getElementById("software-search-empty");
        const msg_hidden = empty_msg.classList.contains("hide");
        if (all_hidden && msg_hidden) {
            setTimeout(() => {
                empty_msg.classList.remove("hide");
                animateCSS(empty_msg, "flipInX");
            }, 500);
            // animateCSS(empty_msg, "bounceIn");
        } else if (!all_hidden && !msg_hidden) {
            empty_msg.classList.add("hide");
        }
    }

    document.getElementById("expand").addEventListener('click', function() {
        const left_col = document.getElementById("left-col");
        const right_col = document.getElementById("right-col");
        if (left_col.classList.contains("col-lg-6")) {
            left_col.classList.remove("col-lg-6");
            left_col.classList.remove("mb-lg-0");
            right_col.classList.remove("col-lg-6");
            this.querySelector("i").className = "fa fa-arrow-left";
            right_col.querySelectorAll(".version-picker").forEach((vp) => {
                const hide_me = vp.classList.contains("hide");
                vp.className = "version-picker col-sm-4 col-lg-2";
                if (hide_me) {
                    vp.classList.add("hide");
                }
            });
        } else {
            left_col.classList.add("col-lg-6");
            left_col.classList.add("mb-lg-0");
            right_col.classList.add("col-lg-6");
            this.querySelector("i").className = "fa fa-arrow-right";
            right_col.querySelectorAll(".version-picker").forEach((vp) => {
                const hide_me = vp.classList.contains("hide");
                vp.className = "version-picker col-sm-6 col-lg-4";
                if (hide_me) {
                    vp.classList.add("hide");
                }
            });
        }
    });

    document.getElementById("software-clear").addEventListener('click', function() {
        let buttons = document.querySelectorAll(".software-button.active")
        for (let i = 0; i < buttons.length - 1; i++) {
            buttons[i].classList.remove("active");
            const vp = document.getElementById(`${buttons[i].getAttribute("data-key")}-version-picker`);
            if (vp !== null) {
                vp.classList.add("hide");
            }
        }
        buttons[buttons.length - 1].click();
    });

    document.querySelectorAll("#version-selector button").forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            const active_btn = this.parentElement.querySelector(".active");
            if (active_btn !== this) {
                active_btn.classList.remove("active");
                this.classList.add("active");
                if (this.id === "latest_version") {
                    // auto select the latest version for each version picker that isn't hidden
                    document.querySelectorAll(".version-picker:not(.hide) .version-select").forEach(function(select) {
                        select.value = select.children[1].value;
                        select.dispatchEvent(new Event('change'));
                    });
                }
            }
        });
    });

    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]')
    const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl))

    document.querySelectorAll("textarea[data-counted]").forEach(function(textarea) {
        console.log(textarea);
        textarea.addEventListener('input', function() {
            const count = this.value.length;
            const max = parseInt(this.getAttribute("maxlength"));
            const remaining = max - count;
            const counter = this.parentElement.querySelector(".character-count");
            counter.innerText = `${count}/${max}`;
            if (remaining == 0) {
                counter.className = "character-count full";
            } else if (remaining < 25) {
                counter.className = "character-count nearly-full";
            } else {
                counter.className = "character-count";
            }
        });
    });

    document.querySelectorAll(".headshot-box").forEach(function(box) {
        box.addEventListener('click', function() {
            window.open(this.getAttribute("data-href"), "_blank");
        });
    });

    document.querySelectorAll("#new-software-category, #new-software-language").forEach(el => {
        el.addEventListener('change', function() {
            if (this.value === "new") {
                this.nextElementSibling.classList.remove("hide");
                this.nextElementSibling.focus();
            } else {
                this.nextElementSibling.classList.add("hide");
            }
        })
    });

    document.getElementById("submit-new-software").addEventListener('click', function(e) {
        const valid = validate_new_software_form();
        e.preventDefault();
        e.stopPropagation();
    });

    document.getElementById("new-software-name").addEventListener('input', function() {
        document.getElementById("new-zenodo-search").href = `https://zenodo.org/search?q=${this.value}`;
    });
});


function create_option(value, label) {
    let opt = document.createElement("option");
    opt.value = value;
    opt.innerText = label;
    return opt;
}


function capitalise(string) {
    return string.replace(/(^\w{1})|(\s+\w{1})/g, letter => letter.toUpperCase());
}

function parse_bibtex(bibtex_text) {
    // parse the bibtex file into a dictionary of tags and entries
    let bibtex_obj = {};
    while ((match = bibtex_re.exec(bibtex_text)) != null) {
        bibtex_obj[match.groups["tag"]] = isolate_bibtex_entry(bibtex_text, match.index);
    }
    return bibtex_obj
}

function isolate_bibtex_entry(s, start) {
    // isolate a bibtex entry based on closing curly braces
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

function highlight_latex(s) {
    // highlight the latex command and arguments with some simple syntax highlighting
    return s.replace(latex_re, function(match, command, args) {
        if (command == "\\footnote") {
            return '<span class="latex-command">' + command + '</span>{' + args + "}";
        } else {
            return '<span class="latex-command">' + command + '</span>{<span class="latex-refs">' + args + "</span>}";
        }
    });
}

function highlight_bibtex(s) {
    // highlight the bibtex entry with some simple syntax highlighting around the format and key
    let at_thing = s.split("{")[0];
    let key = s.split("{")[1].split(",")[0];
    rest_starts_at = at_thing.length + key.length + 1;
    return "<span class='bibtex-format'>" + at_thing + "</span>{<span class='bibtex-key'>" + key + "</span>" + s.slice(rest_starts_at);
}

function copy_button(text) {
    let copy_btn = document.getElementById("copy-template").cloneNode(true);
    copy_btn.classList.remove("hide");
    copy_btn.addEventListener('click', function() {
        navigator.clipboard.writeText(text);
    });
    new bootstrap.Tooltip(copy_btn)
    return copy_btn 
}

function download_button(text) {
    let download_btn = document.getElementById("copy-template").cloneNode(true);
    download_btn.classList.remove("hide");
    download_btn.querySelector("i").classList.remove("fa-copy");
    download_btn.querySelector("i").classList.add("fa-download");
    download_btn.setAttribute("data-bs-title", "Download to file");
    download_btn.addEventListener('click', function() {
        let blob = new Blob([text], {type: "text/plain"});
        let url = URL.createObjectURL(blob);
        let a = document.createElement('a');
        a.href = url;
        a.download = "software.bib";
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
    });
    new bootstrap.Tooltip(download_btn)
    return download_btn
}

const animateCSS = (node, animation, prefix = 'animate__') =>
  // We create a Promise and return it
  new Promise((resolve, reject) => {
    const animationName = `${prefix}${animation}`;

    node.classList.add(`${prefix}animated`, animationName);

    // When the animation ends, we clean the classes and resolve the Promise
    function handleAnimationEnd(event) {
      event.stopPropagation();
      node.classList.remove(`${prefix}animated`, animationName);
      resolve('Animation ended');
    }

    node.addEventListener('animationend', handleAnimationEnd, {once: true});
  });


function convertRemToPixels(rem) {    
    return rem * parseFloat(getComputedStyle(document.documentElement).fontSize);
}

function compare_versions(a, b) {
    if (a === b) {
        return 0;
    }
    if (a[0] == "v") {
        a = a.slice(1);
    }
    if (b[0] == "v") {
        b = b.slice(1);
    }
    let splitA = a.split('.');
    let splitB = b.split('.');
    const length = Math.max(splitA.length, splitB.length);
    for (let i = 0; i < length; i++) {
        if (parseInt(splitA[i]) > parseInt(splitB[i]) || ((splitA[i] === splitB[i]) && isNaN(splitB[i + 1]))) {
            return 1;
        }
        if (parseInt(splitA[i]) < parseInt(splitB[i]) || ((splitA[i] === splitB[i]) && isNaN(splitA[i + 1]))) {
            return -1;
        }
    }
}

// Function to fetch records from Zenodo API
async function get_zenodo_version_info(concept_doi, vp) {
    // Build the complete URL with the query parameter for concept DOI
    const url = `https://zenodo.org/api/records?q=conceptdoi:"${concept_doi}"&all_versions=true`;
    try {
        // Make the API request with the Accept header for BibTeX format
        const response = await fetch(url);
        
        // Check if the response is OK (status code 200-299)
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const data = await response.json();

        let version_and_doi = []
        let versions_so_far = new Set()
        for (let hit of data.hits.hits) {
            if (!versions_so_far.has(hit.metadata.version)) {
                version_and_doi.push({"version": hit.metadata.version, "doi": hit.id})
                versions_so_far.add(hit.metadata.version)
            }
        }

        version_and_doi.sort(function(a, b) {
            return compare_versions(a.version, b.version);
        }).reverse();

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

// Function to fetch records from Zenodo API
async function validate_zenodo_doi(concept_doi) {
    if (concept_doi === "") {
        return 0;
    }
    // Build the complete URL with the query parameter for concept DOI
    const url = `https://zenodo.org/api/records?q=conceptdoi:"${concept_doi}"&all_versions=true`;
    // Make the API request with the Accept header for BibTeX format
    const response = await fetch(url);
    
    if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const data = await response.json();
    return data.hits.hits.length;
}

// Function to fetch records from Zenodo API
async function fetch_zenodo_bibtex(doi) {
    // Build the complete URL with the query parameter for concept DOI
    const url = `https://zenodo.org/api/records/${doi}`;
    try {
        // Make the API request with the Accept header for BibTeX format
        const response = await fetch(url, {
            headers: {
                'Accept': 'application/x-bibtex'
            }
        });
        
        // Check if the response is OK (status code 200-299)
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        // Get the text response (BibTeX format)
        const data = await response.text();
        return data;
    } catch (error) {
        console.error('Error fetching records:', error);
    }
}

function validate_new_software_form() {
    /* validate the input fields in the new software form */
    let form = document.querySelector(".new-software-form");
    const loader = form.parentElement.querySelector(".loading-overlay");
    loader.classList.remove("hide");
    animateCSS(loader, "fadeIn");

    // check the URL fields and add the https:// if it's missing
    for (let input of form.querySelectorAll("input[type='url']")) {
        let url = input.value.trim();

        if (url.startsWith('www.') && !url.startsWith('http://') && !url.startsWith('https://')) {
            input.value = 'https://' + url;
        }
        input.parentElement.querySelector(".valid-feedback a").href = input.value;
    }

    // attempt to parse the BibTeX field
    const bibtex_field = form.querySelector("#new-software-bibtex");
    const bibtex = parse_bibtex(bibtex_field.value.trim());
    if (Object.keys(bibtex).length === 0) {
        bibtex_field.setCustomValidity("Invalid field.");
    } else {
        bibtex_field.setCustomValidity("")
        let tags = []
        for (let key in bibtex) {
            tags.push(`<span class='badge text-bg-success'>${key}</span>`);
        }
        bibtex_field.parentElement.querySelector(".valid-feedback").innerHTML = "Valid BibTeX! Tags detected: " + tags.join(" ");
    }

    // escape backslashes in the custom acknowledgement
    const custom = form.querySelector("#new-software-custom-acknowledgement");
    custom.value = custom.value.trim().replace(/(?<!\\)\\(?!\\)/gm, '\\\\');

    validate_zenodo_doi(document.querySelector("#new-software-doi").value).then((n_versions) => {
        console.log(n_versions);
        const allow_single_version = form.querySelector("#new-software-single-version");
        if (n_versions === 0) {
            form.querySelector("#new-software-doi").setCustomValidity("DOI not found on Zenodo.");
            console.log(allow_single_version.parentElement.parentElement.querySelector(".invalid-feedback"))
            allow_single_version.parentElement.parentElement.querySelector(".invalid-feedback").innerHTML = "Invalid DOI. Please ensure you have the correct DOI for <b>all</b> versions of the software (hover over the question mark above for instructions).";
        } else if (n_versions === 1 && !allow_single_version.querySelector("input").checked) {
            form.querySelector("#new-software-doi").setCustomValidity("DOI only has one version");
            allow_single_version.classList.remove("hide");
            allow_single_version.parentElement.parentElement.querySelector(".invalid-feedback").innerHTML = "This DOI only has one version - did you ensure to choose the DOI that matches <b>all</b> versions of the software (hover over the question mark above for instructions)?. If only one version is released so far, please check the box above and resubmit.";
        } else {
            form.querySelector("#new-software-doi").setCustomValidity("");
            allow_single_version.classList.add("hide");
            allow_single_version.parentElement.parentElement.querySelector(".valid-feedback").innerHTML = "DOI found on Zenodo with " + n_versions + " versions.";
        }

        // perform the rest of the validation
        let valid = form.checkValidity();
        if (valid) {
            let data = new FormData(form);
            let json = {};
            for (let [key, value] of data.entries()) {
                json[key] = value;
            }
            console.log(json);
        }
        form.classList.add('was-validated');
        loader.classList.add("hide");
    });

    return false;
}