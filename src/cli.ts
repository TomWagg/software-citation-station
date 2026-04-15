#!/usr/bin/env node

import { CitationEngine } from "./citationEngine";
import { RemoteDataProvider, DEFAULT_BASE_URL } from "./remoteData";

type OutputFormat = "text" | "bibtex" | "json";
type Command = "list" | "show" | "cite";

interface ParsedFlags {
  baseUrl: string;
  format: OutputFormat;
  latest: boolean;
  versions: Record<string, string>;
  positional: string[];
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
    positional: []
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
      return [
        `Package: ${data.package}`,
        `Language: ${data.citation.language}`,
        `Category: ${data.citation.category}`,
        `DOI: ${data.citation.zenodo_doi || "(none)"}`,
        `Tags: ${data.citation.tags.join(", ") || "(none)"}`,
        `Versions: ${data.versions.length}`
      ].join("\n");
    });
    return;
  }

  if (command === "cite") {
    if (flags.positional.length === 0) {
      throw new Error("cite requires at least one package name.");
    }
    const output = await engine.cite(flags.positional, {
      latest: flags.latest,
      versions: flags.versions
    });

    if (flags.format === "json") {
      console.log(JSON.stringify(output, null, 2));
      return;
    }
    if (flags.format === "bibtex") {
      console.log(output.bibtex);
      return;
    }

    console.log(`${output.acknowledgement}\n\n${output.bibtex}`);
    return;
  }

  throw new Error(`Unknown command "${command}".`);
}

main().catch((error) => {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
