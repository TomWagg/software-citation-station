# Test Data for File Upload/Parse Feature

This directory contains example files for testing the file upload and parse functionality.

## Files

### requirements.txt
A sample `requirements.txt` file in pip freeze format. Contains common Python packages for scientific computing.

### environment.yaml
A sample conda environment export file. Contains both conda packages and pip packages in the pip subsection.

## How to Test

### On the Website
1. Go to https://zonca.github.io/software-citation-station/
2. Click "Upload and Parse File" button
3. Select either `requirements.txt` or `environment.yaml`
4. The packages will be automatically selected (with dependencies expanded if enabled)

### Using the CLI
```bash
# Cite all packages from file
scs cite --file test-data/requirements.txt
scs cite --file test-data/environment.yaml

# Show dependencies only
scs cite --file test-data/requirements.txt --deps
```

## File Format Support

The parser supports:

### requirements.txt
- Standard pip format: `package==1.0.0`
- Version specifiers: `>=`, `<=`, `~=`, `!=`, `>`, `<`
- Packages with extras: `package[dev,test]`
- Comments (lines starting with `#`)
- Skips `-r` includes and other pip options

### environment.yaml (conda)
- Standard conda environment format
- Python version specification
- Conda packages with versions
- pip subsection for pip-only packages
- Auto-detection by filename or content
