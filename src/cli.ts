#!/usr/bin/env node

/* istanbul ignore file */
/**
 * CLI entry point - integration code tested via E2E tests
 */

import { readFileSync } from "fs";
import { CitationEngine } from "./citationEngine";
import { CitationOutput } from "./citationTypes";
import { RemoteDataProvider, DEFAULT_BASE_URL } from "./remoteData";
import { parseEnvironmentFile, expandDependencies } from "./shared";
import { getZenodoVersionInfo } from "./zenodoVersions";

type OutputFormat = "text" | "json";
type Command = "list" | "show" | "cite" | "parse";

interface ParsedFlags {
  format: OutputFormat;
  acknowledgement: boolean;
  bibtex: boolean;
  positional: string[];
  deps: boolean;
  autoDeps: boolean;
  file?: string;
}

export function printUsage(): void {
  console.log(`Software Citation Station CLI

Generate citations and acknowledgements for software packages with proper DOI references.

USAGE
  scs <command> [options] [arguments]

COMMANDS
  list                        List all available packages
  show <package>              Show details about a specific package
  cite <package...>           Generate citations for one or more packages
  parse <file>                Parse requirements.txt or conda env file

OPTIONS
  --acknowledgement, --ack    Output only acknowledgement text
  --bibtex                    Output only BibTeX citation
  --deps                      Output only dependencies
  --no-auto-deps              Disable automatic dependency expansion
  --json                      Output in JSON format (default: plain text)
  --file, -f                  Parse packages from file (requirements.txt or conda env.yaml)
  --help, -h                  Show this help message

  By default, 'scs cite' shows package list (with inferred dependencies),
  acknowledgement, and BibTeX citation. Use these flags to output only one
  specific format.

EXAMPLES
  List all available packages:
    scs list
    scs list --json

  Show package list with dependencies:
    scs cite scipy --deps
    scs cite scipy numpy --deps --json

  Show package details:
    scs show scipy
    scs show numpy --json

  Generate citations (latest versions):
    scs cite scipy numpy
    scs cite scipy --ack
    scs cite scipy --bibtex
    scs cite scipy --json

  Generate citations (specific versions):
    scs cite scipy==1.10.0 numpy==1.24.0
    scs cite scipy==1.10.0 --bibtex

  Parse requirements file and cite:
    scs parse requirements.txt
    scs parse environment.yaml --json
    scs cite --file requirements.txt
    scs cite -f environment.yaml --deps

  Disable auto-dependency expansion:
    scs cite scipy --no-auto-deps

ENVIRONMENT VARIABLES
  SCS_BASE_URL    Custom base URL for data
                  (default: ${DEFAULT_BASE_URL})

MORE INFORMATION
  Full documentation at: https://www.tomwagg.com/software-citation-station/
  `);
}

export function parseFlags(args: string[]): ParsedFlags {
  const parsed: ParsedFlags = {
    format: "text",
    acknowledgement: false,
    bibtex: false,
    positional: [],
    deps: false,
    autoDeps: true
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--json") {
      parsed.format = "json";
      continue;
    }
    if (arg === "--acknowledgement" || arg === "--ack") {
      parsed.acknowledgement = true;
      parsed.bibtex = false;
      continue;
    }
    if (arg === "--bibtex") {
      parsed.bibtex = true;
      parsed.acknowledgement = false;
      continue;
    }
    if (arg === "--deps") {
      parsed.deps = true;
      continue;
    }
    if (arg === "--no-auto-deps") {
      parsed.autoDeps = false;
      continue;
    }
    if (arg === "--file" || arg === "-f") {
      parsed.file = args[++i];
      continue;
    }
    parsed.positional.push(arg);
  }

  return parsed;
}

export function printByFormat(format: OutputFormat, value: unknown, textSelector?: (x: unknown) => string): void {
  if (format === "json") {
    console.log(JSON.stringify(value, null, 2));
    return;
  }
  if (textSelector) {
    console.log(textSelector(value));
    return;
  }
  console.log(String(value));
}

function splitPinnedPackage(value: string): { packageName: string; version: string } | null {
  const idx = value.indexOf("==");
  if (idx === -1) {
    return null;
  }
  const packageName = value.slice(0, idx).trim();
  const version = value.slice(idx + 2).trim();
  if (!packageName || !version) {
    throw new Error(`Invalid pinned package "${value}". Expected package==version.`);
  }
  return { packageName, version };
}

export { splitPinnedPackage };

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h") {
    printUsage();
    process.exit(argv.length === 0 ? 1 : 0);
  }

  const command = argv[0] as Command;
  const flags = parseFlags(argv.slice(1));
  const baseUrl = process.env.SCS_BASE_URL ?? DEFAULT_BASE_URL;
  const dataProvider = new RemoteDataProvider(baseUrl);
  const engine = new CitationEngine(dataProvider);

  if (command === "list") {
    const packages = await engine.listPackages();
    if (flags.format === "json") {
      console.log(JSON.stringify({ packages }, null, 2));
    } else {
      console.log(packages.join("\n"));
    }
    return;
  }

  if (command === "show") {
    const packageName = flags.positional[0];
    if (!packageName) {
      throw new Error("show requires a package name.");
    }

    const record = await engine.getPackage(packageName);
    const versions = record.zenodo_doi ? await dataProvider.getVersions(packageName) : [];
    const payload = {
      package: packageName,
      citation: record,
      versions
    };

    printByFormat(flags.format, payload, (v) => {
      const data = v as typeof payload;
      const latestVersions = data.versions.slice(0, 5).map((entry) => entry.version);
      return [
        `Package: ${data.package}`,
        `Language: ${data.citation.language}`,
        `Category: ${data.citation.category}`,
        `DOI: ${data.citation.zenodo_doi || "(none)"}`,
        `Tags: ${data.citation.tags.join(", ") || "(none)"}`,
        `Latest versions: ${latestVersions.length > 0 ? latestVersions.join(", ") : "(none)"}`,
        `Versions: ${data.versions.length}`
      ].join("\n");
    });
    return;
  }

  if (command === "parse") {
    const filename = flags.positional[0] || flags.file;
    if (!filename) {
      throw new Error("parse requires a filename.");
    }

    let content: string;
    try {
      content = readFileSync(filename, "utf-8");
    } catch (error) {
      const err = new Error(`Failed to read file "${filename}": ${error instanceof Error ? error.message : String(error)}`);
      (err as any).cause = error;
      throw err;
    }

    const parsed = parseEnvironmentFile(content, filename);
    const citations = await dataProvider.getCitations();

    // Expand dependencies if auto-deps is enabled
    let expandedPackages = parsed.packages;
    if (flags.autoDeps) {
      expandedPackages = expandDependencies(parsed.packages, citations, { autoExpand: true });
    }

    // Resolve packages to latest versions
    const packagesWithVersions = await Promise.all(expandedPackages.map(async (pkg) => {
      const citation = citations[pkg];
      if (citation?.zenodo_doi) {
        try {
          // Fetch latest version from cached data or Zenodo
          const versions = await getZenodoVersionInfo(citation.zenodo_doi);
          const latestVersion = versions.length > 0 ? versions[0].version : 'unknown';
          return `${pkg}==${latestVersion}`;
        } catch {
          return `${pkg} (latest: unknown)`;
        }
      } else if (citation) {
        // No Zenodo - just show package name
        return pkg;
      } else {
        // Unknown package
        return `${pkg} (unknown)`;
      }
    }));

    if (flags.format === "json") {
      console.log(JSON.stringify({
        source: parsed.source,
        pythonVersion: parsed.pythonVersion,
        packages: parsed.packages,
        expandedPackages: flags.autoDeps ? expandedPackages : undefined,
        packagesWithVersions: packagesWithVersions
      }, null, 2));
    } else {
      console.log(`Source: ${parsed.source}`);
      if (parsed.pythonVersion) {
        console.log(`Python version: ${parsed.pythonVersion}`);
      }
      console.log(`\nPackages (${packagesWithVersions.length}):`);
      console.log(packagesWithVersions.sort().join("\n"));
    }
    return;
  }

  if (command === "cite") {
    let packageNames: string[] = [];
    const pinnedVersions: Record<string, string> = {};
    const warnings: string[] = [];

    // Handle file input
    if (flags.file) {
      let content: string;
      try {
        content = readFileSync(flags.file, "utf-8");
      } catch (error) {
        const err = new Error(`Failed to read file "${flags.file}": ${error instanceof Error ? error.message : String(error)}`);
        (err as any).cause = error;
        throw err;
      }
      const parsed = parseEnvironmentFile(content, flags.file);
      packageNames = parsed.packages;
    }

    // Handle positional arguments
    if (flags.positional.length > 0) {
      for (const token of flags.positional) {
        const pinned = splitPinnedPackage(token);
        if (pinned) {
          pinnedVersions[pinned.packageName] = pinned.version;
          packageNames.push(pinned.packageName);
        } else {
          packageNames.push(token);
        }
      }
    }

    if (packageNames.length === 0) {
      throw new Error("cite requires at least one package name or a file.");
    }

    // Get citations for dependency expansion and validate packages
    const citations = await dataProvider.getCitations();
    
    // Check for unknown packages and warn
    const validPackages: string[] = [];
    for (const pkg of packageNames) {
      if (citations[pkg]) {
        validPackages.push(pkg);
      } else {
        warnings.push(`Unknown package "${pkg}" - skipping`);
      }
    }
    
    // Print warnings for unknown packages
    if (warnings.length > 0) {
      if (flags.format === "json") {
        // Warnings will be included in JSON output
      } else {
        for (const warning of warnings) {
          console.error(`Warning: ${warning}`);
        }
      }
    }
    
    // Use only valid packages
    packageNames = validPackages;
    
    if (packageNames.length === 0) {
      throw new Error("No valid packages found.");
    }

    // Expand dependencies if auto-deps is enabled
    if (flags.autoDeps) {
      packageNames = expandDependencies(packageNames, citations, { autoExpand: true });
    }

    const output = await engine.cite(packageNames, {
      versions: pinnedVersions,
      depsOnly: flags.deps
    });

    if (flags.deps) {
      if (Array.isArray(output)) {
        const deps = output;
        const depsWithVersions = deps.map(dep => {
          const version = pinnedVersions[dep];
          return version ? `${dep}==${version}` : dep;
        });
        if (flags.format === "json") {
          const result: Record<string, any> = { packages: packageNames, dependencies: depsWithVersions };
          if (warnings.length > 0) result.errors = warnings;
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(`Packages (${packageNames.length}): ${packageNames.sort().join(", ")}`);
          console.log(depsWithVersions.sort().join("\n"));
        }
      }
      return;
    }

    const citationOutput = output as CitationOutput;
    if (flags.format === "json") {
      const result: Record<string, any> = citationOutput;
      if (warnings.length > 0) result.errors = warnings;
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    if (flags.bibtex) {
      console.log(citationOutput.bibtex);
      return;
    }
    if (flags.acknowledgement) {
      console.log(citationOutput.acknowledgement);
      return;
    }

    const citedPackages = citationOutput.packages.map(p => p.name).sort();
    console.log(`Packages (${citedPackages.length}): ${citedPackages.join(", ")}`);
    console.log(`\n${citationOutput.acknowledgement}\n\n${citationOutput.bibtex}`);
    return;
  }

  throw new Error(`Unknown command "${command}".`);
}

// Only run main if this is the entry point (not being imported for testing)
if (require.main === module) {
  main().catch((error) => {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
