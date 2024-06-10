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

        if (citations[key].hasOwnProperty("dependencies")) {
            btn.setAttribute("data-dependencies", citations[key]["dependencies"].join(","))
        } else {
            btn.setAttribute("data-dependencies", "")
        }
        btn.querySelector(".software-name").innerHTML = "<pre>" + key + "</pre>";
        btn.id = "";

        // track all unique categories and languages
        const cat = capitalise(citations[key]["category"]);
        btn.setAttribute("data-category", cat);
        categories.add(cat);

        const lang = citations[key]["language"];

        if (typeof(lang) === "string") {
            const lang_string = capitalise(lang);
            btn.setAttribute("data-language", lang_string)
            languages.add(lang_string);
        } else {
            btn.setAttribute("data-language", lang.map(x => capitalise(x)).join(", "))
            for (let x of lang) {
                languages.add(capitalise(x));
            }
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
        document.getElementById("new-software-dependencies").appendChild(dep_toggle);

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

            // if the button is now un-selected then hide the version picker if it exists
            if (!this.classList.contains("active")) {
                const vp = document.getElementById(`${this.getAttribute("data-key")}-version-picker`);
                if (vp !== null) {
                    vp.classList.add("hide");
                }
            } else {
                // if the package has dependencies, find all of them and select them
                const deps = collect_dependencies(new Set(), this.getAttribute("data-key"));
                let previously_unselected = [];
                for (let dep of deps) {
                    const dep_btn = document.querySelector(`.software-button[data-key="${dep}"]`);
                    if (!dep_btn.classList.contains("active")) {
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

            // hide the tooltip if it's open
            tooltip.hide();

            // keep track of the acknowledgements and bibtex entries to add
            let ack_to_add = [];
            let custom_acks_to_add = [];
            let bibs_to_add = [];

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
                // get the tags for the current button
                let btn_tags = btn.getAttribute("data-tags").split(",");

                // add the acknowledgement and do some simple latex syntax highlighting
                let new_ack = "\\texttt{" + btn.querySelector(".software-name").innerText + "}";
                if (btn_tags.length > 0 && btn_tags[0] !== "") {
                    new_ack += " \\citep{" + btn_tags.join(", ") + "}"
                }

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
                        get_zenodo_version_info(zenodo_doi, vp);
                        document.getElementById("version-list").appendChild(vp);

                        // make a note that the user needs to select a version
                        new_ack += "\\footnote{{TODO}: Need to choose a version to cite!!}"
                    } else {
                        // otherwise just show the version picker if it's hidden
                        version_picker.classList.remove("hide");

                        // if you've selected a version then update the citation
                        if (version_picker.hasAttribute("data-bibtex")) {
                            const chosen_version = version_picker.querySelector(".version-select").value;
                            if (new_ack.includes("citep")) {
                                new_ack = new_ack.slice(0, -1) + ", " + btn.getAttribute("data-key") + "_" + chosen_version + "}";
                            } else {
                                new_ack += " \\citep{" + btn.getAttribute("data-key") + "_" + chosen_version + "}";
                            }
                            bibs_to_add.push(highlight_bibtex(version_picker.getAttribute("data-bibtex")));
                        } else {
                            new_ack += "\\footnote{{TODO}: Need to choose a version to cite!!}"
                        }
                    }
                }

                // check if the software has a custom acknowledgement
                const custom_ack = citations[btn.getAttribute("data-key")]["custom_citation"];
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
            ack.innerHTML += "\n\n" + highlight_latex("Software citation information aggregated using \\texttt{\\href{https://www.tomwagg.com/software-citation-station/}{The Software Citation Station}} \\citep{software-citation-station-paper, software-citation-station-zenodo}.");

            // add the bibtex entries
            bibs_to_add.push(highlight_bibtex(bibtex_table['software-citation-station-paper']))
            bibs_to_add.push(highlight_bibtex(bibtex_table['software-citation-station-zenodo']))
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

    // hide the loading overlay
    document.getElementById("software-loading").classList.add("hide");
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
            if (this.value === "new") {
                this.nextElementSibling.classList.remove("hide");
                this.nextElementSibling.focus();
            } else {
                this.nextElementSibling.classList.add("hide");
            }
        })
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

        // check if the language is a list of languages
        if (lang_string.includes(",")) {
            // split the languages and check if the current language is in the list
            const langs = lang_string.split(",");
            for (let lang of langs) {
                if (lang.trim() === language) {
                    matches_lang = true;
                }
            }
        } else {
            // otherwise, just check if the language matches
            matches_lang = lang_string === language;
        }

        // combine all of the search criteria
        const matches_search = ((btn_key.includes(search) || btn_keywords.includes(search))
                                && (category === "all" || btn.getAttribute("data-category").toLowerCase() === category)
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

// custom function for sorting version strings
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

async function validate_zenodo_doi(concept_doi) {
    // don't bother if the DOI is empty
    if (concept_doi === "") {
        return [-1, concept_doi];
    }

    // build the url and make the request
    const url = `https://zenodo.org/api/records?q=conceptdoi:"${concept_doi}"&all_versions=true`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    // grab the data from the response in JSON format
    const data = await response.json();

    // if we didn't find anything then maybe the user entered a specific version DOI accidentally
    if (data.hits.hits.length === 0) {
        // retry by searching for the DOI assuming it's not a concept DOI
        const url = `https://zenodo.org/api/records?q=doi:"${concept_doi}"&all_versions=true`;
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

    // check the category and language selects. Both should not have value of "-", and if they have a value of "new" then the next input should not be empty
    for (let select of form.querySelectorAll("#new-software-category, #new-software-language")) {
        const select_new_input = select.nextElementSibling;
        if (select.value === "-") {
            select.setCustomValidity("Please select a category/language.");
            select_new_input.setCustomValidity("Please select a category/language.");
            select.parentElement.querySelector(".invalid-feedback").innerHTML = "No value selected.";
        } else if (select.value === "new" && select.nextElementSibling.value.trim() === "") {
            select.setCustomValidity("Please enter a new category/language.");
            select_new_input.setCustomValidity("Please enter a new category/language.");
            select.parentElement.querySelector(".invalid-feedback").innerHTML = "New value not entered.";
        } else {
            select.setCustomValidity("");
            select.nextElementSibling.setCustomValidity("");
        }
    }

    const keywords = document.getElementById("new-software-keywords").value.trim().split(",").map((kw) => kw.trim());
    const keyword_spans = keywords.map((kw) => `<span class='badge text-bg-success'>${kw}</span>`);
    document.getElementById("new-software-keywords").parentElement.querySelector(".valid-feedback").innerHTML = "Keywords detected: " + keyword_spans.join(" ");

    const doi_input = form.querySelector("#new-software-doi");

    validate_zenodo_doi(doi_input.value.trim()).then((results) => {
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
            doi_input.parentElement.querySelector(".valid-feedback").innerHTML = n_versions > 0 ? ("DOI found on Zenodo with " + n_versions + " versions.") : "No DOI provided.";
        }

        // perform the rest of the validation
        let valid = form.checkValidity();
        if (valid) {
            let json = {}

            let language = form.querySelector("#new-software-language").value.trim();
            if (language === "new") {
                language = form.querySelector("#new-software-language-new").value.trim();
            }
            let category = form.querySelector("#new-software-category").value.trim();
            if (category === "new") {
                category = form.querySelector("#new-software-category-new").value.trim();
            }

            const dep_toggles = form.querySelectorAll("#new-software-dependencies .dependency-toggle.text-bg-primary")
            let deps = [];
            if (dep_toggles.length > 0) {
                for (let toggle of dep_toggles) {
                    deps.push(toggle.innerText);
                }
            }

            const name = form.querySelector("#new-software-name").value.trim();
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

            document.getElementById("copy-new-software").addEventListener('click', function() {
                navigator.clipboard.writeText(copy_text);
                const url = `https://github.com/TomWagg/software-citation-station/issues/new?assignees=&labels=new-citation&projects=&template=01-citation.md&title=[NEW SUBMISSION] ${name}`
                window.open(url, "_blank");
            });
        }
        form.classList.add('was-validated');
        loader.classList.add("hide");
    });

    return false;
}

function collect_dependencies(dep_set, id) {
    // recursively gather dependencies for a given software package
    const software_btn = document.querySelector(`.software-button[data-key='${id}']`)
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