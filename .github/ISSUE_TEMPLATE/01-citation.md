---
name: New software
about: Submit a new software citation to be included!
title: ''
labels: new-citation
assignees: ''

---
Fill out the sections below with the information about the software package, here's your task list
- [ ] Write a description
- [ ] Link a website showing this is how the software should be cited
- [ ] Create data for the citation
- [ ] Insert related bibtex
- [ ] (optionally) add a logo file

# Description
[Briefly describe the software and what it's used for.]

# Software citation preference
[Please add a link demonstrating that the citation information you add is the preference of the package (or highlight that you're the primary author if that info isn't in your docs)]

# Citation data
[Please fill out the data with the information about your citation]
```
"YOUR_PACKAGE_NAME_HERE": {
    "tags": [""],               # bibtex tags for citations
    "language": "",             # programming language
    "category": "",             # choose a general category (check the site for current list)
    "keywords": [""],           # list any keywords for searching
    "description": "",          # short description of the software
    "link": ""                  # URL to documentation
    "version_cite_link": "",    # (optional) if this software requests a specific version be cited, include a link to a page describing how to do this
    "attribution_link": "",     # link confirming this is how the software should be cited
    "custom_citation": ""       # (optional) custom citation string to overwrite the default
}
```
(See other examples [here](https://github.com/TomWagg/software-citation-station/blob/main/data/citations.json))


# Bibtex
[Insert your bibtex entry/entries below - ensure tags match those listed above]
```
Your bibtex here
```
(See other examples [here](https://github.com/TomWagg/software-citation-station/blob/main/data/bibtex.bib))

# Logo (optional)
Either attach or link a file for a logo for the package. **Please ensure this image is free to use**. Square logos are preferred if available.