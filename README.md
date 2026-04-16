<div align="center">
  <img width='200px' src='img/software-citation-station.png'>
  <h1>The Software Citation Station</h1>
  <p>A website for making citing software used in your research quick and easy</p>
</div>

<p align="center">
  <a href="https://www.tomwagg.com/software-citation-station/">🌐 Visit the website</a>
  •
  <a href="https://www.tomwagg.com/software-citation-station/?new-software=true">✏️ Submit a new citation</a>
  •
  <a href="https://raw.githubusercontent.com/TomWagg/software-citation-station/main/paper/paper.pdf">📄 Read the paper</a>
</p>

---

## Why Cite Software?

Software is crucial for the advancement of astronomy and science, especially in the context of rapidly growing datasets that increasingly require algorithm and pipeline development. However, software has not always been consistently cited, despite its importance to strengthen support for software development.

**Key references:**
- Academies of Sciences, Engineering, and Medicine (2021) - [DOI: 10.17226/26141](http://doi.org/10.17226/26141)
- Howison & Bullard (2016) - [DOI: 10.1002/asi.23538](https://doi.org/10.1002/asi.23538)
- Niemeyer et al. (2016) - [arXiv:1601.04734](http://doi.org/10.48550/arXiv.1601.04734)
- Li et al. (2017) - [DOI: 10.1016/j.joi.2017.08.003](http://doi.org/https://doi.org/10.1016/j.joi.2017.08.003)
- Bouquin et al. (2020) - [DOI: 10.3847/1538-4365/ab7be6](http://doi.org/10.3847/1538-4365/ab7be6)
- Alsudais (2021) - [DOI: 10.1016/j.joi.2021.101139](http://doi.org/https://doi.org/10.1016/j.joi.2021.101139)
- Bouquin et al. (2023) - [arXiv:2302.07500](http://doi.org/10.48550/arXiv.2302.07500)

The Software Citation Station streamlines and standardizes the process of citing software in academic work. Read our paper at [arXiv:2406.04405](https://arxiv.org/abs/2406.04405).

---

## CLI

### Installation

```bash
# Clone and install
git clone https://github.com/TomWagg/software-citation-station.git
cd software-citation-station
npm install
npm run build
npm install -g .
```

### Commands

```bash
# List packages
scs list
scs list --json

# Show package details
scs show scipy
scs show numpy --json

# Generate citations
scs cite scipy numpy                    # Latest versions
scs cite scipy==1.10.0 numpy==1.24.0   # Specific versions
scs cite scipy --ack                    # Acknowledgement only
scs cite scipy --bibtex                 # BibTeX only
scs cite scipy --deps                   # Show dependencies

# Parse files
scs parse requirements.txt
scs parse environment.yaml --json
scs cite --file requirements.txt        # Cite from file

# Options
scs cite scipy --no-auto-deps           # Disable auto-dependencies
```

### Development Testing

```bash
npm run cli -- list
npm run cli -- show scipy
npm run cli -- cite scipy numpy
npm run cli -- parse requirements.txt
```

---

## Development

### Project Structure

```
src/
├── shared/                    # Shared modules (CLI + frontend)
│   ├── fileParser.ts          # Parse requirements.txt, conda env files
│   ├── dependencyResolver.ts  # Auto-expand package dependencies
│   └── index.ts
├── frontend/
│   ├── software.ts            # Main UI logic
│   ├── darkMode.ts            # Dark mode toggle
│   └── citationCore.ts        # Frontend data provider
├── cli.ts                     # CLI entry point
├── citationEngine.ts          # Citation generation
├── remoteData.ts              # Data provider
├── bibtex.ts                  # BibTeX utilities
└── citationTypes.ts           # TypeScript interfaces
```

### Setup

```bash
npm install
npm run build:all              # Build everything
# or
npm run build                  # Backend only
npm run build:frontend         # Frontend only
```

### Testing

```bash
npm test                       # Run all tests
npm test -- --coverage         # With coverage
npm run lint                   # ESLint check
npm run lint:fix               # Auto-fix issues
```

### Local Website Development

```bash
npm run build:frontend
npx http-server .              # or: python -m http.server 8000
```

Visit `http://localhost:8000`. Requires HTTP server (CORS restrictions).

### Build Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Build backend TypeScript (CLI) |
| `npm run build:frontend` | Build frontend bundle |
| `npm run build:all` | Build everything |
| `npm test` | Run Jest tests |
| `npm run lint` | Run ESLint |
| `npm run cli` | Run CLI locally |
| `npm run fetch-versions` | Update Zenodo cache |

### GitHub Actions

- **Unit Tests** - Jest on every push/PR
- **E2E Tests** - Playwright browser tests
- **Deploy** - GitHub Pages on push to main
- **Zenodo Cache** - Daily version updates (upstream only)

---

## Contributing

### Adding Tests

Tests use Jest (`__tests__/` directory):

```bash
npm test -- cli.test.ts
npm test -- --testNamePattern="CLI flag"
```

### Submitting New Software

Use the CLI to generate a submission template:

```bash
scs submit mypackage
scs submit mypackage --json
scs submit mypackage --link "https://..." --description "..." --attribution-link "https://..."
```

Or visit the website: [Submit a new citation](https://www.tomwagg.com/software-citation-station/?new-software=true)

---

## License

Same as upstream repository.

## Acknowledgements

Developed by Andrea Zonca (@zonca)  
Based on The Software Citation Station by Tom Wagg (@tomwagg)
