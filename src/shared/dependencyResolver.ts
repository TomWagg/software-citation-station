/**
 * Dependency resolver for auto-expanding package dependencies
 * Used by both CLI and frontend
 */

import { CitationPackage } from '../citationTypes';

export interface DependencyOptions {
  /** Auto-expand dependencies (default: true) */
  autoExpand?: boolean;
  /** Maximum depth for dependency resolution (default: unlimited) */
  maxDepth?: number;
}

/**
 * Expand a list of packages with their dependencies
 * @param packages - Initial list of package names
 * @param citations - Citation database
 * @param options - Dependency resolution options
 * @returns Expanded list of packages including dependencies
 */
export function expandDependencies(
  packages: string[],
  citations: Record<string, CitationPackage>,
  options: DependencyOptions = {}
): string[] {
  const { autoExpand = true, maxDepth } = options;

  if (!autoExpand) {
    return packages;
  }

  const allPackages = new Set<string>();
  const toProcess: { pkg: string; depth: number }[] = packages.map(p => ({ pkg: p, depth: 0 }));

  while (toProcess.length > 0) {
    const { pkg: current, depth } = toProcess.shift()!;

    // Skip if already processed
    if (allPackages.has(current)) {
      continue;
    }

    // Skip if we've reached max depth
    if (maxDepth !== undefined && depth >= maxDepth) {
      continue;
    }

    allPackages.add(current);

    // Get dependencies for this package
    const citation = citations[current];
    if (citation?.dependencies) {
      for (const dep of citation.dependencies) {
        if (!allPackages.has(dep) && citations[dep]) {
          toProcess.push({ pkg: dep, depth: depth + 1 });
        }
      }
    }
  }

  return Array.from(allPackages);
}

/**
 * Get direct dependencies for a package
 * @param packageName - Package name
 * @param citations - Citation database
 * @returns List of direct dependencies (empty if none)
 */
export function getDirectDependencies(
  packageName: string,
  citations: Record<string, CitationPackage>
): string[] {
  const citation = citations[packageName];
  return citation?.dependencies || [];
}

/**
 * Get all transitive dependencies for a package
 * @param packageName - Package name
 * @param citations - Citation database
 * @returns List of all dependencies (transitive)
 */
export function getAllDependencies(
  packageName: string,
  citations: Record<string, CitationPackage>
): string[] {
  return expandDependencies([packageName], citations, { autoExpand: true });
}

/**
 * Check if a package is a dependency of another package
 * @param packageName - Main package name
 * @param potentialDep - Potential dependency name
 * @param citations - Citation database
 * @returns True if potentialDep is a dependency of packageName
 */
export function isDependency(
  packageName: string,
  potentialDep: string,
  citations: Record<string, CitationPackage>
): boolean {
  const allDeps = getAllDependencies(packageName, citations);
  return allDeps.includes(potentialDep);
}

/**
 * Get dependency tree for visualization
 * @param packageName - Package name
 * @param citations - Citation database
 * @returns Nested dependency structure
 */
export function getDependencyTree(
  packageName: string,
  citations: Record<string, CitationPackage>
): DependencyTreeNode {
  const visited = new Set<string>();

  function buildTree(pkg: string): DependencyTreeNode {
    if (visited.has(pkg)) {
      return { name: pkg, dependencies: [], circular: true };
    }

    visited.add(pkg);
    const deps = getDirectDependencies(pkg, citations);
    const children = deps.map(dep => buildTree(dep));

    return {
      name: pkg,
      dependencies: children
    };
  }

  return buildTree(packageName);
}

export interface DependencyTreeNode {
  name: string;
  dependencies: DependencyTreeNode[];
  circular?: boolean;
}
