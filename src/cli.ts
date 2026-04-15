#!/usr/bin/env node

import { CitationEngine } from "./citationEngine";
import { CitationOutput } from "./citationTypes";
import { RemoteDataProvider, DEFAULT_BASE_URL } from "./remoteData";

type OutputFormat = "text" | "bibtex" | "json";
type Command = "list" | "show" | "cite" | "deps";

interface ParsedFlags {
  baseUrl: string;
  format: OutputFormat;
  latest: boolean;
  versions: Record<string, string>;
  positional: string[];
  deps: boolean;
}

function printUsage(): void {
  console.log(`Software Citation Station CLI

Usage:
  scs list [--format text|json] [--base-url URL]
  scs show <package> [--format text|json] [--base-url URL]
  scs cite <package...> [--latest] [--version package=version ...] [--format text|bibtex|json] [--base-url URL]
`);
}

function parseFlags(args: string[]): ParsedFlags {
  const parsed: ParsedFlags = {
    baseUrl: DEFAULT_BASE_URL,
    format: "text",
    latest: true,
    versions: {},
    positional: [],
    deps: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--base-url") {
      parsed.baseUrl = args[++i] ?? parsed.baseUrl;
      continue;
    }
    if (arg === "--format") {
      parsed.format = (args[++i] as OutputFormat) ?? parsed.format;
      continue;
    }
    if (arg === "--latest") {
      parsed.latest = true;
      continue;
    }
    if (arg === "--no-latest") {
      parsed.latest = false;
      continue;
    }
    if (arg === "--version") {
      const value = args[++i];
      if (!value || !value.includes("=")) {
        throw new Error(`Invalid --version value "${value ?? ""}". Expected package=version.`);
      }
      const [pkg, version] = value.split("=", 2);
      if (!pkg || !version) {
        throw new Error(`Invalid --version value "${value}". Expected package=version.`);
      }
      parsed.versions[pkg] = version;
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
  const engine = new CitationEngine(new RemoteDataProvider(flags.baseUrl));

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
    const versions = record.zenodo_doi ? await new RemoteDataProvider(flags.baseUrl).getVersions(packageName) : [];
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
      latest: flags.latest,
      versions: { ...flags.versions, ...pinnedVersions },
      depsOnly: flags.deps
    });

    if (flags.deps) {
      const deps = output as string[];
      if (flags.format === "json") {
        console.log(JSON.stringify({ packages: packageNames, dependencies: deps }, null, 2));
      } else {
        console.log(deps.join("\\n"));
      }
      return;
    }

    const citationOutput = output as CitationOutput;
    if (flags.format === "json") {
      console.log(JSON.stringify(citationOutput, null, 2));
      return;
    }
    if (flags.format === "bibtex") {
      console.log(citationOutput.bibtex);
      return;
    }

    console.log(`${citationOutput.acknowledgement}\\n\\n${citationOutput.bibtex}`);
    return;
  }

  throw new Error(`Unknown command "${command}".`);
}

main().catch((error) => {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
