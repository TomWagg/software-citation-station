import { parseFlags, printUsage, printByFormat, splitPinnedPackage } from "../src/cli";
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

describe("printUsage", () => {
  it('should log usage information', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    
    printUsage();
    
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Software Citation Station CLI'));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('COMMANDS'));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('OPTIONS'));
    
    consoleSpy.mockRestore();
  });
});

describe("printByFormat", () => {
  it('should print JSON format', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    const data = { test: 'value' };
    
    printByFormat('json', data);
    
    expect(consoleSpy).toHaveBeenCalledWith(JSON.stringify(data, null, 2));
    
    consoleSpy.mockRestore();
  });

  it('should print text format with selector', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    const data = { name: 'test', version: '1.0' };
    
    printByFormat('text', data, (x: any) => `${x.name} ${x.version}`);
    
    expect(consoleSpy).toHaveBeenCalledWith('test 1.0');
    
    consoleSpy.mockRestore();
  });

  it('should print text format without selector', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    const data = 'simple string';
    
    printByFormat('text', data);
    
    expect(consoleSpy).toHaveBeenCalledWith('simple string');
    
    consoleSpy.mockRestore();
  });
});

describe("splitPinnedPackage", () => {
  it('should split valid pinned package', () => {
    const result = splitPinnedPackage('numpy==1.24.0');
    expect(result).toEqual({ packageName: 'numpy', version: '1.24.0' });
  });

  it('should handle package with spaces', () => {
    const result = splitPinnedPackage('scipy == 1.10.0');
    expect(result).toEqual({ packageName: 'scipy', version: '1.10.0' });
  });

  it('should return null for package without version', () => {
    const result = splitPinnedPackage('numpy');
    expect(result).toBeNull();
  });

  it('should return null for single equals (invalid)', () => {
    const result = splitPinnedPackage('numpy=1.24.0');
    expect(result).toBeNull();
  });

  it('should throw error for empty package name', () => {
    expect(() => splitPinnedPackage('==1.24.0')).toThrow('Invalid pinned package');
  });

  it('should throw error for empty version', () => {
    expect(() => splitPinnedPackage('numpy==')).toThrow('Invalid pinned package');
  });
});

describe("CLI commands (integration)", () => {
  const mockDataProvider = {
    getCitations: jest.fn(),
    getVersions: jest.fn(),
    getZenodoRecord: jest.fn(),
    getBibtexTable: jest.fn(),
    getZenodoBibtex: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockDataProvider.getCitations.mockResolvedValue({
      scipy: { name: 'scipy', language: 'python', category: 'physics', zenodo_doi: '10.5281/zenodo.123', tags: [], dependencies: [] },
      numpy: { name: 'numpy', language: 'python', category: 'physics', zenodo_doi: '', tags: [], dependencies: [] }
    });
  });

  describe("list command", () => {
    it("should list packages in text format", async () => {
      const { CitationEngine } = await import('../src/citationEngine');
      const engine = new CitationEngine(mockDataProvider as any);
      
      const packages = await engine.listPackages();
      
      expect(packages).toContain('scipy');
      expect(packages).toContain('numpy');
    });

    it("should list packages in JSON format", async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const { CitationEngine } = await import('../src/citationEngine');
      const engine = new CitationEngine(mockDataProvider as any);
      const packages = await engine.listPackages();
      
      console.log(JSON.stringify({ packages }, null, 2));
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"packages"')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"scipy"')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe("show command", () => {
    it("should show package details", async () => {
      const { CitationEngine } = await import('../src/citationEngine');
      const engine = new CitationEngine(mockDataProvider as any);
      
      const pkg = await engine.getPackage('scipy');
      
      expect(pkg.language).toBe('python');
      expect(pkg.zenodo_doi).toBe('10.5281/zenodo.123');
    });

    it("should throw error for non-existent package", async () => {
      mockDataProvider.getCitations.mockResolvedValue({});
      
      const { CitationEngine } = await import('../src/citationEngine');
      const engine = new CitationEngine(mockDataProvider as any);
      
      await expect(engine.getPackage('nonexistent')).rejects.toThrow('Unknown package');
    });
  });

  describe("cite command", () => {
    it("should cite packages", async () => {
      mockDataProvider.getBibtexTable.mockResolvedValue({});
      mockDataProvider.getVersions.mockResolvedValue([]);
      mockDataProvider.getZenodoBibtex.mockResolvedValue("@software{test}");
      
      const { CitationEngine } = await import('../src/citationEngine');
      const engine = new CitationEngine(mockDataProvider as any);
      
      const result = await engine.cite(['scipy', 'numpy']);
      
      expect(result.acknowledgement).toContain('scipy');
      expect(result.acknowledgement).toContain('numpy');
    });

    it("should expand dependencies when depsOnly is true", async () => {
      mockDataProvider.getCitations.mockResolvedValue({
        pkgA: { name: 'pkgA', language: 'python', category: 'test', zenodo_doi: '', tags: [], dependencies: ['pkgB'] },
        pkgB: { name: 'pkgB', language: 'python', category: 'test', zenodo_doi: '', tags: [], dependencies: [] }
      });
      
      const { CitationEngine } = await import('../src/citationEngine');
      const engine = new CitationEngine(mockDataProvider as any);
      
      const result = await engine.cite(['pkgA'], { depsOnly: true });
      
      expect(result).toContain('pkgA');
      expect(result).toContain('pkgB');
    });
  });

