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

## CLI Installation

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

## CLI Usage

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

# Generate citations (specific versions)
scs cite scipy==1.10.0 numpy==1.24.0

# Show dependencies
scs cite scipy --deps
scs cite scipy numpy --deps --json
```

### Development

This project uses TypeScript for both backend (CLI) and frontend (website). The codebase is organized to share common logic between the CLI and website, eliminating duplication.

### Project Structure

```
src/
├── shared/              # Shared modules used by both CLI and frontend
│   ├── fileParser.ts    # Parse requirements.txt and conda env files
│   ├── dependencyResolver.ts  # Auto-expand package dependencies
│   └── index.ts         # Shared module exports
├── cli/
│   └── cli.ts           # CLI entry point
├── frontend/
│   ├── software.ts      # Main website UI logic
│   ├── darkMode.ts      # Dark mode toggle
│   └── citationCore.ts  # Frontend citation data provider
└── *.ts                 # Other backend modules (citationEngine, bibtex, etc.)
```

### Setup

```bash
# Install dependencies
npm install

# Build everything (backend + frontend)
npm run build:all

# Or build separately:
npm run build          # Backend TypeScript only
npm run build:frontend # Frontend TypeScript bundle
npm run build:timestamp # Generate build timestamp
```

### Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm test -- --coverage
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

### Local Development for Website

For local testing of the website:

```bash
# Build the frontend
npm run build:frontend

# Option 1: Use a simple HTTP server
npx http-server .

# Option 2: Use Python's built-in server
python -m http.server 8000
```

Then open `http://localhost:8000` (or the port shown) in your browser.

**Note:** The frontend loads data from `data/` directory and expects to be served from a web server (not `file://` protocol) due to CORS restrictions.

### CLI Commands

The CLI (`scs`) supports the following commands:

```bash
# List packages
scs list
scs list --json

# Show package details
scs show scipy
scs show numpy --json

# Generate citations
scs cite scipy numpy           # Latest versions, auto-expand dependencies
scs cite scipy --ack           # Acknowledgement only
scs cite scipy --bibtex        # BibTeX only
scs cite scipy==1.10.0         # Specific version
scs cite scipy --no-auto-deps  # Disable auto-dependency expansion

# Parse environment files
scs parse requirements.txt     # Show packages from pip freeze
scs parse environment.yaml     # Show packages from conda env export
scs parse requirements.txt --json --no-auto-deps

# Cite from file
scs cite --file requirements.txt
scs cite -f environment.yaml --deps
```

### Build Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Build backend TypeScript (CLI) |
| `npm run build:frontend` | Build and bundle frontend TypeScript |
| `npm run build:timestamp` | Generate build timestamp file |
| `npm run build:all` | Build everything |
| `npm test` | Run Jest tests |
| `npm run cli` | Run CLI without global install |
| `npm run fetch-versions` | Fetch Zenodo versions cache |

### GitHub Actions Workflows

The project uses GitHub Actions for:

1. **Run Unit Tests** (`test.yml`) - Runs on every push and PR
2. **Deploy to GitHub Pages** (`deploy.yml`) - Builds and deploys the website on push to main
3. **Fetch Zenodo Versions** (`fetch-zenodo-versions.yml`) - Daily update of version cache
4. **Tidy BibTeX** (`bibtex-tidy.yml`) - Auto-format BibTeX files

The deployment workflow:
- Builds backend TypeScript
- Builds and bundles frontend TypeScript to `dist/software.js`
- Generates `dist/build-timestamp.json` with build time
- Deploys the entire repository to GitHub Pages

### Adding Tests

Tests are in `__tests__/` directory using Jest and ts-jest:

```bash
# Run specific test file
npm test -- cli.test.ts

# Run tests matching a pattern
npm test -- --testNamePattern="CLI flag"
```

When adding new shared modules, create corresponding test files in `__tests__/shared/`.
