import { Command } from 'commander';
import { fetchCitations } from '../dataFetcher.js';
import { getZenodoVersionInfoCached } from '../zenodoFetcher.js';
import { Citations } from '../types.js';

export const showCommand = new Command('show')
  .description('Display detailed package information')
  .argument('<package>', 'Package name')
  .option('--refresh-cache', 'Force refresh cached data')
  .action(async (packageName: string, options: any) => {
    try {
      const citations: Citations = await fetchCitations(options.refreshCache);
      
      const match = Object.keys(citations).find(k => k.toLowerCase() === packageName.toLowerCase());
      if (!match) {
        console.error(`Error: Package "${packageName}" not found.`);
        process.exit(1);
      }

      const entry = citations[match];
      console.log(`Package: ${match}`);
      console.log(`Description: ${entry.description}`);
      console.log(`Category: ${Array.isArray(entry.category) ? entry.category.join(', ') : entry.category}`);
      console.log(`Language: ${Array.isArray(entry.language) ? entry.language.join(', ') : entry.language}`);
      console.log(`Dependencies: ${entry.dependencies.length > 0 ? entry.dependencies.join(', ') : 'None'}`);
      console.log(`Tags: ${entry.tags.join(', ')}`);
      console.log(`Link: ${entry.link}`);
      console.log(`Attribution: ${entry.attribution_link}`);
      if (entry.zenodo_doi) {
        console.log(`Zenodo DOI: ${entry.zenodo_doi}`);
        const versionData = await getZenodoVersionInfoCached(match, entry.zenodo_doi);
        console.log(`Available Versions: ${versionData.versions.map(v => v.version).join(', ')}`);
      }

    } catch (error: any) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  });
