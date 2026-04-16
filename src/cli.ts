#!/usr/bin/env node

/* istanbul ignore file */
/**
 * CLI entry point - integration code tested via E2E tests
 */

import { readFileSync } from "fs";
import { CitationEngine } from "./citationEngine";
import { CitationOutput, ZenodoVersion } from "./citationTypes";
import { RemoteDataProvider, DEFAULT_BASE_URL } from "./remoteData";
import { parseEnvironmentFile, expandDependencies } from "./shared";

type OutputFormat = "text" | "json";
type Command = "list" | "show" | "cite" | "parse" | "submit";

interface ParsedFlags {
  format: OutputFormat;
  acknowledgement: boolean;
  bibtex: boolean;
  positional: string[];
  deps: boolean;
  autoDeps: boolean;
  file?: string;
  // submit command options
  description?: string;
  link?: string;
  attributionLink?: string;
  zenodoDoi?: string;
  language?: string;
  category?: string;
  tags?: string;
}

export function printUsage(): void {
  console.log(`Software Citation Station CLI

Generate citations and acknowledgements for software packages with proper DOI references.

USAGE
  scs <command> [options]
  scs <command> --help    Show help for specific command

COMMANDS
  list                      List all available packages
  show <package>            Show details about a specific package
  cite <package...>         Generate citations for packages
  parse <file>              Parse requirements.txt or conda env file
  submit <package>          Generate submission template for new package

GLOBAL OPTIONS
  --json                    Output in JSON format
  --help, -h                Show this help message

Run 'scs <command> --help' for command-specific options and examples.

MORE INFORMATION
  Full documentation at: https://www.tomwagg.com/software-citation-station/
  `);
}

export function printListHelp(): void {
  console.log(`scs list - List all available packages

USAGE
  scs list [options]

OPTIONS
  --json                    Output in JSON format
  --help, -h                Show this help message

EXAMPLES
  scs list
  scs list --json
`);
}

export function printShowHelp(): void {
  console.log(`scs show - Show details about a specific package

USAGE
  scs show <package> [options]

ARGUMENTS
  package                   Name of the package to show

OPTIONS
  --json                    Output in JSON format
  --help, -h                Show this help message

EXAMPLES
  scs show scipy
  scs show numpy --json
`);
}

export function printCiteHelp(): void {
  console.log(`scs cite - Generate citations for software packages

USAGE
  scs cite <package...> [options]
  scs cite --file <file> [options]

ARGUMENTS
  package                   Package names (can include versions: scipy==1.10.0)

OPTIONS
  --acknowledgement, --ack  Output only acknowledgement text
  --bibtex                  Output only BibTeX citation
  --deps                    Output only dependencies
  --no-auto-deps            Disable automatic dependency expansion
  --json                    Output in JSON format
  --file, -f                Parse packages from file
  --help, -h                Show this help message

EXAMPLES
  Cite packages (latest versions):
    scs cite scipy numpy
    scs cite scipy --ack
    scs cite scipy --bibtex
    scs cite scipy --json

  Cite specific versions:
    scs cite scipy==1.10.0 numpy==1.24.0
    scs cite scipy==1.10.0 --bibtex

  Cite from file:
    scs cite --file requirements.txt
    scs cite -f environment.yaml --deps

  Show dependencies only:
    scs cite scipy --deps
    scs cite scipy numpy --deps --json
`);
}

export function printParseHelp(): void {
  console.log(`scs parse - Parse requirements file and show packages

USAGE
  scs parse <file> [options]

ARGUMENTS
  file                      Requirements.txt or conda environment file

OPTIONS
  --json                    Output in JSON format
  --auto-deps               Expand with dependencies (default: enabled)
  --no-auto-deps            Disable automatic dependency expansion
  --help, -h                Show this help message

EXAMPLES
  scs parse requirements.txt
  scs parse environment.yaml --json
  scs parse requirements.txt --no-auto-deps
`);
}

export function printSubmitHelp(): void {
  console.log(`scs submit - Generate submission template for a new package

USAGE
  scs submit <package-name> [options]

ARGUMENTS
  package-name              Name of the package to submit

OPTIONS
  --description             Package description (required)
  --link                    Project homepage URL (required)
  --attribution-link        URL with citation instructions (required)
  --zenodo-doi              Zenodo concept DOI for all versions
  --language                Programming language (default: python)
  --category                Category (default: general)
  --tags                    Comma-separated citation tags
  --json                    Output JSON only (default: shows formatted template)
  --help, -h                Show this help message

REQUIRED FIELDS
  --link, --description, and --attribution-link must be provided.
  Without these, a template with placeholders will be shown.

EXAMPLES
  Generate interactive template:
    scs submit mypackage

  Generate JSON template:
    scs submit mypackage --json

  Submit with all required fields:
    scs submit mypackage \\
      --link "https://github.com/user/mypackage" \\
      --description "My awesome package" \\
      --attribution-link "https://github.com/user/mypackage#citation"

  Submit with all options:
    scs submit mypackage \\
      --link "https://github.com/user/mypackage" \\
      --description "My awesome package" \\
      --attribution-link "https://github.com/user/mypackage#citation" \\
      --zenodo-doi "10.5281/zenodo.123456" \\
      --language python \\
      --category data \\
      --tags "mypackage,2024paper"

OUTPUT
  The command generates a JSON template for adding to data/citations.json.
  Submit by creating a PR to:
  https://github.com/tomwagg/software-citation-station
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
    if (arg === "--description") {
      parsed.description = args[++i];
      continue;
    }
    if (arg === "--link") {
      parsed.link = args[++i];
      continue;
    }
    if (arg === "--attribution-link") {
      parsed.attributionLink = args[++i];
      continue;
    }
    if (arg === "--zenodo-doi") {
      parsed.zenodoDoi = args[++i];
      continue;
    }
    if (arg === "--language") {
      parsed.language = args[++i];
      continue;
    }
    if (arg === "--category") {
      parsed.category = args[++i];
      continue;
    }
    if (arg === "--tags") {
      parsed.tags = args[++i];
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
  
  // Check for command-specific help
  if (argv.includes("--help") || argv.includes("-h")) {
    switch (command) {
      case "list":
        printListHelp();
        break;
      case "show":
        printShowHelp();
        break;
      case "cite":
        printCiteHelp();
        break;
      case "parse":
        printParseHelp();
        break;
      case "submit":
        printSubmitHelp();
        break;
      default:
        printUsage();
    }
    process.exit(0);
  }

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

    // Resolve packages to latest versions from cached data on server
    const baseUrl = process.env.SCS_BASE_URL ?? DEFAULT_BASE_URL;
    const packagesWithVersions = await Promise.all(expandedPackages.map(async (pkg) => {
      const citation = citations[pkg];
      if (citation?.zenodo_doi) {
        try {
          // Fetch cached version data from server (fast!)
          const url = `${baseUrl}/data/zenodo-versions/${encodeURIComponent(pkg)}.json`;
          const response = await fetch(url);
          if (response.ok) {
            const versions = await response.json() as ZenodoVersion[];
            const latestVersion = versions.length > 0 ? versions[0].version : 'unknown';
            return `${pkg}==${latestVersion}`;
          }
        } catch {
          // Fall through to show package name only
        }
        return pkg;
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

  if (command === "submit") {
    const packageName = flags.positional[0];
    if (!packageName) {
      throw new Error("submit requires a package name: scs submit <package-name>");
    }

    // Check if package already exists
    const citations = await dataProvider.getCitations();
    if (citations[packageName]) {
      throw new Error(`Package "${packageName}" already exists in the database.`);
    }

    // Validate required fields
    const requiredFields = {
      name: packageName,
      link: flags.link,
      description: flags.description,
      attributionLink: flags.attributionLink,
      language: flags.language || "python",
      category: flags.category || "general"
    };

    const missingRequired = [];
    if (!requiredFields.link) missingRequired.push("--link");
    if (!requiredFields.description) missingRequired.push("--description");
    if (!requiredFields.attributionLink) missingRequired.push("--attribution-link");

    if (missingRequired.length > 0 && flags.format !== "json") {
      console.log(`
=== Submission Template for "${packageName}" ===

Missing required fields: ${missingRequired.join(", ")}

Required fields for submission:
  --link              Documentation/project URL
  --description       Short description (max 200 chars)
  --attribution-link  URL with citation instructions

Optional fields:
  --zenodo-doi        Zenodo concept DOI (all versions)
  --language          Programming language (default: python)
  --category          Category (default: general)
  --tags              Comma-separated BibTeX citation tags

Generate complete template with:
  scs submit ${packageName} --link "https://..." --description "..." --attribution-link "https://..."

Or generate JSON template to fill in manually:
  scs submit ${packageName} --json
`);
      return;
    }

    // Build template with provided parameters
    const template = {
      name: packageName,
      language: requiredFields.language,
      category: requiredFields.category,
      description: requiredFields.description || "TODO: Add description",
      link: requiredFields.link || "TODO: Add project URL",
      attribution_link: requiredFields.attributionLink || "TODO: Add attribution/citation URL",
      zenodo_doi: flags.zenodoDoi || "",
      tags: flags.tags ? flags.tags.split(',').map(t => t.trim()) : [],
      logo: "",
      logo_background: false,
      keywords: [],
      custom_citation: "",
      extra_bibtex: ""
    };

    if (flags.format === "json") {
      console.log(JSON.stringify({ [packageName]: template }, null, 2));
    } else {
      console.log(`
=== Submission Template for "${packageName}" ===

Copy this JSON template and add to data/citations.json:

{
  "${packageName}": ${JSON.stringify(template, null, 4).replace(/\n/g, '\n  ')}
}

Then add BibTeX entries to data/bibtex.bib with keys matching the tags.

Submit by creating a PR to:
  https://github.com/tomwagg/software-citation-station

Example usage:
  scs submit mypackage \\
    --link "https://github.com/user/mypackage" \\
    --description "My awesome package for doing things" \\
    --attribution-link "https://github.com/user/mypackage#citation" \\
    --zenodo-doi "10.5281/zenodo.123456" \\
    --language python \\
    --category data \\
    --tags "mypackage,2024paper"
`);
    }
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
