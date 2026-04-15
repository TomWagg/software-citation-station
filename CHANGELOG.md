Changelog
---------

# v1.5
- Feat: New button for toggling whether to auto-add dependencies
- Feat: New button for uploading a .txt or .yml/.yaml and parse to auto-add packages from a pip freeze or conda env export call
- Feat: Categories and languages are now defined as lists/arrays so that each software can have multiple, this is also possible on the submission form
- Feat: Add feature_tags as an option in the JSON, which allows you to just cite specific suboptions within the package
- Implementation of the CLI interface `scs`
  - `scs list` - List all available packages
  - `scs show <package>` - Show package details and available versions
  - `scs cite <package...>` - Generate citations with automatic dependency resolution
  - Flags: `--acknowledgement/--ack`, `--bibtex`, `--deps`, `--json`
  - Support for version pinning (e.g., `scipy==1.10.0`)
  - JSON output format support
- Improved CLI help output with clearer flag descriptions
- Added note about default output format (package list, acknowledgement, BibTeX)
- Clarified that package list includes inferred dependencies
- Reorganized examples to show dependencies first

# v1.4
- Bug fix: Zenodo reduced their page limit to 100, so we implemented pagination internally to avoid crashing when asking for Zenodo versions

# v1.3
- Bug fix: Copy information for new software now tracks edits to the initial values

# v1.2
- Better version checking for SCS
- Added ability to link directly to certain packages on the page and auto click them.

# v1.1
First GitHub release
