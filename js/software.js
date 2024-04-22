// bibtex regular expression to extract the tags
const bibtex_re = /@\w*{(?<tag>.*)(?=\,)/gmi;

// latex regular expression to extract each command and arguments
const latex_re = /(?<command>\\[^\\{]*)\{(?<refs>[^\}]*)\}/gmi;

// Fetch the data and populate the software list
Promise.all([
    fetch('data/tags.json').then(x => x.json()),
    fetch('data/bibtex.bib').then(x => x.text())
]).then(([packages, bibtex_text]) => {
    // parse the bibtex file
    let bibtex_table = parse_bibtex(bibtex_text);

    // grab the relevant elements from the DOM
    const template_btn = document.getElementById('software-btn-template');
    const software_list = document.getElementById('software-list');
    const ack = document.getElementById("acknowledgement");
    const bibtex_box = document.getElementById("bibtex");

    // setup each button
    for (var key in packages) {
        // clone the template button and populate it with the relevant data
        const btn = template_btn.cloneNode(true);
        btn.setAttribute("data-key", key)
        btn.querySelector(".software-name").innerText = key;
        btn.querySelector(".software-logo").src = packages[key]["logo"];
        
        // add a click event to the button
        btn.addEventListener('click', function() {
            // toggle the active class
            this.classList.toggle("active");

            // keep track of the acknowledgements and bibtex entries to add
            let ack_to_add = [];
            let bibs_to_add = [];

            // loop through all active buttons and add the relevant information
            document.querySelectorAll(".software-item.active").forEach(function(btn) {
                // get the tags for the current button
                let btn_tags = packages[btn.getAttribute("data-key")]["tags"];

                // add the acknowledgement and do some simple latex syntax highlighting
                let new_ack = "\\texttt{" + btn.querySelector(".software-name").innerText + "} \\citep{" + btn_tags.join(", ") + "}"
                ack_to_add.push(new_ack.replace(latex_re, function(match, command, refs) {
                    return '<span class="latex-command">' + command + '</span>{<span class="latex-refs">' + refs + "</span>}";
                }));

                // same for the bibtex
                for (let tag of btn_tags) {
                    bibs_to_add.push(highlight_bibtex(bibtex_table[tag]));
                }
            });

            // add a preamble to the acknowledgement
            ack.innerHTML = "This work made use of the following software packages: "

            // add add acknowledgements, joining them with commas and adding an "and" before the last one
            ack.innerHTML += ack_to_add.slice(0, -1).join(', ') + (ack_to_add.length > 1 ? ' and ' : '') + ack_to_add.slice(-1) + '.';

            // add the bibtex entries
            bibtex_box.innerHTML = bibs_to_add.join("\n\n");

            // create a button that copies the contents of each
            for (let to_be_copied of [ack, bibtex_box]) {
                let copy_btn = document.getElementById("copy-template").cloneNode(true);
                copy_btn.className = "btn btn-dark copy-button"
                copy_btn.id = ""
                copy_btn.addEventListener('click', function() {
                    navigator.clipboard.writeText(to_be_copied.innerText);
                });
                to_be_copied.appendChild(copy_btn)
            }
        });

        // unhide the button and add it to the list
        btn.classList.remove("hide");
        software_list.appendChild(btn);
    }
});

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

function highlight_bibtex(s) {
    // highlight the bibtex entry with some simple syntax highlighting around the format and key
    let at_thing = s.split("{")[0];
    let key = s.split("{")[1].split(",")[0];
    rest_starts_at = at_thing.length + key.length + 1;
    return "<span class='bibtex-format'>" + at_thing + "</span>{<span class='bibtex-key'>" + key + "</span>" + s.slice(rest_starts_at);
}