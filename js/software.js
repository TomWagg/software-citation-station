// bibtex regular expression to extract the tags
const bibtex_re = /@\w*{(?<tag>.*)(?=\,)/gmi;

// latex regular expression to extract each command and arguments
const latex_re = /(?<command>\\[^\\{]*)\{(?<args>[^\}]*)\}/gmi;

// starting text for new GitHub issues for new software
const base_issue_text = `# TODO before submitting

- [ ] Attach or link a logo (preferably square, no background)
    - If no logo is available then instead write that in a comment and change the data to have \`"logo": ""\` 
- [ ] Update the logo file extension in the data below (change ".png" to the correct extension)
- [ ] Optionally add comments to the issue with questions or additional information

**Delete this list before submitting the issue!**

# Citation information\n`

// cite badge HTML
const badge_html = `<a href="https://www.tomwagg.com/software-citation-station/?auto-select=PACKAGENAME">
    <img src="https://img.shields.io/badge/Cite-PACKAGENAME-blue" alt="GitHub badge" />
</a>`

// Fetch the citation data and populate the software list
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
    const dep_toggle_box = document.getElementById("new-software-dependencies");

    // track the unique categories and languages
    let categories = new Set();
    let languages = new Set();

    // sort the keys alphabetically
    let sorted_keys = Object.keys(citations).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

    // additionally sort keys by whether they citations[key]["frequently_used"] exists and is true
    sorted_keys.sort((a, b) => {
        const a_freq = citations[a].hasOwnProperty("frequently_used") && citations[a]["frequently_used"];
        const b_freq = citations[b].hasOwnProperty("frequently_used") && citations[b]["frequently_used"];
        if (a_freq && !b_freq) {
            return -1;
        } else if (!a_freq && b_freq) {
            return 1;
        } else {
            return 0;
        }
    });

    // setup each button
    for (var key of sorted_keys) {
        // clone the template button and populate it with the relevant data
        const btn = template_btn.cloneNode(true);
        btn.setAttribute("data-key", key)
        btn.setAttribute("data-tags", citations[key]["tags"].join(","))
        btn.setAttribute("data-keywords", citations[key]["keywords"].join(","))
        btn.setAttribute("data-pypi-name", citations[key]["pypi-name"] || "")

        if (citations[key].hasOwnProperty("dependencies")) {
            btn.setAttribute("data-dependencies", citations[key]["dependencies"].join(","))
        } else {
            btn.setAttribute("data-dependencies", "")
        }
        btn.querySelector(".software-name").innerHTML = "<pre>" + key + "</pre>";
        btn.id = "";

        // track all unique categories and languages
        const cat = citations[key]["category"];
        if (Array.isArray(cat)) {
            btn.setAttribute("data-category", cat.map(x => capitalise(x)).join(", "));
            for (let x of cat) {
                categories.add(capitalise(x));
            }
        } else {
            btn.setAttribute("data-category", capitalise(cat));
            categories.add(capitalise(cat));
        }

        const lang = citations[key]["language"];
        if (Array.isArray(lang)) {
            btn.setAttribute("data-language", lang.map(x => capitalise(x)).join(", "));
            for (let x of lang) {
                languages.add(capitalise(x));
            }
        } else {
            btn.setAttribute("data-language", capitalise(lang));
            languages.add(capitalise(lang));
        }

        // if the logo is missing then remove the image and add a text element instead
        if (citations[key]["logo"] === "") {
            btn.querySelector(".software-logo").remove();
            let el = document.createElement("span");
            el.className = "software-no-logo-text";
            el.innerText = key;
            btn.insertBefore(el, btn.querySelector(".software-name"));
        } else {
            btn.querySelector(".software-logo").src = citations[key]["logo"];
            btn.querySelector(".software-logo").alt = key;

            // if the logo needs a white background then add the relevant classes
            if (citations[key]["logo_background"]) {
                btn.querySelector(".software-logo").classList.add("bg-white", "p-1");
            }
        }

        // unhide the button and add it to the list
        btn.classList.remove("hide");
        software_list.appendChild(btn);

        // add this as an option for the new software dependencies
        const dep_toggle = document.getElementById("dependency-template").cloneNode(true);
        dep_toggle.id = "";
        dep_toggle.innerText = key;
        dep_toggle.classList.remove("hide");
        dep_toggle.addEventListener('click', function() {
            if (this.classList.contains("text-bg-secondary")) {
                this.classList.remove("text-bg-secondary");
                this.classList.add("text-bg-primary");
            } else {
                this.classList.remove("text-bg-primary");
                this.classList.add("text-bg-secondary");
            }
        });

        // add a break between the two sections of alphabetically sorted dependencies
        latest_dep = dep_toggle_box.lastChild.innerText;
        if (latest_dep !== undefined && latest_dep.toLowerCase()[0] > key.toLowerCase()[0]) {
            dep_toggle_box.appendChild(document.createElement("br"));
        }
        dep_toggle_box.appendChild(dep_toggle);

        // create a new tooltip that will appear on right clicking the button
        let tooltip = new bootstrap.Tooltip(btn, {
            title: function() {
                // update all of the details
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

                // add the zenodo DOI if it exists
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

        // make it so right-clicking opens the tooltip and closes all other tooltips
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

            // if the button is now un-selected then hide the version/feature picker if it exists
            if (!this.classList.contains("active")) {
                const vp = document.getElementById(`${this.getAttribute("data-key")}-version-picker`);
                if (vp !== null) {
                    vp.classList.add("hide");
                }
            } else {
                // check whether the user wants to automatically add dependencies
                const auto_add_deps = document.getElementById("auto-deps-toggle").classList.contains("active");

                if (auto_add_deps) {

                    // if the package has dependencies, find all of them and select them
                    const deps = collect_dependencies(new Set(), this.getAttribute("data-key"));
                    let previously_unselected = [];
                    for (let dep of deps) {
                        const dep_btn = document.querySelector(`.software-button[data-key="${dep}"]`);
                        if (dep_btn !== null && !dep_btn.classList.contains("active")) {
                            previously_unselected.push(dep);
                            dep_btn.classList.add("active");
                        }
                    }

                    // if we've selected any new dependencies then post a toast
                    if (previously_unselected.length > 0) {
                        // post a toast letting the user know we've selected them
                        let toast = document.getElementById("toast-template").cloneNode(true);
                        toast.querySelector(".toast-body .main-package").innerText = this.getAttribute("data-key");
                        toast.querySelector(".toast-body .dependencies").innerText = previously_unselected.join(", ");
                        document.getElementById("toaster").appendChild(toast);

                        bootstrap.Toast.getOrCreateInstance(toast).show();

                        // remove the toast once it's hidden
                        toast.addEventListener('hidden.bs.toast', () => {
                            toast.remove();
                        })
                    }
                }
            }

            // hide the tooltip if it's open
            tooltip.hide();

            // keep track of the acknowledgements and bibtex entries to add
            let ack_to_add = [];
            let custom_acks_to_add = [];
            let bibs_to_add = [];
            let feature_sentences_to_add = [];

            // remove any old download buttons
            document.querySelectorAll(".download-button:not(.hide)").forEach(function(btn) {
                btn.remove();
            });

            // get all active buttons
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
                const btn_key = btn.getAttribute("data-key");
                // get the tags for the current button
                let btn_tags = btn.getAttribute("data-tags").split(",");

                // collect selected feature citations (kept separate from main tags)
                const feature_tags_raw = citations[btn_key]["feature_tags"];
                const feature_tags_data = feature_tags_raw !== undefined ? parse_feature_tags(feature_tags_raw) : undefined;
                let selected_feature_data = [];
                if (feature_tags_data !== undefined) {
                    const picker_el = document.getElementById(`${btn_key}-version-picker`);
                    if (picker_el !== null) {
                        const selected_features = (picker_el.getAttribute("data-selected-features") || "").split(",").filter(Boolean);
                        for (const feature of selected_features) {
                            const fdata = feature_tags_data[feature];
                            // a feature's direct tags produce the "features used"
                            // sentence; its dependencies are added as separate
                            // packages (handled at feature-selection time)
                            if (fdata && fdata.tags && fdata.tags.length > 0) {
                                selected_feature_data.push({ name: feature, tags: fdata.tags });
                            }
                        }
                    }
                }

                // deduplicate main tags only
                btn_tags = [...new Set(btn_tags)];

                // add the acknowledgement and do some simple latex syntax highlighting
                const software_name = btn.querySelector(".software-name").innerText;
                let new_ack = "\\texttt{" + software_name + "}";
                if (btn_tags.length > 0 && btn_tags[0] !== "") {
                    new_ack += " \\citep{" + btn_tags.join(",") + "}";
                }

                // build feature sentence separately so it isn't folded into the comma-joined software list
                if (selected_feature_data.length > 0) {
                    const feature_parts = selected_feature_data.map(f =>
                        `\\texttt{${f.name}} \\citep{${f.tags.join(",")}}`
                    );
                    let feature_list;
                    if (feature_parts.length === 1) {
                        feature_list = feature_parts[0];
                    } else if (feature_parts.length === 2) {
                        feature_list = feature_parts[0] + " and " + feature_parts[1];
                    } else {
                        feature_list = feature_parts.slice(0, -1).join(", ") + ", and " + feature_parts[feature_parts.length - 1];
                    }
                    feature_sentences_to_add.push(
                        highlight_latex(`The following features of \\texttt{${software_name}} were used: ${feature_list}.`)
                    );
                    // add feature bibtex entries
                    for (const f of selected_feature_data) {
                        for (const tag of f.tags) {
                            if (bibtex_table[tag]) bibs_to_add.push(highlight_bibtex(bibtex_table[tag]));
                        }
                    }
                }

                // check if the software has a custom acknowledgement
                let custom_ack = citations[btn.getAttribute("data-key")]["custom_citation"];

                // check if the software has a zenodo DOI
                const zenodo_doi = citations[btn.getAttribute("data-key")]["zenodo_doi"];
                if (zenodo_doi != "") {
                    const version_picker = document.getElementById(`${btn.getAttribute("data-key")}-version-picker`);

                    // if the version picker doesn't exist then create it
                    if (version_picker == null) {
                        let vp = document.getElementById("version-picker-template").cloneNode(true);
                        vp.id = `${btn.getAttribute("data-key")}-version-picker`;
                        vp.classList.remove("hide");
                        vp.querySelector(".card-title").innerText = btn.getAttribute("data-key");

                        // store in the html data that it hasn't fully loaded yet
                        vp.setAttribute("data-loaded", "false");
                        
                        // if the software has no logo then remove the image and add a text element instead
                        if (citations[btn.getAttribute("data-key")]["logo"] === "") {
                            vp.querySelector(".software-logo").remove();
                            let el = document.createElement("span");
                            el.className = "software-no-logo-text";
                            el.innerText = btn.getAttribute("data-key");
                            const card_body = vp.querySelector(".card-body");
                            card_body.insertBefore(el, card_body.querySelector(".card-title"));
                        } else {
                            vp.querySelector(".software-logo").src = citations[btn.getAttribute("data-key")]["logo"];
                            vp.querySelector(".software-logo").alt = btn.getAttribute("data-key");
                        }

                        // if the dropdown value is changed then trigger an update to the bibtex
                        // (cheating by just clicking twice)
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

                        // update the version picker with available versions
                        get_zenodo_version_info_cached(
                            btn.getAttribute("data-key"),
                            citations[btn.getAttribute("data-key")]["zenodo_doi"],
                            vp
                        ).then(() => {
                            vp.setAttribute("data-loaded", "true");
                        });
                        document.getElementById("version-list").appendChild(vp);

                        // if the software has feature_tags, show and wire up the feature button
                        if (feature_tags_data !== undefined) {
                            attach_feature_btn(vp, btn_key, feature_tags_data);
                        }

                        // make a note that the user needs to select a version
                        new_ack += "\\footnote{{TODO}: Need to choose a version to cite!!}"
                        if (custom_ack != "") {
                            custom_ack += "\\footnote{{TODO}: Need to choose a version to cite!!}"
                        }
                    } else {
                        // otherwise just show the version picker if it's hidden
                        version_picker.classList.remove("hide");

                        // attach the feature button if not already done (idempotent)
                        if (feature_tags_data !== undefined) {
                            attach_feature_btn(version_picker, btn_key, feature_tags_data);
                        }

                        // if you've selected a version then update the citation
                        if (version_picker.hasAttribute("data-bibtex")) {
                            const chosen_version = version_picker.querySelector(".version-select").value;
                            const new_tag = btn.getAttribute("data-key") + "_" + chosen_version
                            if (new_ack.includes("\\citep{")) {
                                // insert zenodo tag into the first \citep{} (the main software citation)
                                const citep_idx = new_ack.indexOf("\\citep{");
                                const close_idx = new_ack.indexOf("}", citep_idx);
                                new_ack = new_ack.slice(0, close_idx) + "," + new_tag + new_ack.slice(close_idx);
                            } else {
                                // no existing citep — insert one right after \texttt{name}
                                const texttt_end = new_ack.indexOf("}") + 1;
                                new_ack = new_ack.slice(0, texttt_end) + " \\citep{" + new_tag + "}" + new_ack.slice(texttt_end);
                            }

                            // remove the final period if it exists
                            if (custom_ack[custom_ack.length - 1] == ".") {
                                custom_ack = custom_ack.slice(0, -1);
                            }
                            // update custom acknowledgement
                            // if the custom acknowledgement has a citep in it then insert the new tag
                            if (custom_ack.includes("citep") && custom_ack[custom_ack.length - 1] == "}") {
                                // loop over the custom ack, starting at the citep, find the brace that closes
                                // the citep and insert this new tag in place
                                let open_braces = 0;
                                for (let i = custom_ack.indexOf("\\citep") + 6; i < custom_ack.length; i++) {
                                    if (custom_ack[i] == "{") {
                                        open_braces += 1;
                                    } else if (custom_ack[i] == "}") {
                                        open_braces -= 1;
                                    }
                                    if (open_braces == 0) {
                                        custom_ack = custom_ack.slice(0, i) + "," + new_tag + custom_ack.slice(i);
                                        break;
                                    }
                                }
                            // otherwise just append the new tag if there's a custom acknowledgement
                            } else if (custom_ack != "") {
                                custom_ack += " \\citep{" + new_tag + "}.";
                            }
                            bibs_to_add.push(highlight_bibtex(version_picker.getAttribute("data-bibtex")));
                        } else {
                            new_ack += "\\footnote{{TODO}: Need to choose a version to cite!!}"
                            if (custom_ack != "") {
                                custom_ack += "\\footnote{{TODO}: Need to choose a version to cite!!}"
                            }
                        }
                    }
                }

                // for non-zenodo software with feature_tags, create or show a feature-only picker card
                let picker = document.getElementById(`${btn.getAttribute("data-key")}-version-picker`);
                if (zenodo_doi === "" && feature_tags_data !== undefined && picker === null) {
                    let picker = document.getElementById("version-picker-template").cloneNode(true);
                    picker.id = `${btn.getAttribute("data-key")}-version-picker`;
                    picker.classList.remove("hide");
                    picker.setAttribute("data-loaded", "true");
                    picker.querySelector(".waiter").classList.add("hide");
                    picker.querySelector(".card-title").innerText = btn.getAttribute("data-key");
                    picker.querySelector(".version-select").classList.add("hide");
                    picker.querySelector(".feature-btn").classList.remove("hide");

                    // if the software has no logo then remove the image and add a text element instead
                    if (citations[btn.getAttribute("data-key")]["logo"] === "") {
                        picker.querySelector(".software-logo").remove();
                        let el = document.createElement("span");
                        el.className = "software-no-logo-text";
                        el.innerText = btn.getAttribute("data-key");
                        const card_body = picker.querySelector(".card-body");
                        card_body.insertBefore(el, card_body.querySelector(".card-title"));
                    } else {
                        picker.querySelector(".software-logo").src = citations[btn.getAttribute("data-key")]["logo"];
                        picker.querySelector(".software-logo").alt = btn.getAttribute("data-key");
                    }

                    attach_feature_btn(picker, btn_key, feature_tags_data);

                    document.getElementById("version-list").appendChild(picker);
                } else if (picker !== null) {
                    picker.classList.remove("hide");
                }

                if (custom_ack != "") {
                    custom_acks_to_add.push(highlight_latex(custom_ack));
                } else {
                    // otherwise use the regular acknowledgement
                    ack_to_add.push(highlight_latex(new_ack))
                }

                // same for the bibtex
                if (btn_tags[0] != "") {
                    for (let tag of btn_tags) {
                        bibs_to_add.push(highlight_bibtex(bibtex_table[tag]));
                    }
                }

                // add some extra bibtex if necessary
                const extra_bibtex = citations[btn.getAttribute("data-key")]["extra_bibtex"];
                if (extra_bibtex !== undefined) {
                    bibs_to_add.push(highlight_bibtex(extra_bibtex));
                }
            });

            // sort version pickers: version-only first, then feature-only, then both
            sort_version_pickers();

            // clear the acknowledgement
            ack.innerHTML = "";

            // add the acknowledgements
            if (ack_to_add.length != 0) {

                // add a preamble to the acknowledgement
                ack.innerHTML = "This work made use of the following software packages: "

                // add add acknowledgements, joining them with commas and adding an "and" before the last one
                ack.innerHTML += ack_to_add.slice(0, -1).join(', ') + (ack_to_add.length > 2 ? ',' : '') + (ack_to_add.length > 1 ? ' and ' : '') + ack_to_add.slice(-1) + '.';
                if (feature_sentences_to_add.length > 0) {
                    ack.innerHTML += " " + feature_sentences_to_add.join(" ");
                }
            }

            // add the custom acknowledgements (with extra space between them and the main acknowledgements)
            if (custom_acks_to_add.length != 0 && ack_to_add.length != 0) {
                ack.innerHTML += "\n\n";
            }
            ack.innerHTML += custom_acks_to_add.join("\n\n");
            ack.innerHTML += "\n\n" + highlight_latex("Software citation information aggregated using \\texttt{\\href{https://www.tomwagg.com/software-citation-station/}{The Software Citation Station}} \\citep{software-citation-station-paper,software-citation-station-zenodo}.");

            // add the bibtex entries
            bibs_to_add.push(highlight_bibtex(bibtex_table['software-citation-station-paper']))
            bibtex_box.innerHTML = bibs_to_add.join("\n\n");

            // add the bibtex for the software citation station from Zenodo
            fetch_zenodo_bibtex("13225526").then((bibtex) => {
                if (!bibtex_box.innerHTML.includes("software-citation-station-zenodo")) {
                    const tag = bibtex.split("{")[1].split(",")[0];
                    bibtex = bibtex.replace(tag, "software-citation-station-zenodo");
                    bibtex_box.innerHTML += "\n\n" + highlight_bibtex(bibtex);

                    // remake the buttons for copying and downloading the bibtex now there's some extra
                    const btn_group = bibtex_box.parentElement.querySelector(".btn-group.corner-button")
                    if (btn_group !== null) {
                        btn_group.innerHTML = "";
                        btn_group.appendChild(copy_button(bibtex_box.innerText));
                        btn_group.appendChild(download_button(bibtex_box.innerText));
                    }
                }
            })

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

    // populate the category and language selects
    for (let cat of [...categories].sort()) {
        const cat_caps = capitalise(cat);
        category_select.appendChild(create_option(cat_caps, cat_caps));
    }
    for (let lang of [...languages].sort()) {
        const lang_caps = capitalise(lang);
        language_select.appendChild(create_option(lang_caps, lang_caps));
    }

    // populate the language and category selects in the new-software form based on the ones on the main page
    const new_software_category = document.getElementById("new-software-category");
    const new_software_language = document.getElementById("new-software-language");
    if (new_software_category.children.length == 0) {
        for (let i = 0; i < category_select.options.length; i++) {
            if (category_select.options[i].value === "all") {
                continue;
            }
            new_software_category.appendChild(create_option(category_select.options[i].value,
                category_select.options[i].innerText));
        }
        new_software_category.appendChild(create_option("new", "New category..."));
    }
    if (new_software_language.children.length == 0) {
        for (let i = 0; i < language_select.options.length; i++) {
            if (language_select.options[i].value === "all") {
                continue;
            }
            new_software_language.appendChild(create_option(language_select.options[i].value,
                language_select.options[i].innerText));
        }
        new_software_language.appendChild(create_option("new", "New language..."));
    }

    // hide the loading overlay
    document.getElementById("software-loading").classList.add("hide");

    // if the user has arrived at the page with a query string then auto-select the software
    const params = new URLSearchParams(document.location.search);
    if (params.has("auto-select")) {
        const to_select = params.get("auto-select").split(",");
        for (let key of to_select) {
            key = key.trim();
            const btn = document.querySelector(`.software-button[data-key="${key}"]`);

            // only click the button if it exists and isn't already active
            if (btn !== null && !btn.classList.contains("active")) {
                btn.click();
            }
        }
    }
});

// this function runs once the page has loaded
window.addEventListener('DOMContentLoaded', () => {
    // SOFTWARE SELECTION PANEL
    // ========================

    // add a search event to the search bar to run once you stop typing for 200ms
    let typingTimer;
    let doneTypingInterval = 200;
    document.getElementById("software-search").addEventListener('input', function() {
        clearTimeout(typingTimer);
        typingTimer = setTimeout(handle_search, doneTypingInterval);
    });

    // add a click event to the window to close all tooltips when clicking outside of them
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

    // clear the search field and reset filtering on click
    document.getElementById("software-search-clear").addEventListener('click', function() {
        document.getElementById("software-search").value = "";
        handle_search();
    });

    // clear the category and language filters on click
    document.getElementById("software-filter-clear").addEventListener('click', function() {
        document.getElementById("software-category").value = "all";
        document.getElementById("software-language").value = "all";
        handle_search();
    });

    // filter the software if a new category or language is selected in the dropdown
    document.getElementById("software-category").addEventListener('change', handle_search);
    document.getElementById("software-language").addEventListener('change', handle_search); 

    // clear all selected software on the button click and hide version pickers if they exist
    document.getElementById("software-clear").addEventListener('click', function() {
        let buttons = document.querySelectorAll(".software-button.active")
        if (buttons.length == 0) {
            return;
        }
        // forget any remembered feature selection so re-adding a package starts
        // fresh (the picker elements are reused when a package is selected again)
        buttons.forEach(function(btn) {
            const vp = document.getElementById(`${btn.getAttribute("data-key")}-version-picker`);
            if (vp !== null) {
                vp.removeAttribute("data-selected-features");
                const count_el = vp.querySelector(".feature-btn .feature-count");
                if (count_el !== null) count_el.textContent = "";
            }
        });
        for (let i = 0; i < buttons.length - 1; i++) {
            buttons[i].classList.remove("active");
            const vp = document.getElementById(`${buttons[i].getAttribute("data-key")}-version-picker`);
            if (vp !== null) {
                vp.classList.add("hide");
            }
        }
        buttons[buttons.length - 1].click();
    });

    // handle the expand button, resizing the columns as desired
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

    // setup the tooltips for each of the software packages
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]')
    const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl))

    // VERSION SELECTION PANEL
    // =======================

    // handle the toggle buttons for whether to choose the latest version or not
    document.querySelectorAll("#version-selector button").forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            const active_btn = this.parentElement.querySelector(".active");

            // if the active button is the other one then swap the toggle buttons
            if (active_btn !== this) {
                active_btn.classList.remove("active");
                this.classList.add("active");

                // auto select the latest version for each version picker that isn't hidden
                if (this.id === "latest_version") {
                    document.querySelectorAll(".version-picker:not(.hide) .version-select").forEach(function(select) {
                        if (select.classList.contains("hide")) {
                            return;
                        }
                        select.value = select.children[1].value;
                        select.dispatchEvent(new Event('change'));
                    });
                }
            }
        });
    });

    // NEW SOFTWARE FORM
    // =================

    // keep a counter up to date for any character limited textareas
    document.querySelectorAll("textarea[data-counted]").forEach(function(textarea) {
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

    // reveal the new category/language inputs if "new" is selected in the dropdown
    document.querySelectorAll("#new-software-category, #new-software-language").forEach(el => {
        el.addEventListener('change', function() {
            const selected = Array.from(this.selectedOptions).map(o => o.value);
            if (selected.includes("new")) {
                this.nextElementSibling.classList.remove("hide");
                this.nextElementSibling.focus();
            } else {
                this.nextElementSibling.classList.add("hide");
            }
        })
    });

    document.getElementById("copy-new-software").addEventListener('click', function() {
        navigator.clipboard.writeText(this.getAttribute("data-copy-text"));
        const url = `https://github.com/TomWagg/software-citation-station/issues/new?assignees=&labels=new-citation&projects=&template=01-citation.md&title=[NEW SUBMISSION] ${name}`
        window.open(url, "_blank");
    });

    document.getElementById("new-software-from-search").addEventListener('click', function(e) {
        e.preventDefault();
        document.getElementById("launch-new-software").click();
    });

    // if the user wants to continue editing then scroll back up and hide the results section
    document.getElementById("back-new-software").addEventListener('click', function() {
        document.querySelector(".modal-title").scrollIntoView({behavior: "smooth"});
        setTimeout(() => {
            document.getElementById("new-software-results").classList.add("hide");
        }, 1000);
    });

    // on submission validate the form
    document.getElementById("submit-new-software").addEventListener('click', function(e) {
        validate_new_software_form();
        e.preventDefault();
        e.stopPropagation();
    });

    // feature selection modal (main page)
    document.getElementById("save-features").addEventListener('click', function() {
        const modal_el = document.getElementById("features-modal");
        const picker_id = modal_el.getAttribute("data-picker-id");
        const key = modal_el.getAttribute("data-key");
        const picker = document.getElementById(picker_id);

        // only auto-select a feature's dependency packages if the user has the
        // "Auto-add dependencies" toggle enabled (same gate as package-level deps)
        const auto_add_deps = document.getElementById("auto-deps-toggle").classList.contains("active");

        const selected = [];
        // packages that the selected features depend on (plus their own
        // transitive dependencies) get selected like ordinary dependencies
        const feature_deps = new Set();
        document.querySelectorAll("#features-modal-checkboxes .form-check-input:checked").forEach(cb => {
            selected.push(cb.value);
            if (!auto_add_deps) return;
            let deps = [];
            try { deps = JSON.parse(cb.dataset.dependencies || "[]"); } catch (e) { deps = []; }
            for (const dep of deps) {
                feature_deps.add(dep);
                collect_dependencies(feature_deps, dep);
            }
        });
        picker.setAttribute("data-selected-features", selected.join(","));

        // select any dependency packages that aren't already selected
        const newly_selected = [];
        for (const dep of feature_deps) {
            const dep_btn = document.querySelector(`.software-button[data-key="${dep}"]`);
            if (dep_btn !== null && !dep_btn.classList.contains("active")) {
                newly_selected.push(dep);
                dep_btn.classList.add("active");
            }
        }
        if (newly_selected.length > 0) {
            const toast = document.getElementById("toast-template").cloneNode(true);
            toast.querySelector(".toast-body .main-package").innerText = key;
            toast.querySelector(".toast-body .dependencies").innerText = newly_selected.join(", ");
            document.getElementById("toaster").appendChild(toast);
            bootstrap.Toast.getOrCreateInstance(toast).show();
            toast.addEventListener('hidden.bs.toast', () => toast.remove());
        }

        const count_el = picker.querySelector(".feature-btn .feature-count");
        const total = document.querySelectorAll("#features-modal-checkboxes .form-check-input").length;
        count_el.textContent = ` (${selected.length}/${total})`;

        bootstrap.Modal.getInstance(modal_el).hide();

        // trigger citation recalculation
        const btn = document.querySelector(`.software-button[data-key="${key}"]`);
        btn.click();
        btn.click();
    });

    // sub-packages modal

    document.getElementById("open-subpackages-modal").addEventListener('click', function() {
        const modal = new bootstrap.Modal(document.getElementById("subpackages-modal"));
        modal.show();
    });

    function add_bibtex_field(entry) {
        const group = entry.querySelector(".subpackage-bibtex-group");
        const wrapper = document.createElement("div");
        wrapper.className = "mb-1";
        wrapper.innerHTML = `<div class="d-flex align-items-start">
                <textarea class="form-control subpackage-bibtex me-1" rows="3" placeholder="Paste BibTeX here"></textarea>
                <button type="button" class="btn btn-outline-danger btn-sm remove-bibtex-field"><i class="fa fa-minus"></i></button>
            </div>
            <div class="bibtex-feedback" style="font-size: 0.65rem"></div>`;
        wrapper.querySelector(".remove-bibtex-field").addEventListener('click', function() {
            wrapper.remove();
        });
        // keep the "add another" button below all the BibTeX fields
        const add_btn = group.querySelector(".add-bibtex-field");
        group.insertBefore(wrapper, add_btn);
    }

    function setup_entry(entry) {
        const remove_btn = entry.querySelector(".remove-subpackage");
        if (remove_btn) {
            remove_btn.addEventListener('click', function() { entry.remove(); });
        }
        const clear_btn = entry.querySelector(".clear-subpackage");
        if (clear_btn) {
            clear_btn.addEventListener('click', function() {
                entry.querySelector(".subpackage-name").value = "";
                entry.querySelector(".subpackage-name").classList.remove("is-invalid");
                // remove any dynamically added bibtex fields, leaving only the first
                entry.querySelectorAll(".subpackage-bibtex-group .d-flex.align-items-start").forEach(el => el.remove());
                // reset the original textarea and its feedback
                const textarea = entry.querySelector(".subpackage-bibtex");
                textarea.value = "";
                textarea.classList.remove("is-valid", "is-invalid");
                const feedback = entry.querySelector(".bibtex-feedback");
                if (feedback) feedback.innerHTML = "";
                // reset any selected dependencies
                set_entry_deps(entry, []);
                render_selected_deps(entry);
                const req = entry.querySelector(".feature-requirement-feedback");
                if (req) req.innerHTML = "";
            });
        }
        entry.querySelector(".add-bibtex-field").addEventListener('click', function() {
            add_bibtex_field(entry);
        });
        setup_dependency_selector(entry);
    }

    // wire up the static first entry
    setup_entry(document.querySelector("#subpackage-entries .subpackage-entry"));

    // close any open dependency dropdowns when clicking outside the panel itself
    // (its own "select" toggle button is excluded so it can open/close normally)
    document.addEventListener('click', function(e) {
        document.querySelectorAll("#subpackage-entries .dependency-dropdown:not(.hide)").forEach(function(panel) {
            const container = panel.closest(".subpackage-deps");
            const select_btn = container ? container.querySelector(".select-dependencies") : null;
            const clicked_toggle = select_btn && select_btn.contains(e.target);
            if (!panel.contains(e.target) && !clicked_toggle) {
                panel.classList.add("hide");
            }
        });
    });

    document.getElementById("add-subpackage-entry").addEventListener('click', function() {
        const container = document.getElementById("subpackage-entries");
        const entry = document.createElement("div");
        entry.className = "subpackage-entry border rounded p-2 mb-2";
        entry.innerHTML = `
            <div class="d-flex justify-content-end mb-1">
                <button type="button" class="btn btn-outline-danger btn-sm remove-subpackage"><i class="fa fa-times"></i></button>
            </div>
            <div class="mb-1">
                <label class="form-label">Feature/option/sub-package name</label>
                <input type="text" class="form-control subpackage-name" placeholder="e.g. numpy.fft" />
            </div>
            <div class="subpackage-deps mb-2">
                <div class="d-flex align-items-center mb-1">
                    <label class="form-label mb-0 me-2">Dependencies</label>
                    <button type="button" class="btn btn-outline-primary btn-sm select-dependencies" style="font-size: 0.6rem">select</button>
                </div>
                <div class="selected-dependencies"></div>
            </div>
            <div class="subpackage-bibtex-group">
                <label class="form-label mb-1">BibTeX (only new entries - do not enter BibTeX of dependencies)</label>
                <textarea class="form-control subpackage-bibtex" rows="3" placeholder="Paste BibTeX here"></textarea>
                <div class="bibtex-feedback mb-1" style="font-size: 0.65rem"></div>
                <button type="button" class="btn btn-outline-success btn-sm add-bibtex-field" style="font-size: 0.6rem"><i class="fa fa-plus"></i> add another BibTeX entry for feature</button>
            </div>
            <div class="feature-requirement-feedback text-danger mt-1" style="font-size: 0.65rem"></div>`;
        container.appendChild(entry);
        setup_entry(entry);
    });

    document.getElementById("save-subpackages").addEventListener('click', function() {
        // each feature must have a name and at least one valid BibTeX entry or
        // dependency before allowing the modal to close
        if (!validate_all_features(false)) return;

        const subpackages = collect_subpackages();
        const summary = document.getElementById("subpackage-summary");
        if (subpackages.length > 0) {
            const badges = subpackages.map(sp => `<span class="badge text-bg-secondary me-1">${sp.name || "(unnamed)"}</span>`).join("");
            summary.innerHTML = `<small class="text-muted">Sub-packages saved: ${badges}</small>`;
        } else {
            summary.innerHTML = "";
        }

        bootstrap.Modal.getInstance(document.getElementById("subpackages-modal")).hide();
    });

    // as the new name is changed, update the link for searching Zenodo
    document.getElementById("new-software-name").addEventListener('input', function() {
        document.getElementById("new-zenodo-search").href = `https://zenodo.org/search?q=${this.value}`;
    });

    // if the user clicks the resulting citation data then take them to the issue creation
    document.getElementById("new-software-citation").addEventListener('click', function() {
        animateCSS(this, "rubberBand").then(() => {
            document.getElementById("copy-new-software").click();
        });
    });


    // MAIN PAGE
    // =========
    
    // if the user arrives immediately wanting to add new software then launch the form
    const params = new URLSearchParams(document.location.search);
    if (params.has("new-software") && params.get("new-software") === "true") {
        document.getElementById("launch-new-software").click();
    }

    // open headshot links on click
    document.querySelectorAll(".headshot-box").forEach(function(box) {
        box.addEventListener('click', function() {
            window.open(this.getAttribute("data-href"), "_blank");
        });
    });

    document.getElementById("cite-badge").addEventListener('click', function(e) {
        e.preventDefault();
        
        // copy the bibtex to the clipboard
        navigator.clipboard.writeText(badge_html);
    });

    document.getElementById("file-upload-go").addEventListener('click', function() {
        const file_input = document.getElementById("file-upload");
        file_input.click();
    });
    
    document.getElementById("file-upload").addEventListener('change', function() {
        const file = this.files[0];
        if (file.name.endsWith(".txt")) {
            handle_file_upload(file, 'txt');
        } else if (file.name.endsWith(".yml") || file.name.endsWith(".yaml")) {
            handle_file_upload(file, 'yml');
        } else {
            toast_notification("Error", "Unsupported file type. Please upload a .txt, .yml, or .yaml file.", "danger");
        }
    });
});

// handle the searching/filtering of software packages
function handle_search() {
    let search = document.getElementById("software-search").value.toLowerCase();
    const btns = document.querySelectorAll(".software-button:not(#software-btn-template)")

    const category = document.getElementById("software-category").value.toLowerCase();
    const language = document.getElementById("software-language").value.toLowerCase();

    let all_hidden = true;
    for (let btn of btns) {
        const btn_key = btn.getAttribute("data-key").toLowerCase();
        const btn_keywords = btn.getAttribute("data-keywords").toLowerCase();

        // check if the language matches the button's language
        const lang_string = btn.getAttribute("data-language").toLowerCase();
        let matches_lang = false;
        const langs = lang_string.split(",");
        for (let lang of langs) {
            if (lang.trim() === language) {
                matches_lang = true;
            }
        }

        // check if the category matches the button's category
        const cat_string = btn.getAttribute("data-category").toLowerCase();
        let matches_cat = false;
        const cats = cat_string.split(",");
        for (let cat of cats) {
            if (cat.trim() === category) {
                matches_cat = true;
            }
        }

        // combine all of the search criteria
        const matches_search = ((btn_key.includes(search) || btn_keywords.includes(search))
                                && (category === "all" || matches_cat)
                                && (language === "all" || matches_lang));
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

// create a dropdown menu option element
function create_option(value, label) {
    let opt = document.createElement("option");
    opt.value = value;
    opt.innerText = label;
    return opt;
}

// capitalise the first letter in each word in a string
function capitalise(string) {
    return string.replace(/(^\w{1})|(\s+\w{1})/g, letter => letter.toUpperCase());
}

// change units between rem and pixels
function convertRemToPixels(rem) {    
    return rem * parseFloat(getComputedStyle(document.documentElement).fontSize);
}

// validate a single feature bibtex textarea, showing inline feedback
// mirrors the same logic as the main BibTeX field validation
function validate_feature_bibtex(textarea) {
    const val = textarea.value.trim();

    // the feedback element sits after the textarea (static entries) or after
    // the .d-flex row that wraps the textarea + remove button (dynamic entries)
    const flex_parent = textarea.parentElement.classList.contains('d-flex') ? textarea.parentElement : null;
    const anchor = flex_parent || textarea;

    let feedback = anchor.nextElementSibling;
    if (!feedback || !feedback.classList.contains('bibtex-feedback')) {
        feedback = document.createElement('div');
        feedback.className = 'bibtex-feedback';
        feedback.style.fontSize = '0.65rem';
        anchor.insertAdjacentElement('afterend', feedback);
    }

    if (val === "") {
        textarea.classList.remove('is-invalid', 'is-valid');
        feedback.innerHTML = "";
        return true;
    }

    const parsed = parse_bibtex(val);
    if (Object.keys(parsed).length === 0) {
        textarea.classList.add('is-invalid');
        textarea.classList.remove('is-valid');
        feedback.innerHTML = "<span class='text-danger'>Invalid BibTeX.</span>";
        return false;
    } else {
        textarea.classList.add('is-valid');
        textarea.classList.remove('is-invalid');
        const tags = Object.keys(parsed).map(k => `<span class='badge text-bg-success'>${k}</span>`).join(" ");
        feedback.innerHTML = "Tags detected: " + tags;
        return true;
    }
}

// validate every feature entry: each non-empty feature needs a name and at
// least one valid BibTeX entry OR at least one selected dependency, and any
// BibTeX that is provided must be valid. Optionally opens the modal on failure.
// Returns true if all feature entries are valid.
function validate_all_features(open_modal_on_error) {
    let all_valid = true;

    for (const entry of document.querySelectorAll("#subpackage-entries .subpackage-entry")) {
        const name_input = entry.querySelector(".subpackage-name");
        const name = name_input.value.trim();
        const deps = get_entry_deps(entry);
        const req_feedback = entry.querySelector(".feature-requirement-feedback");
        if (req_feedback) req_feedback.innerHTML = "";

        // validate each BibTeX field; track whether any valid, non-empty one exists
        let has_valid_bibtex = false;
        const bibtex_textareas = [...entry.querySelectorAll(".subpackage-bibtex")];
        for (const textarea of bibtex_textareas) {
            const ok = validate_feature_bibtex(textarea);
            if (!ok) {
                all_valid = false;
            } else if (textarea.value.trim() !== "") {
                has_valid_bibtex = true;
            }
        }

        // an entry is only "active" (and thus required to be complete) if it has
        // any content at all; a wholly empty default entry is simply ignored
        const is_active = name !== "" || has_valid_bibtex || deps.length > 0
            || bibtex_textareas.some(t => t.value.trim() !== "");
        if (!is_active) {
            name_input.classList.remove("is-invalid");
            continue;
        }

        // an active feature must have a name
        if (name === "") {
            name_input.classList.add("is-invalid");
            all_valid = false;
        } else {
            name_input.classList.remove("is-invalid");
        }

        // an active feature must have at least one valid BibTeX OR one dependency
        if (!has_valid_bibtex && deps.length === 0) {
            all_valid = false;
            if (req_feedback) {
                req_feedback.innerHTML = "This feature needs at least one valid BibTeX entry or one selected dependency.";
            }
        }
    }

    const summary = document.getElementById("subpackage-summary");
    if (!all_valid) {
        if (summary) {
            summary.innerHTML = '<small class="text-danger">Each feature needs a name and at least one valid BibTeX entry or dependency.</small>';
        }
        if (open_modal_on_error) {
            bootstrap.Modal.getOrCreateInstance(document.getElementById("subpackages-modal")).show();
        }
    }
    return all_valid;
}

// parse the bibtex file into a dictionary of tags and entries
function parse_bibtex(bibtex_text) {
    let bibtex_obj = {};
    while ((match = bibtex_re.exec(bibtex_text)) != null) {
        bibtex_obj[match.groups["tag"]] = isolate_bibtex_entry(bibtex_text, match.index);
    }
    return bibtex_obj
}

// isolate a bibtex entry based on closing curly braces
function isolate_bibtex_entry(s, start) {
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


// highlight the latex command and arguments with some simple syntax highlighting
function highlight_latex(s) {
    return s.replace(latex_re, function(match, command, args) {
        if (command == "\\footnote") {
            return '<span class="latex-command">' + command + '</span>{' + args + "}";
        } else {
            return '<span class="latex-command">' + command + '</span>{<span class="latex-refs">' + args + "</span>}";
        }
    });
}

// highlight the bibtex entry with some simple syntax highlighting around the format and key
function highlight_bibtex(s) {
    let at_thing = s.split("{")[0];
    let key = s.split("{")[1].split(",")[0];
    rest_starts_at = at_thing.length + key.length + 1;
    return "<span class='bibtex-format'>" + at_thing + "</span>{<span class='bibtex-key'>" + key + "</span>" + s.slice(rest_starts_at);
}

// create a copy button element that copies the provided text
function copy_button(text) {
    let copy_btn = document.getElementById("copy-template").cloneNode(true);
    copy_btn.classList.remove("hide");
    copy_btn.addEventListener('click', function() {
        navigator.clipboard.writeText(text);
    });
    new bootstrap.Tooltip(copy_btn)
    return copy_btn 
}

// create a download button that downloads a "software.bib" file with the text
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

// apply animate.css animations
const animateCSS = (node, animation, prefix = 'animate__') =>
    new Promise((resolve, reject) => {
    const animationName = `${prefix}${animation}`;
    node.classList.add(`${prefix}animated`, animationName);
    function handleAnimationEnd(event) {
        event.stopPropagation();
        node.classList.remove(`${prefix}animated`, animationName);
        resolve('Animation ended');
    }
    node.addEventListener('animationend', handleAnimationEnd, {once: true});
});

// Function to fetch records from Zenodo API
async function get_zenodo_version_info(concept_doi, vp) {
    // Build the complete URL with the query parameter for concept DOI
    const PAGE_SIZE = 25;
    const base_url = `https://zenodo.org/api/records?q=${encodeURIComponent(`conceptdoi:"${concept_doi}"`)}&all_versions=true&size=${PAGE_SIZE}`;
    try {
        // keep track of which versions we've seen so far
        let version_and_doi = []
        let versions_so_far = new Set()

        // start with an absurd number of expected versions to enter the loop
        let expected_versions = 100000;
        let n_bad_versions = 0;
        let page = 1;

        while (version_and_doi.length + n_bad_versions < expected_versions) {
            let url = base_url + `&page=${page}`;

            // NOTE: THIS ASSUMES NO SOFTWARE HAS MORE THAN 1000 (40 * 25) VERSIONS, CHANGE IF NECESSARY
            if (page > 40) {
                console.warn(`Exceeded 40 pages of results for concept DOI ${concept_doi}. Stopping further requests to avoid rate limiting.`);
                console.log(`Fetched ${version_and_doi.length} versions so far.`);
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
                console.warn(`Received 429 Too Many Requests response. Retrying after ${waitTime}ms...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                continue;   // retry the same page
            }
            
            // check if the response is OK (status code 200-299)
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
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

// Function to get Zenodo version info from cached files
async function get_zenodo_version_info_cached(package_name, concept_doi, vp) {
    try {
        // Fetch the cached version data for this package
        const response = await fetch(`data/zenodo-versions/${package_name}.json`);
        
        // If file doesn't exist, fall back to the API
        if (!response.ok) {
            console.warn(`No cached version data found for ${package_name}, falling back to API`);
            return get_zenodo_version_info(concept_doi, vp);
        }
        
        const version_and_doi = await response.json();

        // Populate the version picker
        const select = vp.querySelector(".version-select");
        for (let i = 0; i < version_and_doi.length; i++) {
            let opt = document.createElement("option");
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
        console.error('Error loading cached version data:', error);
    }
}

async function validate_zenodo_doi(concept_doi) {
    // don't bother if the DOI is empty
    if (concept_doi === "") {
        return [-1, concept_doi];
    }

    const PAGE_SIZE = 25;

    // build the url and make the request. q= value must be URL-encoded — Zenodo rejects raw `:` and `/` with HTTP 400.
    const url = `https://zenodo.org/api/records?q=${encodeURIComponent(`conceptdoi:"${concept_doi}"`)}&all_versions=true&size=${PAGE_SIZE}`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    // grab the data from the response in JSON format
    const data = await response.json();

    // if we didn't find anything then maybe the user entered a specific version DOI accidentally
    if (data.hits.hits.length === 0) {
        // retry by searching for the DOI assuming it's not a concept DOI
        const url = `https://zenodo.org/api/records?q=${encodeURIComponent(`doi:"${concept_doi}"`)}&all_versions=true&size=${PAGE_SIZE}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();

        // if we found only one result then we can assume it's the correct one, retry with that as the concept DOI
        if (data.hits.hits.length === 1) {
            return await validate_zenodo_doi(data.hits.hits[0].conceptdoi);
        } else {
            // otherwise we can't find the DOI, failed
            return [0, concept_doi];
        }

    } else {
        return [data.hits.hits.length, concept_doi];
    }
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

function sort_version_pickers() {
    /* Sort version picker cards by setting CSS flexbox order:
       version-only (1), feature-only (2), both (3).
       Using style.order rather than DOM re-appending means the sort is
       idempotent and survives the btn.click()/btn.click() update pattern
       without causing visible jumps. */
    const pickers = document.querySelectorAll(".version-picker:not(#version-picker-template)");
    for (const el of pickers) {
        if (el.id.endsWith("-feature-picker")) {
            el.style.order = 2;
        } else {
            const feature_btn = el.querySelector(".feature-btn");
            el.style.order = (feature_btn && !feature_btn.classList.contains("hide")) ? 3 : 1;
        }
    }
}

function parse_feature_tags(arr) {
    /* Flatten [{name: {tags, dependencies}}, ...] into a lookup object
       { name: { tags: [...], dependencies: [...] } }. Each item may contain
       more than one feature. An array value is treated as the legacy
       tags-only form. */
    const out = {};
    for (const item of arr) {
        for (const k of Object.keys(item)) {
            const v = item[k];
            if (Array.isArray(v)) {
                out[k] = { tags: v, dependencies: [] };
            } else {
                out[k] = { tags: v.tags || [], dependencies: v.dependencies || [] };
            }
        }
    }
    return out;
}

function attach_feature_btn(picker_el, key, feature_tags_data) {
    /* Show the feature button on a picker card and wire up the modal */
    const feature_btn = picker_el.querySelector(".feature-btn");
    if (feature_btn === null) return;
    if (feature_btn.dataset.wired) return;  // already wired up
    feature_btn.dataset.wired = "true";
    feature_btn.classList.remove("hide");

    feature_btn.addEventListener('click', function() {
        const modal_el = document.getElementById("features-modal");
        modal_el.setAttribute("data-picker-id", picker_el.id);
        modal_el.setAttribute("data-key", key);

        const checkboxes_el = document.getElementById("features-modal-checkboxes");
        checkboxes_el.innerHTML = "";
        const selected = (picker_el.getAttribute("data-selected-features") || "").split(",").filter(Boolean);

        for (const feature_name of Object.keys(feature_tags_data)) {
            const div = document.createElement("div");
            div.className = "form-check";
            const checked = selected.includes(feature_name) ? "checked" : "";
            div.innerHTML = `<input class="form-check-input" type="checkbox" value="${feature_name}" id="feature-cb-${feature_name}" ${checked}>
                <label class="form-check-label" for="feature-cb-${feature_name}">${feature_name}</label>`;
            // stash the feature's package dependencies so the save handler can
            // select them without needing the citations object in scope
            div.querySelector(".form-check-input").dataset.dependencies =
                JSON.stringify(feature_tags_data[feature_name].dependencies || []);
            checkboxes_el.appendChild(div);
        }

        bootstrap.Modal.getOrCreateInstance(modal_el).show();
    });
}

// read/write the list of dependency package keys selected for a feature entry
function get_entry_deps(entry) {
    try {
        return JSON.parse(entry.dataset.dependencies || "[]");
    } catch (e) {
        return [];
    }
}

function set_entry_deps(entry, deps) {
    entry.dataset.dependencies = JSON.stringify(deps);
}

// render the selected dependency badges for a feature entry
function render_selected_deps(entry) {
    const display = entry.querySelector(".selected-dependencies");
    if (!display) return;
    const deps = get_entry_deps(entry);
    if (deps.length === 0) {
        display.innerHTML = '<small class="text-muted">No dependencies selected</small>';
    } else {
        display.innerHTML = "";
        for (const dep of deps) {
            const badge = document.createElement("span");
            badge.className = "badge text-bg-primary me-1";
            const text = document.createElement("span");
            text.textContent = dep;
            badge.appendChild(text);
            // a close symbol to remove this dependency
            const close = document.createElement("button");
            close.type = "button";
            close.className = "btn-close btn-close-white ms-1 align-middle";
            close.style.fontSize = "0.5rem";
            close.setAttribute("aria-label", `Remove ${dep}`);
            close.addEventListener('click', function() {
                remove_entry_dep(entry, dep);
            });
            badge.appendChild(close);
            display.appendChild(badge);
        }
    }
}

// remove a single dependency from a feature entry and keep the dropdown in sync
function remove_entry_dep(entry, dep) {
    const deps = get_entry_deps(entry).filter(d => d !== dep);
    set_entry_deps(entry, deps);
    // if the dropdown is open/built, uncheck the matching checkbox
    const checkbox = entry.querySelector(`.dependency-options input[value="${dep}"]`);
    if (checkbox) checkbox.checked = false;
    render_selected_deps(entry);
}

// (re)build the checkbox list of every package currently in the citation
// station, reflecting the feature entry's currently-selected dependencies.
// Done lazily on open so the software buttons (loaded asynchronously) exist.
function populate_dependency_options(entry, options) {
    const selected = get_entry_deps(entry);
    const keys = [...document.querySelectorAll(".software-button[data-key]")]
        .map(b => b.getAttribute("data-key"))
        .filter(Boolean)
        .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    options.innerHTML = "";
    for (const key of keys) {
        // a plain div row (not a <label>) so we control toggling explicitly and
        // avoid the nested-label double-fire quirk; the whole row is clickable
        const opt = document.createElement("div");
        opt.className = "form-check dependency-option";
        opt.style.cursor = "pointer";
        const input = document.createElement("input");
        input.className = "form-check-input";
        input.type = "checkbox";
        input.value = key;
        if (selected.includes(key)) input.checked = true;
        const label = document.createElement("span");
        label.className = "form-check-label ms-1";
        label.textContent = key;
        opt.appendChild(input);
        opt.appendChild(label);
        options.appendChild(opt);
    }
}

// build and wire up the searchable dependency dropdown for a feature entry
function setup_dependency_selector(entry) {
    const container = entry.querySelector(".subpackage-deps");
    if (!container) return;
    const select_btn = container.querySelector(".select-dependencies");

    // build the (hidden) dropdown panel once
    let panel = container.querySelector(".dependency-dropdown");
    if (!panel) {
        panel = document.createElement("div");
        panel.className = "dependency-dropdown card p-2 shadow hide";
        const search = document.createElement("input");
        search.type = "text";
        search.className = "form-control form-control-sm dependency-search mb-2";
        search.placeholder = "Search packages...";
        const options = document.createElement("div");
        options.className = "dependency-options";
        options.style.maxHeight = "160px";
        options.style.overflowY = "auto";
        panel.appendChild(search);
        panel.appendChild(options);

        // float the panel as an overlay anchored just under the "select" row so
        // that changing the filtered list length never resizes the modal
        const deps_row = container.querySelector(".d-flex");
        const anchor = deps_row || container;
        anchor.style.position = "relative";
        panel.style.position = "absolute";
        panel.style.top = "calc(100% + 2px)";
        panel.style.left = "0";
        panel.style.right = "0";
        panel.style.zIndex = "1000";
        anchor.appendChild(panel);

        // filter the list as the user types. Toggle inline display (rather than a
        // class) so it always wins over Bootstrap's .form-check display rule.
        search.addEventListener('input', function() {
            const q = this.value.trim().toLowerCase();
            options.querySelectorAll(".dependency-option").forEach(function(opt) {
                const label = opt.querySelector(".form-check-label");
                const text = label ? label.textContent.toLowerCase() : "";
                opt.style.display = (q !== "" && !text.includes(q)) ? "none" : "";
            });
        });

        // toggle a package when its row (name included) is clicked, then sync the
        // stored selection. Clicking the checkbox itself toggles it natively, so
        // we only flip it ourselves when the click landed elsewhere on the row.
        options.addEventListener('click', function(e) {
            const row = e.target.closest(".dependency-option");
            if (!row) return;
            const checkbox = row.querySelector("input[type=checkbox]");
            if (!checkbox) return;
            if (e.target !== checkbox) checkbox.checked = !checkbox.checked;
            const chosen = [...options.querySelectorAll("input:checked")].map(i => i.value);
            set_entry_deps(entry, chosen);
            render_selected_deps(entry);
        });
    }

    if (select_btn) {
        select_btn.addEventListener('click', function() {
            panel.classList.toggle("hide");
            if (!panel.classList.contains("hide")) {
                // (re)populate from the currently-loaded package list on open
                populate_dependency_options(entry, panel.querySelector(".dependency-options"));
                const search = panel.querySelector(".dependency-search");
                if (search) { search.value = ""; search.focus(); }
            }
        });
    }

    render_selected_deps(entry);
}

function collect_subpackages() {
    const subpackages = [];
    document.querySelectorAll("#subpackage-entries .subpackage-entry").forEach(function(entry) {
        const name = entry.querySelector(".subpackage-name").value.trim();
        const bibtexes = [...entry.querySelectorAll(".subpackage-bibtex")].map(t => t.value.trim()).filter(Boolean);
        const dependencies = get_entry_deps(entry);
        if (name !== "" || bibtexes.length > 0 || dependencies.length > 0) {
            subpackages.push({ name, bibtexes, dependencies });
        }
    });
    return subpackages;
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
    let bibtex = {}
    if (bibtex_field.value.trim() === "") {
        bibtex_field.setCustomValidity("");
        bibtex_field.parentElement.querySelector(".valid-feedback").innerHTML = "No BibTeX provided.";
    } else {
        bibtex = parse_bibtex(bibtex_field.value.trim());
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
    }

    // check the category and language selects. At least one option must be selected, and if "new" is selected the text input must not be empty
    for (let select of form.querySelectorAll("#new-software-category, #new-software-language")) {
        const selected = Array.from(select.selectedOptions).map(o => o.value);
        const select_new_input = select.nextElementSibling;
        if (selected.length === 0) {
            select.setCustomValidity("Please select at least one option.");
            select_new_input.setCustomValidity("Please select at least one option.");
            select.parentElement.querySelector(".invalid-feedback").innerHTML = "No value selected.";
        } else if (selected.includes("new") && select_new_input.value.trim() === "") {
            select.setCustomValidity("Please enter a new category/language.");
            select_new_input.setCustomValidity("Please enter a new category/language.");
            select.parentElement.querySelector(".invalid-feedback").innerHTML = "New value not entered.";
        } else {
            select.setCustomValidity("");
            select_new_input.setCustomValidity("");
        }
    }

    const keywords = document.getElementById("new-software-keywords").value.trim().split(",").map((kw) => kw.trim());
    const keyword_spans = keywords.map((kw) => `<span class='badge text-bg-success'>${kw}</span>`);
    document.getElementById("new-software-keywords").parentElement.querySelector(".valid-feedback").innerHTML = "Keywords detected: " + keyword_spans.join(" ");

    const doi_input = form.querySelector("#new-software-doi");

    validate_zenodo_doi(doi_input.value.trim()).catch((err) => {
        console.error("Zenodo DOI validation failed:", err);
        doi_input.setCustomValidity("Couldn't reach Zenodo to verify the DOI. Please try again in a moment.");
        doi_input.parentElement.querySelector(".invalid-feedback").innerHTML = "Couldn't reach Zenodo to verify the DOI. Please try again in a moment.";
        return [0, doi_input.value.trim()];
    }).then((results) => {
        const [n_versions, real_doi] = results;

        // if the DOI has changed then update the input field as well
        if (real_doi != doi_input.value.trim()) {
            doi_input.value = real_doi;
        }

        if (n_versions === 0) {
            form.querySelector("#new-software-doi").setCustomValidity("DOI not found on Zenodo.");
            doi_input.parentElement.querySelector(".invalid-feedback").innerHTML = "Invalid DOI. Please ensure you have the correct DOI for <b>all</b> versions of the software (hover over the question mark above for instructions).";
        } else {
            form.querySelector("#new-software-doi").setCustomValidity("");
            doi_input.parentElement.querySelector(".valid-feedback").innerHTML = n_versions > 0 ? ("DOI found on Zenodo with at least " + n_versions + " versions.") : "No DOI provided.";
        }

        // perform the rest of the validation
        let valid = form.checkValidity() && validate_all_features(true);
        if (valid) {
            let json = {}

            const selectedLanguages = Array.from(form.querySelector("#new-software-language").selectedOptions).map(o => o.value);
            let language = selectedLanguages.filter(v => v !== "new");
            if (selectedLanguages.includes("new")) {
                const newLang = form.querySelector("#new-software-language-new").value.trim();
                if (newLang) language.push(newLang);
            }

            const selectedCategories = Array.from(form.querySelector("#new-software-category").selectedOptions).map(o => o.value);
            let category = selectedCategories.filter(v => v !== "new");
            if (selectedCategories.includes("new")) {
                const newCat = form.querySelector("#new-software-category-new").value.trim();
                if (newCat) category.push(newCat);
            }

            const dep_toggles = form.querySelectorAll("#new-software-dependencies .dependency-toggle.text-bg-primary")
            let deps = [];
            if (dep_toggles.length > 0) {
                for (let toggle of dep_toggles) {
                    deps.push(toggle.innerText);
                }
            }

            const name = form.querySelector("#new-software-name").value.trim();
            const subpackages = collect_subpackages();
            const feature_tags_out = [];
            for (const sp of subpackages) {
                if (sp.name !== "") {
                    // store the feature's own new BibTeX tags and its dependency
                    // package keys separately; dependencies are resolved (and
                    // versioned) at runtime via each package's own entry
                    const tags = [];
                    for (const bibtex of sp.bibtexes) {
                        tags.push(...Object.keys(parse_bibtex(bibtex)));
                    }
                    feature_tags_out.push({
                        [sp.name]: {
                            "tags": [...new Set(tags)],
                            "dependencies": [...sp.dependencies]
                        }
                    });
                }
            }
            json[name] = {
                "tags": Object.keys(bibtex),
                "logo": `img/${name}.png`,
                "language": language,
                "category": category,
                "keywords": keywords[0] == "" ? [] : keywords,
                "description": form.querySelector("#new-software-description").value.trim(),
                "link": form.querySelector("#new-software-docs").value.trim(),
                "attribution_link": form.querySelector("#new-software-attribution").value.trim(),
                "zenodo_doi": form.querySelector("#new-software-doi").value.trim(),
                "custom_citation": form.querySelector("#new-software-custom-acknowledgement").value.trim(),
                "dependencies": deps,
            }
            if (feature_tags_out.length > 0) {
                json[name]["feature_tags"] = feature_tags_out;
            }

            const cite_string = JSON.stringify(json, null, 4).split('\n').slice(1, -1).map((line) => line.slice(4)).join('\n');

            const results = document.getElementById("new-software-results");
            results.classList.remove("hide");
            animateCSS(results, "fadeIn").then(() => {
                results.scrollIntoView({behavior: "smooth"});
            });

            const to_copy = document.getElementById("new-software-citation").querySelector("code");
            to_copy.innerText = cite_string;

            let copy_text = base_issue_text;

            copy_text += "```\n" + cite_string + "\n```";
            copy_text += "\n\n";
            copy_text += "# BibTeX\n```\n" + bibtex_field.value.trim() + "\n```";

            if (subpackages.length > 0) {
                copy_text += "\n\n# Feature/sub-package BibTeX";
                for (const sp of subpackages) {
                    if (sp.name !== "") {
                        copy_text += `\n## ${sp.name}`;
                        if (sp.dependencies.length > 0) {
                            copy_text += `\nDepends on existing package(s): ${sp.dependencies.join(", ")}`;
                        }
                        for (const bibtex of sp.bibtexes) {
                            copy_text += `\n\`\`\`\n${bibtex}\n\`\`\``;
                        }
                    }
                }
            }

            document.getElementById("copy-new-software").setAttribute("data-copy-text", copy_text);
        }
        form.classList.add('was-validated');
        loader.classList.add("hide");
    });

    return false;
}

function collect_dependencies(dep_set, id) {
    // recursively gather dependencies for a given software package
    const software_btn = document.querySelector(`.software-button[data-key='${id}']`)
    if (software_btn === null) {
        return dep_set;
    }
    const new_deps = software_btn.getAttribute("data-dependencies");

    if (new_deps !== "") {
        for (let dep of new_deps.split(",")) {
            if (!dep_set.has(dep)) {
                dep_set.add(dep);
                dep_set.add(...collect_dependencies(dep_set, dep));
            }
        }
    }
    return dep_set;
}


function handle_file_upload(file, type) {
    // start reading a new file
    const reader = new FileReader();
    reader.onload = function(e) {
        // parse based on the file type
        const content = e.target.result;
        let parsed_softwares = [];
        if (type === "txt") {
            parsed_softwares = parse_pip_freeze(content);
        } else if (type === "yml" || type === "yaml") {
            parsed_softwares = parse_conda_env(content);
        } else {
            toast_notification("Error", "Unsupported file type. Please upload a .txt, .yml, or .yaml file.", "");
            return;
        }

        // turn off auto-add dependencies if necessary
        const autoDepsToggle = document.getElementById("auto-deps-toggle");
        if (autoDepsToggle.classList.contains("active")) {
            autoDepsToggle.classList.remove("active");
        }

        // track all intervals
        let intervals_remaining = [];
        let missing_softwares = [];

        // go through each software button
        const software_btns = document.querySelectorAll(".software-button:not(#software-btn-template)");
        for (let btn of software_btns) {
            const key = btn.getAttribute("data-key").toLowerCase();
            const pypi_name = btn.getAttribute("data-pypi-name").toLowerCase();

            // if the key or pypi name matches any of the softwares in the file, click the button to add it
            for (let software of parsed_softwares) {
                if (key === software.key || pypi_name === software.key) {
                    // remove this software from the list of parsed softwares so we don't keep looping over it
                    parsed_softwares = parsed_softwares.filter((s) => s.key !== software.key);

                    if (!btn.classList.contains("active")) {
                        btn.click();
                    }

                    // if the version picker exists, wait for the list to be loaded and then select the correct version if it exists
                    const vp = document.getElementById(`${btn.getAttribute("data-key")}-version-picker`);
                    if (vp !== null) {
                        // wait until the data-loaded attribute is true
                        const interval = setInterval(() => {
                            if (vp.getAttribute("data-loaded") === "true") {

                                // select the version that matches (pre-pend a 'v' if necessary)
                                const select = vp.querySelector(".version-select");
                                let found_version = false;
                                for (let opt of select.options) {
                                    let opt_text = opt.text.toLowerCase().trim();
                                    let version_from_file = software.version.toLowerCase().trim();
                                    if (opt_text === version_from_file || opt_text === 'v' + version_from_file) {
                                        select.value = opt.value;
                                        select.dispatchEvent(new Event('change'));
                                        found_version = true;
                                        break;
                                    }
                                }

                                // if we can't find it, make a note of it
                                if (!found_version) {
                                    missing_softwares.push(software);
                                }
                                clearInterval(interval);

                                // remove interval from remaining intervals list
                                intervals_remaining = intervals_remaining.filter((i) => i !== interval);
                            }
                        }, 500);
                        intervals_remaining.push(interval);
                    }
                }
            }
        }

        // once all of the intervals have been cleared
        const checkIntervals = setInterval(() => {
            if (intervals_remaining.length === 0) {
                clearInterval(checkIntervals);

                // if any were missing then let the user know
                if (missing_softwares.length > 0) {
                    let body = "<p class='m-0' style='font-size: 0.7rem;'>The following packages and versions are not available on Zenodo: ";
                    body_softwares = missing_softwares.map((software) => `<code>${software.key}==${software.version}</code>`);
                    body += body_softwares.join(", ") + "</p>";
                    toast_notification("Missing versions", body, "", false);
                }
            }
        }, 500);

    };
    reader.readAsText(file);
}

function parse_pip_freeze(content) {
    // parse the output of pip freeze to get package names
    let softwares = [];
    const lines = content.split("\n");
    for (let line of lines) {
        line = line.trim();
        if (line === "" || line.startsWith("#")) {
            continue;
        }
        const [key, version] = line.split("==");
        softwares.push({key: key.toLowerCase(), version: version});
    }
    return softwares;
}

function parse_conda_env(content) {
    // parse the output of conda env export to get package names
    let softwares = [];
    const lines = content.split("\n");
    let in_deps = false;
    let in_pip_deps = false;
    for (let line of lines) {
        line = line.trim();
        if (line === "dependencies:") {
            in_deps = true;
            continue;
        }
        if (in_pip_deps) {
            if (line.startsWith("- ")) {
                const dep_line = line.slice(2);
                const [key, version] = dep_line.split("==");
                softwares.push({key: key.toLowerCase(), version: version});
            } else {
                in_pip_deps = false;
                break;
            }
        } else if (in_deps) {
            if (line === "- pip:") {
                in_pip_deps = true;
                continue;
            }
            if (line.startsWith("- ")) {
                const dep_line = line.slice(2);
                const [key, version] = dep_line.split("=");
                softwares.push({key: key.toLowerCase(), version: version});
            } else {
                break;
            }
        }
    }
    return softwares;
}

function toast_notification(header, body, type="", autohide=true, delay=5000) {
    const toastContainer = document.getElementById("toaster");
    const toast = document.getElementById("toast-template").cloneNode(true);
    toast.classList.remove("hide");

    toast.id = '';
    toast.querySelector(".toast-body").innerHTML = body;

    // set the background color based on the type of notification
    if (type !== "") {
        toast.querySelector(".toast-header").classList.add('bg-' + type);
    }
    toast.querySelector(".toast-header-title").innerText = header;

    toastContainer.appendChild(toast);
    const bsToast = new bootstrap.Toast(toast, {autohide: autohide, delay: delay});
    bsToast.show();

    // remove the toast from the DOM after it hides
    toast.addEventListener('hidden.bs.toast', function() {
        toast.remove();
    });
}