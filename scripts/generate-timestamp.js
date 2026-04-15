#!/usr/bin/env node

/**
 * Generate build timestamp file
 * Creates a JSON file with build information for display on the website
 */

const fs = require('fs');
const path = require('path');

const DIST_DIR = path.join(__dirname, '..', 'dist');
const OUTPUT_FILE = path.join(DIST_DIR, 'build-timestamp.json');

const now = new Date();

// Format UTC time
const utcOptions = {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZoneName: 'short',
  timeZone: 'UTC'
};

// Format PST time (US Pacific)
const pstOptions = {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZoneName: 'short',
  timeZone: 'America/Los_Angeles'
};

const timestamp = {
  buildTime: now.toISOString(),
  buildTimeFormatted: now.toLocaleString('en-US', utcOptions),
  buildTimePST: now.toLocaleString('en-US', pstOptions),
  gitCommit: process.env.GITHUB_SHA || 'local-build',
  gitRef: process.env.GITHUB_REF || 'unknown'
};

// Ensure dist directory exists
if (!fs.existsSync(DIST_DIR)) {
  fs.mkdirSync(DIST_DIR, { recursive: true });
}

// Write timestamp file
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(timestamp, null, 2), 'utf-8');
console.log(`Generated build timestamp: ${OUTPUT_FILE}`);
console.log(`Build time (UTC): ${timestamp.buildTimeFormatted}`);
console.log(`Build time (PST): ${timestamp.buildTimePST}`);
