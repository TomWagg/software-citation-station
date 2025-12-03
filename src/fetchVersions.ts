/**
 * Script to fetch Zenodo version information for all packages
 * Reads from data/citations.json and saves results to data/zenodo-versions/
 */

import * as fs from 'fs';
import * as path from 'path';
import { getZenodoVersionInfo, ZenodoVersion } from './zenodoVersions';

interface PackageInfo {
  zenodo_doi: string;
  [key: string]: any;
}

interface Citations {
  [packageName: string]: PackageInfo;
}

async function fetchAllVersions() {
  // Read citations.json
  const citationsPath = path.join(__dirname, '..', 'data', 'citations.json');
  const citationsData = fs.readFileSync(citationsPath, 'utf-8');
  const citations: Citations = JSON.parse(citationsData);

  // Create output directory if it doesn't exist
  const outputDir = path.join(__dirname, '..', 'data', 'zenodo-versions');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Process each package
  const packages = Object.keys(citations);
  let processed = 0;
  let skipped = 0;
  let failed = 0;

  console.log(`Found ${packages.length} packages to process`);

  for (const packageName of packages) {
    const packageInfo = citations[packageName];
    const zenodoDoi = packageInfo.zenodo_doi;

    // Skip packages without a Zenodo DOI
    if (!zenodoDoi || zenodoDoi.trim() === '') {
      skipped++;
      continue;
    }

    try {
      console.log(`Fetching versions for ${packageName} (DOI: ${zenodoDoi})...`);
      const versions = await getZenodoVersionInfo(zenodoDoi);
      
      // Save to individual JSON file
      const outputPath = path.join(outputDir, `${packageName}.json`);
      fs.writeFileSync(outputPath, JSON.stringify(versions, null, 2), 'utf-8');
      
      console.log(`  ✓ Saved ${versions.length} versions for ${packageName}`);
      processed++;

      // Add a small delay to avoid rate limiting
      const RATE_LIMIT_DELAY_MS = 100;
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
    } catch (error) {
      console.error(`  ✗ Failed to fetch versions for ${packageName}:`, error);
      failed++;
    }
  }

  console.log(`\nSummary:`);
  console.log(`  Processed: ${processed}`);
  console.log(`  Skipped (no DOI): ${skipped}`);
  console.log(`  Failed: ${failed}`);
}

// Run the script
fetchAllVersions().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
