import { CitationEngine } from "../src/citationEngine";
import { CitationPackage, DataProvider, ZenodoVersion } from "../src/citationTypes";

class MockProvider implements DataProvider {
  constructor(
    private readonly citations: Record<string, CitationPackage>,
    private readonly bibtexTable: Record<string, string>,
    private readonly versions: Record<string, ZenodoVersion[]>,
    private readonly zenodoBibtex: Record<string, string>
  ) {}

  async getCitations(): Promise<Record<string, CitationPackage>> {
    return this.citations;
  }

  async getBibtexTable(): Promise<Record<string, string>> {
    return this.bibtexTable;
  }

  async getVersions(packageName: string): Promise<ZenodoVersion[]> {
    return this.versions[packageName] ?? [];
  }

  async getZenodoBibtex(doi: string): Promise<string> {
    const entry = this.zenodoBibtex[doi];
    if (!entry) {
      throw new Error(`missing zenodo bibtex for ${doi}`);
    }
    return entry;
  }
}

const baseCitation: CitationPackage = {
  tags: [],
  logo: "",
  language: "python",
  category: "general",
  keywords: [],
  description: "",
  link: "",
  zenodo_doi: "",
  attribution_link: "",
  custom_citation: "",
  dependencies: []
};

describe("CitationEngine", () => {
  it("uses exact package matching", async () => {
    const provider = new MockProvider(
      { scipy: { ...baseCitation } },
      {},
      {},
      { "13225526": "@software{z,key=1}" }
    );
    const engine = new CitationEngine(provider);
    await expect(engine.cite(["SciPy"])).rejects.toThrow("Unknown package");
  });

  it("includes latest zenodo version citation and station references", async () => {
    const provider = new MockProvider(
      {
        scipy: {
          ...baseCitation,
          tags: ["scipy-paper"],
          zenodo_doi: "10.5281/zenodo.111"
        }
      },
      {
        "scipy-paper": "@article{scipy-paper,title={SciPy}}",
        "software-citation-station-paper": "@article{software-citation-station-paper,title={SCS}}"
      },
      {
        scipy: [
          { version: "1.11.0", doi: "999" },
          { version: "1.10.0", doi: "998" }
        ]
      },
      {
        "999": "@software{orig-999,title={SciPy 1.11}}",
        "13225526": "@software{orig-scs,title={SCS Zenodo}}"
      }
    );
    const engine = new CitationEngine(provider);
    const output = await engine.cite(["scipy"], { latest: true });

    expect(output.acknowledgement).toContain("\\citep{scipy-paper,scipy_999}");
    expect(output.acknowledgement).toContain("software-citation-station-paper,software-citation-station-zenodo");
    expect(output.bibtex).toContain("@software{scipy_999,");
    expect(output.bibtex).toContain("@article{software-citation-station-paper,");
    expect(output.bibtex).toContain("@software{software-citation-station-zenodo,");
  });

  it("honors explicit version overrides", async () => {
    const provider = new MockProvider(
      {
        scipy: {
          ...baseCitation,
          zenodo_doi: "10.5281/zenodo.111"
        }
      },
      {
        "software-citation-station-paper": "@article{software-citation-station-paper,title={SCS}}"
      },
      {
        scipy: [
          { version: "1.11.0", doi: "999" },
          { version: "1.10.0", doi: "998" }
        ]
      },
      {
        "998": "@software{orig-998,title={SciPy 1.10}}",
        "13225526": "@software{orig-scs,title={SCS Zenodo}}"
      }
    );
    const engine = new CitationEngine(provider);
    const output = await engine.cite(["scipy"], { versions: { scipy: "1.10.0" } });
    expect(output.bibtex).toContain("@software{scipy_998,");
    expect(output.packages[0].selectedVersion).toBe("1.10.0");
  });

  it("matches explicit version overrides with or without v prefix", async () => {
    const provider = new MockProvider(
      {
        scipy: {
          ...baseCitation,
          zenodo_doi: "10.5281/zenodo.111"
        }
      },
      {
        "software-citation-station-paper": "@article{software-citation-station-paper,title={SCS}}"
      },
      {
        scipy: [
          { version: "v1.17.1", doi: "999" }
        ]
      },
      {
        "999": "@software{orig-999,title={SciPy 1.17.1}}",
        "13225526": "@software{orig-scs,title={SCS Zenodo}}"
      }
    );
    const engine = new CitationEngine(provider);
    const output = await engine.cite(["scipy"], { versions: { scipy: "1.17.1" } });
    expect(output.packages[0].selectedVersion).toBe("v1.17.1");
    expect(output.packages[0].selectedDoi).toBe("999");
  });
});
