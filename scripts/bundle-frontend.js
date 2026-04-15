#!/usr/bin/env node

/**
 * Bundle frontend TypeScript modules into a single software.js file
 * Combines all frontend modules and wraps them for browser execution
 */

const fs = require('fs');
const path = require('path');

const DIST_DIR = path.join(__dirname, '..', 'dist');
const FRONTEND_DIST_DIR = path.join(DIST_DIR, 'frontend', 'frontend');
const SHARED_DIST_DIR = path.join(DIST_DIR, 'frontend', 'shared');
const OUTPUT_FILE = path.join(DIST_DIR, 'software.js');

// Read all compiled frontend modules
function readModule(dir, filename) {
  const filePath = path.join(dir, filename);
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf-8');
  }
  console.warn(`Warning: Module not found: ${filePath}`);
  return '';
}

// Remove import/export statements for bundling
function removeImportsExports(code) {
  return code
    .replace(/^import\s+[\s\S]*?from\s+['"][^'"]+['"]\s*;?\s*/gm, '')
    .replace(/^export\s+/gm, '')
    .replace(/^export\s+\*\s+from\s+['"][^'"]+['"]\s*;?\s*/gm, '');
}

// Read all frontend modules
const darkMode = removeImportsExports(readModule(FRONTEND_DIST_DIR, 'darkMode.js'));
const citationCore = removeImportsExports(readModule(FRONTEND_DIST_DIR, 'citationCore.js'));
const software = removeImportsExports(readModule(FRONTEND_DIST_DIR, 'software.js'));

// Read shared modules
const dependencyResolver = removeImportsExports(readModule(SHARED_DIST_DIR, 'dependencyResolver.js'));
const fileParser = removeImportsExports(readModule(SHARED_DIST_DIR, 'fileParser.js'));

// Create bundled output
const bundle = `/**
 * Software Citation Station - Frontend Bundle
 * Generated automatically by bundle-frontend.js
 * Build time: ${new Date().toISOString()}
 */

(function() {
  'use strict';

  // Shared modules
  ${dependencyResolver}
  ${fileParser}

  // Dark mode module
  ${darkMode}

  // Citation core module
  ${citationCore}

  // Software UI module
  ${software}

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
