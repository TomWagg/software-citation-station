#!/usr/bin/env node

import { CitationEngine } from "./citationEngine";
import { CitationOutput } from "./citationTypes";
import { RemoteDataProvider, DEFAULT_BASE_URL } from "./remoteData";

// Output format is now controlled by --json flag (default text)
type OutputFormat = "text" | "json"; // format controlled by --json flag
type Command = "list" | "show" | "cite" | "deps";

interface ParsedFlags {
  format: OutputFormat;
  acknowledgement: boolean;
  bibtex: boolean;
  positional: string[];
  deps: boolean;
}

function printUsage(): void {
  console.log(`Software Citation Station CLI

Usage:
  scs list [--json]
  scs show <package> [--json]
  scs cite <package...> [package==version ...] [--acknowledgement] [--bibtex]
  scs cite <package...> [package==version ...] --deps [--json]

Examples:
  scs cite scipy numpy
  scs cite scipy==1.10.0 numpy
  scs cite scipy numpy --acknowledgement
  scs cite scipy numpy --bibtex

  Flags:
  --acknowledgement           Output only acknowledgement text
  --bibtex                    Output only bibtex
  --deps                      Show dependencies without generating citations
  --json                      Output format as JSON (default: plain text)

Environment variables:
  SCS_BASE_URL                Custom base URL for data (default: https://data.softwarecitationstation.org)
  `);
}

function parseFlags(args: string[]): ParsedFlags {
  const parsed: ParsedFlags = {
    format: "text",
    acknowledgement: false,
    bibtex: false,
    positional: [],
    deps: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--json") {
      parsed.format = "json";
      continue;
    }
    // other flags handled below

    if (arg === "--acknowledgement") {
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
    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    }
    parsed.positional.push(arg);
  }

  return parsed;
}

function printByFormat(format: OutputFormat, value: unknown, textSelector?: (x: unknown) => string): void {
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

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.length === 0) {
    printUsage();
    process.exit(2);
  }

  const command = argv[0] as Command;
  const flags = parseFlags(argv.slice(1));
  const baseUrl = process.env.SCS_BASE_URL ?? DEFAULT_BASE_URL;
  const engine = new CitationEngine(new RemoteDataProvider(baseUrl));

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
    const versions = record.zenodo_doi ? await new RemoteDataProvider(baseUrl).getVersions(packageName) : [];
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

  if (command === "cite") {
    if (flags.positional.length === 0) {
      throw new Error("cite requires at least one package name.");
    }
    const pinnedVersions: Record<string, string> = {};
    const packageNames: string[] = [];
    for (const token of flags.positional) {
      const pinned = splitPinnedPackage(token);
      if (pinned) {
        pinnedVersions[pinned.packageName] = pinned.version;
        packageNames.push(pinned.packageName);
      } else {
        packageNames.push(token);
      }
    }

    const output = await engine.cite(packageNames, {
      versions: pinnedVersions,
      depsOnly: flags.deps
    });

    if (flags.deps) {
      if (Array.isArray(output)) {
        const deps = output;
        if (flags.format === "json") {
          console.log(JSON.stringify({ packages: packageNames, dependencies: deps }, null, 2));
        } else {
          console.log(deps.join("\n"));
        }
      }
      return;
    }

    const citationOutput = output as CitationOutput;
    if (flags.format === "json") {
      console.log(JSON.stringify(citationOutput, null, 2));
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

    console.log(`${citationOutput.acknowledgement}\n\n${citationOutput.bibtex}`);
    return;
  }

  throw new Error(`Unknown command "${command}".`);
}

main().catch((error) => {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
