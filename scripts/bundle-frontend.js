#!/usr/bin/env node

/**
 * Bundle frontend TypeScript modules into a single software.js file
 * Combines all frontend modules and wraps them for browser execution
 */

const fs = require('fs');
const path = require('path');

const DIST_DIR = path.join(__dirname, '..', 'dist');
const FRONTEND_DIST_DIR = path.join(DIST_DIR, 'frontend');
const OUTPUT_FILE = path.join(DIST_DIR, 'software.js');

// Read all compiled frontend modules
function readModule(filename) {
  const filePath = path.join(FRONTEND_DIST_DIR, filename);
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf-8');
  }
  return '';
}

// Read all frontend modules
const darkMode = readModule('darkMode.js');
const citationCore = readModule('citationCore.js');
const software = readModule('software.js');
const softwareUI = readModule('softwareUI.js');

// Create bundled output
const bundle = `/**
 * Software Citation Station - Frontend Bundle
 * Generated automatically by bundle-frontend.js
 * Build time: ${new Date().toISOString()}
 */

(function() {
  'use strict';

  // Dark mode module
  ${darkMode.replace(/export /g, '')}

  // Citation core module
  ${citationCore.replace(/export /g, '')}

  // Software UI module
  ${software.replace(/export /g, '')}
  ${softwareUI.replace(/export /g, '')}

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initDarkMode();
      initSoftwareCitationStation();
    });
  } else {
    initDarkMode();
    initSoftwareCitationStation();
  }
})();
`;

// Ensure dist directory exists
if (!fs.existsSync(DIST_DIR)) {
  fs.mkdirSync(DIST_DIR, { recursive: true });
}

// Write bundled file
fs.writeFileSync(OUTPUT_FILE, bundle, 'utf-8');
console.log(`Bundled frontend modules to ${OUTPUT_FILE}`);

// Also copy to js/ directory for local development
const JS_DIR = path.join(__dirname, '..', 'js');
if (fs.existsSync(JS_DIR)) {
  fs.copyFileSync(OUTPUT_FILE, path.join(JS_DIR, 'software.bundle.js'));
  console.log(`Copied bundle to ${path.join(JS_DIR, 'software.bundle.js')}`);
}
