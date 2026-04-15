import { parseFlags } from "../src/cli";
import { CitationEngine } from "../src/citationEngine";
import { CitationPackage, DataProvider, ZenodoVersion, CitationOutput } from "../src/citationTypes";

describe("CLI flag parsing", () => {
  it("parses default flags", () => {
    const result = parseFlags(["scipy", "numpy"]);
    expect(result.format).toBe("text");
    expect(result.acknowledgement).toBe(false);
    expect(result.bibtex).toBe(false);
    expect(result.deps).toBe(false);
    expect(result.positional).toEqual(["scipy", "numpy"]);
  });

  it("parses --json flag", () => {
    const result = parseFlags(["scipy", "--json"]);
    expect(result.format).toBe("json");
  });

  it("parses --acknowledgement flag", () => {
    const result = parseFlags(["scipy", "--acknowledgement"]);
    expect(result.acknowledgement).toBe(true);
    expect(result.bibtex).toBe(false);
  });

  it("parses --ack short flag", () => {
    const result = parseFlags(["scipy", "--ack"]);
    expect(result.acknowledgement).toBe(true);
    expect(result.bibtex).toBe(false);
  });

  it("parses --bibtex flag", () => {
    const result = parseFlags(["scipy", "--bibtex"]);
    expect(result.bibtex).toBe(true);
    expect(result.acknowledgement).toBe(false);
  });

  it("parses --deps flag", () => {
    const result = parseFlags(["scipy", "--deps"]);
    expect(result.deps).toBe(true);
  });

  it("parses multiple flags together", () => {
    const result = parseFlags(["scipy", "numpy", "--json", "--deps"]);
    expect(result.format).toBe("json");
    expect(result.deps).toBe(true);
    expect(result.positional).toEqual(["scipy", "numpy"]);
  });

  it("parses version pinning in positional args", () => {
    const result = parseFlags(["scipy==1.10.0", "numpy"]);
    expect(result.positional).toEqual(["scipy==1.10.0", "numpy"]);
  });

  it("ignores unknown flags as positional", () => {
    const result = parseFlags(["scipy", "--unknown"]);
    expect(result.positional).toEqual(["scipy", "--unknown"]);
  });
});

// Mock data provider for integration tests
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

describe("CitationEngine integration", () => {
  describe("listPackages", () => {
    it("returns sorted package list", async () => {
      const provider = new MockProvider(
        { numpy: { ...baseCitation }, scipy: { ...baseCitation }, astropy: { ...baseCitation } },
        {}, {}, {}
      );
      const engine = new CitationEngine(provider);
      const packages = await engine.listPackages();
      expect(packages).toEqual(["astropy", "numpy", "scipy"]);
    });

    it("handles empty package list", async () => {
      const provider = new MockProvider({}, {}, {}, {});
      const engine = new CitationEngine(provider);
      const packages = await engine.listPackages();
      expect(packages).toEqual([]);
    });
  });

  describe("getPackage", () => {
    it("returns package details", async () => {
      const citation = { ...baseCitation, language: "python", category: "astronomy" };
      const provider = new MockProvider({ scipy: citation }, {}, {}, {});
      const engine = new CitationEngine(provider);
      const result = await engine.getPackage("scipy");
      expect(result.language).toBe("python");
      expect(result.category).toBe("astronomy");
    });

    it("throws error for unknown package", async () => {
      const provider = new MockProvider({}, {}, {}, {});
      const engine = new CitationEngine(provider);
      await expect(engine.getPackage("unknown")).rejects.toThrow('Unknown package "unknown"');
    });
  });

  describe("cite command", () => {
    it("generates citation for single package", async () => {
      const provider = new MockProvider(
        { scipy: { ...baseCitation, tags: ["scipy-paper"] } },
        { "scipy-paper": "@article{scipy-paper,title={SciPy}}" },
        {},
        { "13225526": "@software{scs,title={SCS}}" }
      );
      const engine = new CitationEngine(provider);
      const result = await engine.cite(["scipy"]) as CitationOutput;
      expect(result.acknowledgement).toContain("scipy");
      expect(result.bibtex).toContain("@article{scipy-paper");
    });

    it("generates citation for multiple packages", async () => {
      const provider = new MockProvider(
        {
          scipy: { ...baseCitation, tags: ["scipy-paper"] },
          numpy: { ...baseCitation, tags: ["numpy-paper"] }
        },
        {
          "scipy-paper": "@article{scipy-paper,title={SciPy}}",
          "numpy-paper": "@article{numpy-paper,title={NumPy}}"
        },
        {},
        { "13225526": "@software{scs,title={SCS}}" }
      );
      const engine = new CitationEngine(provider);
      const result = await engine.cite(["scipy", "numpy"]) as CitationOutput;
      expect(result.acknowledgement).toContain("scipy");
      expect(result.acknowledgement).toContain("numpy");
      expect(result.packages).toHaveLength(2);
    });

    it("throws error for unknown package in cite", async () => {
      const provider = new MockProvider({}, {}, {}, {});
      const engine = new CitationEngine(provider);
      await expect(engine.cite(["unknown"])).rejects.toThrow('Unknown package "unknown"');
    });

    it("throws error for empty package list", async () => {
      const provider = new MockProvider({}, {}, {}, {});
      const engine = new CitationEngine(provider);
      await expect(engine.cite([])).rejects.toThrow("No packages provided");
    });

    it("includes zenodo version when available", async () => {
      const provider = new MockProvider(
        { scipy: { ...baseCitation, zenodo_doi: "10.5281/zenodo.111" } },
        {},
        { scipy: [{ version: "1.11.0", doi: "999" }] },
        {
          "999": "@software{scipy-999,title={SciPy 1.11}}",
          "13225526": "@software{scs,title={SCS}}"
        }
      );
      const engine = new CitationEngine(provider);
      const result = await engine.cite(["scipy"]) as CitationOutput;
      expect(result.bibtex).toContain("@software{scipy_999");
      expect(result.packages[0].selectedVersion).toBe("1.11.0");
    });

    it("respects explicit version override", async () => {
      const provider = new MockProvider(
        { scipy: { ...baseCitation, zenodo_doi: "10.5281/zenodo.111" } },
        {},
        {
          scipy: [
            { version: "1.11.0", doi: "999" },
            { version: "1.10.0", doi: "998" }
          ]
        },
        {
          "998": "@software{scipy-998,title={SciPy 1.10}}",
          "13225526": "@software{scs,title={SCS}}"
        }
      );
      const engine = new CitationEngine(provider);
      const result = await engine.cite(["scipy"], { versions: { scipy: "1.10.0" } }) as CitationOutput;
      expect(result.packages[0].selectedVersion).toBe("1.10.0");
      expect(result.bibtex).toContain("@software{scipy_998");
    });

    it("throws error for invalid version", async () => {
      const provider = new MockProvider(
        { scipy: { ...baseCitation, zenodo_doi: "10.5281/zenodo.111" } },
        {},
        { scipy: [{ version: "1.11.0", doi: "999" }] },
        { "13225526": "@software{scs,title={SCS}}" }
      );
      const engine = new CitationEngine(provider);
      await expect(engine.cite(["scipy"], { versions: { scipy: "9.9.9" } }))
        .rejects.toThrow('Version "9.9.9" was not found');
    });
  });

  describe("deps command", () => {
    it("returns dependencies only", async () => {
      const provider = new MockProvider(
        {
          scipy: { ...baseCitation, dependencies: ["numpy"] },
          numpy: { ...baseCitation }
        },
        {}, {}, {}
      );
      const engine = new CitationEngine(provider);
      const result = await engine.cite(["scipy"], { depsOnly: true });
      expect(Array.isArray(result)).toBe(true);
      expect(result).toContain("scipy");
      expect(result).toContain("numpy");
    });

    it("handles packages without dependencies", async () => {
      const provider = new MockProvider(
        { numpy: { ...baseCitation } },
        {}, {}, {}
      );
      const engine = new CitationEngine(provider);
      const result = await engine.cite(["numpy"], { depsOnly: true });
      expect(result).toEqual(["numpy"]);
    });

    it("expands transitive dependencies", async () => {
      const provider = new MockProvider(
        {
          packageA: { ...baseCitation, dependencies: ["packageB"] },
          packageB: { ...baseCitation, dependencies: ["packageC"] },
          packageC: { ...baseCitation }
        },
        {}, {}, {}
      );
      const engine = new CitationEngine(provider);
      const result = await engine.cite(["packageA"], { depsOnly: true });
      expect(result).toContain("packageA");
      expect(result).toContain("packageB");
      expect(result).toContain("packageC");
    });

    it("avoids duplicate dependencies", async () => {
      const provider = new MockProvider(
        {
          packageA: { ...baseCitation, dependencies: ["packageC"] },
          packageB: { ...baseCitation, dependencies: ["packageC"] },
          packageC: { ...baseCitation }
        },
        {}, {}, {}
      );
      const engine = new CitationEngine(provider);
      const result = await engine.cite(["packageA", "packageB"], { depsOnly: true });
      // packageC should only appear once
      expect(result.filter(p => p === "packageC")).toHaveLength(1);
    });
  });
});
