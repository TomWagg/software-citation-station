import { replaceBibtexTag } from "./bibtex";
import { CitationOutput, CitationPackage, DataProvider, ZenodoVersion } from "./citationTypes";

export interface CiteOptions {
  latest?: boolean;
  versions?: Record<string, string>;
  depsOnly?: boolean;
}

function resolveRequestedVersion(available: ZenodoVersion[], requested: string): ZenodoVersion | undefined {
  const exact = available.find(v => v.version === requested);
  if (exact) {
    return exact;
  }

  const stripped = requested.startsWith("v") ? requested.slice(1) : requested;
  return available.find(v => {
    const candidate = v.version.startsWith("v") ? v.version.slice(1) : v.version;
    return candidate === stripped;
  });
}

async function expandWithDependencies(
  provider: DataProvider,
  packages: string[]
): Promise<string[]> {
  const citations = await provider.getCitations();
  const allPackages = new Set<string>();
  const toProcess = [...packages];

  while (toProcess.length > 0) {
    const current = toProcess.shift()!;
    if (allPackages.has(current)) {
      continue;
    }
    allPackages.add(current);

    const citation = citations[current];
    if (citation?.dependencies) {
      for (const dep of citation.dependencies) {
        if (!allPackages.has(dep) && citations[dep]) {
          toProcess.push(dep);
        }
      }
    }
  }

  return Array.from(allPackages);
}

function appendTagToCitep(text: string, tag: string): string {
  if (text.includes("\\citep") && text.endsWith("}")) {
    let openBraces = 0;
    for (let i = text.indexOf("\\citep") + 6; i < text.length; i++) {
      if (text[i] === "{") {
        openBraces += 1;
      } else if (text[i] === "}") {
        openBraces -= 1;
      }
      if (openBraces === 0) {
        return `${text.slice(0, i)},${tag}${text.slice(i)}`;
      }
    }
  }
  return text;
}

function joinAcknowledgements(parts: string[]): string {
  if (parts.length === 0) {
    return "";
  }
  if (parts.length === 1) {
    return parts[0];
  }
  const prefix = parts.slice(0, -1).join(", ");
  const oxford = parts.length > 2 ? "," : "";
  return `${prefix}${oxford} and ${parts[parts.length - 1]}`;
}

export class CitationEngine {
  constructor(private readonly provider: DataProvider) {}

  async listPackages(): Promise<string[]> {
    const citations = await this.provider.getCitations();
    return Object.keys(citations).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  }

  async getPackage(packageName: string): Promise<CitationPackage> {
    const citations = await this.provider.getCitations();
    const record = citations[packageName];
    if (!record) {
      throw new Error(`Unknown package "${packageName}". Package matching is exact.`);
    }
    return record;
  }

  async cite(packages: string[], options: CiteOptions = {}): Promise<CitationOutput | string[]> {
    if (packages.length === 0) {
      throw new Error("No packages provided.");
    }

    const versionsByPackage = options.versions ?? {};
    const latest = options.latest !== false;
    const expandedPackages = await expandWithDependencies(this.provider, packages);

    if (options.depsOnly) {
      return expandedPackages;
    }

    const citations = await this.provider.getCitations();
    const bibtexTable = await this.provider.getBibtexTable();

    const ackToAdd: string[] = [];
    const customAcksToAdd: string[] = [];
    const bibsToAdd: string[] = [];
    const packageInfo: CitationOutput["packages"] = [];

    for (const packageName of packages) {
      const citation = citations[packageName];
      if (!citation) {
        throw new Error(`Unknown package "${packageName}". Package matching is exact.`);
      }

      const tags = citation.tags ?? [];
      let acknowledgement = `\\texttt{${packageName}}`;
      if (tags.length > 0 && tags[0] !== "") {
        acknowledgement += ` \\citep{${tags.join(",")}}`;
      }
      let customAck = citation.custom_citation ?? "";

      let selectedVersion: string | undefined;
      let selectedDoi: string | undefined;

      if (citation.zenodo_doi !== "") {
        const versions = await this.provider.getVersions(packageName);
        const requestedVersion = versionsByPackage[packageName];
        let selected: ZenodoVersion | undefined;

        if (requestedVersion) {
          selected = resolveRequestedVersion(versions, requestedVersion);
          if (!selected) {
            throw new Error(`Version "${requestedVersion}" was not found for package "${packageName}".`);
          }
        } else if (latest) {
          selected = versions[0];
        }

        if (selected) {
          selectedVersion = selected.version;
          selectedDoi = selected.doi;
          const tag = `${packageName}_${selected.doi}`;

          if (acknowledgement.includes("\\citep")) {
            acknowledgement = `${acknowledgement.slice(0, -1)},${tag}}`;
          } else {
            acknowledgement += ` \\citep{${tag}}`;
          }

          if (customAck.endsWith(".")) {
            customAck = customAck.slice(0, -1);
          }

          if (customAck !== "") {
            const updated = appendTagToCitep(customAck, tag);
            customAck = updated === customAck ? `${customAck} \\citep{${tag}}.` : updated;
          }

          const zenodoBibtex = await this.provider.getZenodoBibtex(selected.doi);
          bibsToAdd.push(replaceBibtexTag(zenodoBibtex, tag));
        } else {
          acknowledgement += "\\footnote{{TODO}: Need to choose a version to cite!!}";
          if (customAck !== "") {
            customAck += "\\footnote{{TODO}: Need to choose a version to cite!!}";
          }
        }
      }

      if (customAck !== "") {
        customAcksToAdd.push(customAck);
      } else {
        ackToAdd.push(acknowledgement);
      }

      for (const tag of tags) {
        if (tag && bibtexTable[tag]) {
          bibsToAdd.push(bibtexTable[tag]);
        }
      }

      if (citation.extra_bibtex) {
        bibsToAdd.push(citation.extra_bibtex);
      }

      packageInfo.push({
        name: packageName,
        selectedVersion,
        selectedDoi
      });
    }

    let acknowledgementText = "";
    if (ackToAdd.length > 0) {
      acknowledgementText = `This work made use of the following software packages: ${joinAcknowledgements(ackToAdd)}.`;
    }
    if (customAcksToAdd.length > 0 && ackToAdd.length > 0) {
      acknowledgementText += "\n\n";
    }
    acknowledgementText += customAcksToAdd.join("\n\n");
    acknowledgementText += "\n\nSoftware citation information aggregated using \\texttt{\\href{https://www.tomwagg.com/software-citation-station/}{The Software Citation Station}} \\citep{software-citation-station-paper,software-citation-station-zenodo}.";

    if (bibtexTable["software-citation-station-paper"]) {
      bibsToAdd.push(bibtexTable["software-citation-station-paper"]);
    }

    const scsZenodoBibtex = await this.provider.getZenodoBibtex("13225526");
    if (!bibsToAdd.some(entry => entry.includes("software-citation-station-zenodo"))) {
      bibsToAdd.push(replaceBibtexTag(scsZenodoBibtex, "software-citation-station-zenodo"));
    }

    return {
      acknowledgement: acknowledgementText.trim(),
      bibtex: bibsToAdd.join("\n\n").trim(),
      packages: packageInfo
    };
  }
}
