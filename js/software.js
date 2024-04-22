const bibtex_re = /@\w*{(?<tag>.*)(?=\,)/gmi;
const latex_re = /(?<command>\\[^\\{]*)\{(?<refs>[^\}]*)\}/gmi;

Promise.all([
    fetch('data/tags.json').then(x => x.json()),
    fetch('data/bibtex.bib').then(x => x.text())
]).then(([packages, bibtex_text]) => {
    let bibtex_table = parse_bibtex(bibtex_text);
    const template_btn = document.getElementById('software-btn-template');
    const software_list = document.getElementById('software-list');
    const ack = document.getElementById("acknowledgement");
    const bibtex_box = document.getElementById("bibtex");
    for (var key in packages) {
        const btn = template_btn.cloneNode(true);

        btn.setAttribute("data-key", key)

        btn.querySelector(".software-name").innerText = key;
        btn.querySelector(".software-logo").src = packages[key]["logo"];
        
        btn.addEventListener('click', function() {
            this.classList.toggle("active");
            ack.innerText = "";
            bibtex_box.innerHTML = "";
            let ack_to_add = [];
            let bibtex_strings_to_add = [];
            document.querySelectorAll(".software-item.active").forEach(function(btn) {
                let btn_tags = packages[btn.getAttribute("data-key")]["tags"];

                let new_ack = "\\texttt{" + btn.querySelector(".software-name").innerText + "} \\citep{" + btn_tags.join(", ") + "}"
                ack_to_add.push(new_ack.replace(latex_re, function(match, command, refs) {
                    return '<span class="latex-command">' + command + '</span>{<span class="latex-refs">' + refs + "</span>}";
                }));
                for (let tag of btn_tags) {
                    bibtex_strings_to_add.push(highlight_bibtex(bibtex_table[tag]));
                }
            });

            ack.innerHTML = "This work made use of the following software packages: "
            ack.innerHTML += ack_to_add.slice(0, -1).join(', ') + (ack_to_add.length > 1 ? ' and ' : '') + ack_to_add.slice(-1) + '.';
            bibtex_box.innerHTML = bibtex_strings_to_add.join("\n\n");
            console.log(packages[this.getAttribute("data-key")]["tags"]);
        });

        btn.classList.remove("hide");
        software_list.appendChild(btn);
    }
});

function parse_bibtex(bibtex_text) {
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
    let at_thing = s.split("{")[0];
    let key = s.split("{")[1].split(",")[0];
    rest_starts_at = at_thing.length + key.length + 1;
    return "<span class='bibtex-format'>" + at_thing + "</span>{<span class='bibtex-key'>" + key + "</span>" + s.slice(rest_starts_at);
}