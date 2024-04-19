Promise.all([
    fetch('data/tags.json').then(x => x.json()),
    fetch('data/bibtex.bib').then(x => x.text())
]).then(([packages, bibtex]) => {
    console.log(packages);
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