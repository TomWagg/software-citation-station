import { Command } from 'commander';
import { fetchCitations, fetchBibtex } from '../dataFetcher.js';
import { getVersionDoi, fetchZenodoBibtexLive } from '../zenodoFetcher.js';
// @ts-ignore
import { parsePackageInput, collectDependencies, generateAcknowledgment, generateBibtex, parseBibtex } from '../../../js/citationCore.js';
import { Citations, CitationOutput } from '../types.js';

export const citeCommand = new Command('cite')
  .description('Generate citations for software packages')
  .argument('[packages...]', 'Packages to cite (e.g. numpy, astropy==6.0.1, astropy[fitting])')
  .option('-d, --dependencies-only', 'Output only resolved dependencies')
  .option('-a, --acknowledgments', 'Output only LaTeX acknowledgments')
  .option('-b, --bibtex', 'Output only BibTeX entries')
  .option('-j, --json', 'Output as JSON')
  .option('-f, --features <features>', 'Comma-separated features (applies to all packages)')
  .option('--refresh-cache', 'Force refresh all cached data')
  .action(async (packages: string[], options: any) => {
    try {
      const citations: Citations = await fetchCitations(options.refreshCache);
      const bibtexRaw = await fetchBibtex(options.refreshCache);
      const bibtexTable = parseBibtex(bibtexRaw);

      let selectedPackageKeys: string[] = [];
      let featureSelections: Record<string, string[]> = {};
      let zenodoBibtexMap = new Map<string, { bibtex: string, tag: string }>();

      // Parse --features global option
      const globalFeatures = options.features ? options.features.split(',').map((f: string) => f.trim()) : [];

      for (const pkgInput of packages) {
        const parsed = parsePackageInput(pkgInput);
        
        // Find match in citations.json (case insensitive key check)
        const match = Object.keys(citations).find(k => k.toLowerCase() === parsed.name.toLowerCase());
        if (!match) {
          console.warn(`Warning: Package "${parsed.name}" not found in citations data.`);
          continue;
        }

        selectedPackageKeys.push(match);
        
        // Combine features from input and global option
        const features = [...(parsed.features || []), ...globalFeatures];
        if (features.length > 0) {
          featureSelections[match] = features;
        }

        // Handle versioned Zenodo citation
        if (parsed.version && citations[match].zenodo_doi) {
          const recordId = await getVersionDoi(match, citations[match].zenodo_doi, parsed.version);
          if (recordId) {
            const zenodoBibtex = await fetchZenodoBibtexLive(recordId, match);
            zenodoBibtexMap.set(match, { 
              bibtex: zenodoBibtex, 
              tag: `${match}_${recordId}` 
            });
          } else {
            console.warn(`Warning: Version "${parsed.version}" for package "${match}" not found on Zenodo. Using base citation.`);
          }
        }
      }

      // Resolve dependencies recursively
      const allPackageKeys = new Set<string>();
      for (const key of selectedPackageKeys) {
        allPackageKeys.add(key);
        collectDependencies(allPackageKeys, key, citations);
      }

      const sortedAllKeys = Array.from(allPackageKeys).sort();

      // Generate outputs
      const acknowledgment = generateAcknowledgment(selectedPackageKeys, citations, featureSelections, zenodoBibtexMap);
      const bibtex = generateBibtex(selectedPackageKeys, citations, bibtexTable, featureSelections, zenodoBibtexMap);

      if (options.json) {
        const output: CitationOutput = {
          packages: selectedPackageKeys,
          timestamp: new Date().toISOString(),
          dependencies: Object.fromEntries(
            selectedPackageKeys.map(k => [k, Array.from(collectDependencies(new Set<string>(), k, citations)).sort()])
          ),
          acknowledgments: acknowledgment,
          bibtex: bibtex
        };
        console.log(JSON.stringify(output, null, 2));
        return;
      }

      if (options.dependenciesOnly) {
        console.log("Resolved Dependencies:");
        console.log(sortedAllKeys.join('\n'));
      } else if (options.acknowledgments) {
        console.log(acknowledgment);
      } else if (options.bibtex) {
        console.log(bibtex);
      } else {
        console.log("Acknowledgments:");
        console.log("---------------");
        console.log(acknowledgment);
        console.log("\nBibTeX entries:");
        console.log("---------------");
        console.log(bibtex);
      }

    } catch (error: any) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  });
