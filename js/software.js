//const re = /"@\\w*{.*(?=\\,)"/g;
const re = /@\w*{(?<tag>.*)(?=\,)/gmi;

Promise.all([
    fetch('data/tags.json').then(x => x.json()),
    fetch('data/bibtex.bib').then(x => x.text())
]).then(([packages, bibtex_text]) => {
    console.log(packages);
    console.log(bibtex_text);
    console.log(parse_bibtex(bibtex_text));
    const template_btn = document.getElementById('software-btn-template');
    const software_list = document.getElementById('software-list');
    const acknowledgement = document.getElementById("acknowledgement");
    for (var key in packages) {
        const btn = template_btn.cloneNode(true);

        btn.setAttribute("data-key", key)

        btn.querySelector(".software-name").innerText = key;
        btn.querySelector(".software-logo").src = packages[key]["logo"];
        
        btn.addEventListener('click', function() {
            this.classList.toggle("active");
            acknowledgement.innerText = "";
            document.querySelectorAll(".software-item.active").forEach(function(btn) {
                acknowledgement.innerHTML = add_to_acknowledgement(
                    acknowledgement.innerHTML,
                    btn.querySelector(".software-name").innerText,
                    packages[btn.getAttribute("data-key")]["tags"]
                );
                console.log(btn.getAttribute("data-key"));
            });
            console.log(packages[this.getAttribute("data-key")]["tags"]);
        });

        btn.classList.remove("hide");
        software_list.appendChild(btn);
    }
});


function add_to_acknowledgement(ack, name, tags) {
    if (ack === "") {
        ack = "This work made use of the following software packages: ";
    }
    ack += "\\texttt{" + name + "} \\citep{" + tags.join(", ") + "}, ";
    return ack
}

function parse_bibtex(bibtex_text) {
    let tags = [];
    let entries = [];

    console.log(bibtex_text.match(re))
    console.log([...bibtex_text.matchAll(re)])

    while ((match = re.exec(bibtex_text)) != null) {
        console.log("match found at " + match.index, match.groups["tag"]);
    }

    // console.log(bibtex_text.matchAll(re));

    //do {
    //    m = re.exec(bibtex_text);
     //   if (m) {
      //      console.log(m[1], m[2]);
      //  }
    //} while (m);
    

    /*for (let i = 0; i < lines.length; i++) {
        if (line.startsWith("@")) {
            let entry = isolate_bibtex_entry(lines, i);
            entries.push(entry);
            i += entry.split("\n").length;
        }
    }*/
}

function isolate_bibtex_entry(s, start) {
    // isolate a bibtex entry based on closing curly braces
    let braces = 0;
    let cursor = start;
    let not_opened = true;
    while (braces > 0 || not_opened) {
        if (s[cursor] == "{") {
            braces += 1
            not_opened = False
        } else if (s[cursor] == "}") {
            braces -= 1
        }
        cursor += 1
    }
    return s.slice(start, cursor)
}