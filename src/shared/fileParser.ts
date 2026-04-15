/**
 * File parser for requirements.txt and conda environment files
 * Used by both CLI and frontend for parsing package lists
 */

export interface ParsedEnvironment {
  packages: string[];
  source: 'requirements' | 'conda' | 'unknown';
  pythonVersion?: string;
}

/**
 * Parse a requirements.txt file (pip freeze output)
 * Handles formats like:
 * - package==1.0.0
 * - package>=1.0.0
 * - package~=1.0.0
 * - package (no version)
 */
export function parseRequirementsTxt(content: string): ParsedEnvironment {
  const packages: string[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    // Skip -r includes (other requirements files)
    if (trimmed.startsWith('-r ') || trimmed.startsWith('--requirement')) {
      continue;
    }

    // Skip other pip options
    if (trimmed.startsWith('-')) {
      continue;
    }

    // Extract package name (before any version specifier)
    // Handles ==, >=, <=, !=, ~=, >, <, @, [extras]
    const match = trimmed.match(/^([a-zA-Z0-9_-]+(?:\[[a-zA-Z0-9_,-]+\])?)/);
    if (match) {
      // Remove extras like [dev,test] from package name
      const packageName = match[1].split('[')[0].toLowerCase();
      packages.push(packageName);
    }
  }

  return {
    packages,
    source: 'requirements'
  };
}

/**
 * Parse a conda environment export YAML file
 * Handles both simple list and pip nested sections
 */
export function parseCondaEnvYaml(content: string): ParsedEnvironment {
  const packages: string[] = [];
  let pythonVersion: string | undefined;
  let inPipSection = false;
  let inDependenciesSection = false;

  const lines = content.split('\n');

  for (const line of lines) {
    // Check for section headers
    if (line.startsWith('dependencies:')) {
      inDependenciesSection = true;
      inPipSection = false;
      continue;
    }

    if (inDependenciesSection) {
      // Check for pip subsection
      const pipMatch = line.match(/^\s+- pip:\s*$/);
      if (pipMatch) {
        inPipSection = true;
        continue;
      }

      // Check if we're leaving the dependencies section
      if (line.match(/^\w/)) {
        inDependenciesSection = false;
        inPipSection = false;
        continue;
      }

      // Parse package entries (start with -)
      const pkgMatch = line.match(/^\s+-\s*(.+)$/);
      if (pkgMatch) {
        const pkgSpec = pkgMatch[1].trim();
        
        // Skip pip itself
        if (pkgSpec === 'pip') {
          continue;
        }

        // Extract package name from conda spec
        // Handles: package, package=1.0.0, package==1.0.0, package>=1.0.0
        const nameMatch = pkgSpec.match(/^([a-zA-Z0-9_-]+)(?:[=<>!~]+.*)?$/);
        if (nameMatch) {
          const packageName = nameMatch[1].toLowerCase();
          
          // Track Python version separately
          if (packageName === 'python') {
            const versionMatch = pkgSpec.match(/=(\d+\.\d+(?:\.\d+)?)/);
            if (versionMatch) {
              pythonVersion = versionMatch[1];
            }
          }
          
          packages.push(packageName);
        }
      }
    }
  }

  return {
    packages,
    source: 'conda',
    pythonVersion
  };
}

/**
 * Auto-detect file type and parse
 */
export function parseEnvironmentFile(content: string, filename?: string): ParsedEnvironment {
  // Try to detect based on filename
  if (filename) {
    const lowerFilename = filename.toLowerCase();
    if (lowerFilename.endsWith('.yaml') || lowerFilename.endsWith('.yml')) {
      return parseCondaEnvYaml(content);
    }
    if (lowerFilename.endsWith('.txt') || lowerFilename.includes('requirements')) {
      return parseRequirementsTxt(content);
    }
  }

  // Auto-detect based on content
  if (content.includes('dependencies:') || content.includes('name:')) {
    return parseCondaEnvYaml(content);
  }

  // Default to requirements.txt format
  return parseRequirementsTxt(content);
}

/**
 * Parse package specification with version
 * Returns package name and version separately
 */
export function parsePackageSpec(spec: string): { name: string; version?: string } {
  const trimmed = spec.trim();
  
  // Handle various version specifiers: ==, >=, <=, !=, ~=, >, <, =
  const match = trimmed.match(/^([a-zA-Z0-9_-]+)(?:\[.*?\])?(?:==|>=|<=|!=|~=|>|<|=)?(.*)$/);
  if (match) {
    const name = match[1].toLowerCase();
    const version = match[2] || undefined;
    return { name, version };
  }

  return { name: trimmed.toLowerCase() };
}
