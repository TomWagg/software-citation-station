<div align="center">
  <img width='200px' src='img/software-citation-station.png'>
  <h1>The Software Citation Station</h1>
  <p>A website for making citing software used in your research quick and easy</p>
</div>



<p align="center">
  <a href="https://www.tomwagg.com/software-citation-station/">Visit the software citation station</a>
  • 
  <a href="https://www.tomwagg.com/software-citation-station/?new-software=true">Submit a new citation</a>
  • 
  <a href="https://raw.githubusercontent.com/TomWagg/software-citation-station/main/paper/paper.pdf">Read the paper</a>
</p>

<b>Why is it important to cite software?</b>

<p>
    Software is crucial for the advancement of astronomy and science especially in the context of rapidly growing datasets that increasingly require algorithm and pipeline development to process the data and produce results (<a class="ref-link" href="http://doi.org/10.17226/26141" target="_blank">Academies of Sciences, Engineering, and Medicine 2021</a>). However, software has not always been consistently cited, despite its importance to strengthen support for software
    development (<a class="ref-link" href="https://doi.org/10.1002/asi.23538" target="_blank">Howison & Bullard 2016</a>; <a class="ref-link" href="http://doi.org/10.48550/arXiv.1601.04734" target="_blank">Niemeyer et al. 2016</a>; <a class="ref-link" href="http://doi.org/https://doi.org/10.1016/j.joi.2017.08.003" target="_blank">Li et al. 2017</a>; <a class="ref-link" href="http://doi.org/10.3847/1538-4365/ab7be6" target="_blank">Bouquin et al. 2020</a>;
    <a class="ref-link" href="http://doi.org/https://doi.org/10.1016/j.joi.2021.101139" target="_blank">Alsudais 2021</a>; <a class="ref-link" href="http://doi.org/10.48550/arXiv.2302.07500" target="_blank">Bouquin et al. 2023</a>).
</p>
<p>
    To encourage, streamline, and standardize the process of citing software in academic work such as publications and presentations we introduce The Software Citation Station: a publicly available website and tool to quickly find or add software citations. You can read our paper about the importance of software (citations), resources for software citation, and a description of our tool at
    <a href="https://arxiv.org/abs/2406.04405">this link</a>.
</p>

## CLI

### Installation

The Software Citation Station CLI (`scs`) can be installed globally:

```bash
# Clone the repository
git clone https://github.com/TomWagg/software-citation-station.git
cd software-citation-station

# Install dependencies and build
npm install
npm run build

# Install globally to use 'scs' command
npm install -g .
```

After installation, you can use the `scs` command from anywhere:

```bash
scs --help
```

### Commands

```bash
# List all available packages
scs list
scs list --json

# Show package details
scs show scipy
scs show numpy --json

# Generate citations (latest versions)
scs cite scipy numpy
scs cite scipy --acknowledgement
scs cite scipy --bibtex
scs cite scipy --json

# Generate citations (specific versions)
scs cite scipy==1.10.0 numpy==1.24.0
scs cite scipy==1.10.0 --bibtex

# Show dependencies
scs cite scipy --deps
scs cite scipy numpy --deps --json

# Parse environment files
scs parse requirements.txt
scs parse environment.yaml --json

# Cite from file
scs cite --file requirements.txt
scs cite -f environment.yaml --deps

# Disable auto-dependency expansion
scs cite scipy --no-auto-deps
```

### Testing the CLI during development

Without installing globally, you can test the CLI using:

```bash
npm run cli -- list
npm run cli -- show scipy
npm run cli -- cite scipy numpy
npm run cli -- parse requirements.txt
npm run cli -- cite --file environment.yaml
```

## Development

This project uses TypeScript for both backend (CLI) and frontend (website). The codebase is organized to share common logic between the CLI and website, eliminating duplication.

### Project Structure

```
src/
├── shared/              # Shared modules used by both CLI and frontend
│   ├── fileParser.ts    # Parse requirements.txt and conda env files
│   ├── dependencyResolver.ts  # Auto-expand package dependencies
│   └── index.ts         # Shared module exports
├── frontend/
│   ├── software.ts      # Main website UI logic
│   ├── darkMode.ts      # Dark mode toggle
│   └── citationCore.ts  # Frontend citation data provider
├── cli.ts               # CLI entry point
├── citationEngine.ts    # Citation generation logic
├── remoteData.ts        # Remote data provider
├── bibtex.ts            # BibTeX utilities
└── citationTypes.ts     # TypeScript interfaces
```

### Setup

```bash
# Install dependencies
npm install

# Build everything (backend + frontend)
npm run build:all

# Or build separately:
npm run build          # Backend TypeScript (CLI)
npm run build:frontend # Frontend TypeScript bundle
```

### Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm test -- --coverage
```

### Local Development for Website

For local testing of the website:

```bash
# Build the frontend
npm run build:frontend

# Serve with a local HTTP server
npx http-server .
# or
python -m http.server 8000
```

Then open `http://localhost:8000` in your browser.

**Note:** The frontend requires a web server (not `file://` protocol) due to CORS restrictions.

### Build Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Build backend TypeScript (CLI) |
| `npm run build:frontend` | Build and bundle frontend TypeScript |
| `npm run build:all` | Build everything |
| `npm test` | Run Jest tests |
| `npm run lint` | Run ESLint |
| `npm run cli` | Run CLI without global install |
| `npm run fetch-versions` | Fetch Zenodo versions cache |

### GitHub Actions

The project uses GitHub Actions for:

1. **Unit Tests** - Runs on every push and PR
2. **E2E Tests** - Playwright browser tests
3. **Deploy to GitHub Pages** - Builds and deploys on push to main
4. **Fetch Zenodo Versions** - Daily update of version cache (upstream only)

### Adding Tests

Tests use Jest and are in `__tests__/`:

```bash
# Run specific test file
npm test -- cli.test.ts

# Run tests matching a pattern
npm test -- --testNamePattern="CLI flag"
```
