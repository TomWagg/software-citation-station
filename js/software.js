Promise.all([
    fetch('data/tags.json').then(x => x.json()),
    fetch('data/bibtex.bib').then(x => x.text())
  ]).then(([packages, bibtex]) => {
    console.log(packages);
    const template_btn = document.getElementById('software-btn-template');
    const software_list = document.getElementById('software-list');
    for (var key in packages) {
        const btn = template_btn.cloneNode(true);
        btn.querySelector(".software-name").innerText = key;
        btn.querySelector(".software-logo").src = packages[key]["logo"];
        btn.classList.remove("hide");
        software_list.appendChild(btn);
    }
  });
