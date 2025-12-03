# Zenodo Version Cache

This directory contains cached Zenodo version information for packages listed in `citations.json`.

## Structure

Each file is named `{package-name}.json` and contains an array of version objects with the following structure:

```json
[
  {
    "version": "1.0.0",
    "doi": "12345678"
  },
  ...
]
```

The versions are sorted from newest to oldest.

## Automatic Updates

This cache is automatically updated daily at 6:00 AM UTC by the GitHub Action workflow `.github/workflows/fetch-zenodo-versions.yml`.

## Manual Updates

To manually update the cache, run:

```bash
npm install
npm run build
npm run fetch-versions
```

This will fetch the latest version information from the Zenodo API for all packages with a `zenodo_doi` in `citations.json`.
