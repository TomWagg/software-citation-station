# Schema for citations.json

The following is a description of the possible fields in the ``citations.json`` file

```
    "PACKAGE_NAME": {
        "tags": [],                     # Associated BibTeX tags
        "logo": "",                     # Path to logo file (could technically be a URL)
        "logo_background": false,       # [OPTIONAL] Whether to apply a white background behind the logo (default: false)
        "language": "",                 # Programming language of the package
        "category": "",                 # Category for filtering
        "keywords": [],                 # A list of keywords for searching
        "description": "",              # A description limited to 200 characters
        "link": "",                     # A URL to the documentation
        "attribution_link": "",         # A URL to a webpage stating the desired citation format of the package
        "zenodo_doi": "",               # [OPTIONAL] The **concept** DOI for the package on Zenodo
        "custom_citation": "",          # [OPTIONAL] A custom citation statement to override the default
        "dependencies": [],             # [OPTIONAL] A list of package names currently on the site on which this package depends
        "frequently_used": false        # [OPTIONAL] Whether this package is frequently used by the community (default: false)
    },
```