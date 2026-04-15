Changelog
---------

# Unreleased
- Implementation of the CLI interface `scs`
  - `scs list` - List all available packages
  - `scs show <package>` - Show package details and available versions
  - `scs cite <package...>` - Generate citations with automatic dependency resolution
  - Flags: `--acknowledgement/--ack`, `--bibtex`, `--deps`, `--json`
  - Support for version pinning (e.g., `scipy==1.10.0`)
  - JSON output format support

# v1.4
- Bug fix: Zenodo reduced their page limit to 100, so we implemented pagination internally to avoid crashing when asking for Zenodo versions

# v1.3
- Bug fix: Copy information for new software now tracks edits to the initial values

# v1.2
- Better version checking for SCS
- Added ability to link directly to certain packages on the page and auto click them.

# v1.1
First GitHub release