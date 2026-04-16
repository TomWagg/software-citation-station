/**
 * Unit tests for frontend TypeScript modules
 */

import { parseBibtexFrontend, FrontendDataProvider } from '../src/frontend/citationCore';
import { parseRequirementsTxt, parseCondaEnvYaml, parseEnvironmentFile } from '../src/shared/fileParser';
import { expandDependencies } from '../src/shared/dependencyResolver';

// Mock data for testing
const mockCitations = {
  scipy: {
    name: 'scipy',
    language: 'python',
    category: 'data',
    zenodo_doi: '10.5281/zenodo.595738',
    tags: ['2020SciPy-NMeth', 'scipy_18736568'],
    logo: 'img/scipy.png',
    description: 'SciPy: Scientific Computing tools for Python'
  },
  numpy: {
    name: 'numpy',
    language: 'python',
    category: 'data',
    zenodo_doi: '10.5281/zenodo.595738',
    tags: ['numpy'],
    logo: 'img/numpy.png',
    description: 'NumPy: Fundamental package for scientific computing'
  },
  astropy: {
    name: 'astropy',
    language: 'python',
    category: 'astronomy',
    zenodo_doi: '10.5281/zenodo.595738',
    tags: ['astropy'],
    logo: '',
    description: 'Astropy: Astronomy and astrophysics library'
  },
  python: {
    name: 'python',
    language: 'python',
    category: 'language',
    zenodo_doi: '',
    tags: ['python'],
    logo: 'img/python.png',
    description: 'Python programming language'
  }
};

describe('FrontendDataProvider', () => {
  let provider: FrontendDataProvider;
  let originalFetch: typeof global.fetch;

  beforeAll(() => {
    originalFetch = global.fetch;
    global.fetch = jest.fn();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  beforeEach(() => {
    provider = new FrontendDataProvider();
    jest.clearAllMocks();
  });

  describe('getCitations', () => {
    it('should fetch and parse citations.json', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCitations)
      });

      const citations = await provider.getCitations();
      
      expect(fetch).toHaveBeenCalledWith('data/citations.json');
      expect(citations).toEqual(mockCitations);
      expect(Object.keys(citations)).toContain('scipy');
    });

    it('should throw error if fetch fails', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404
      });

      await expect(provider.getCitations()).rejects.toThrow('Failed to fetch citations: 404');
    });

    it('should cache the fetch result', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCitations)
      });

      await provider.getCitations();
      await provider.getCitations();
      
      // Should only fetch once
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('getBibtexTable', () => {
    it('should fetch and parse bibtex.bib', async () => {
      const bibtexText = `@article{test,
  title = {Test Article},
  author = {Test Author}
}`;
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(bibtexText)
      });

      const table = await provider.getBibtexTable();
      
      expect(fetch).toHaveBeenCalledWith('data/bibtex.bib');
      expect(table).toHaveProperty('test');
    });

    it('should cache the bibtex fetch result', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('@article{test, title={Test}}')
      });

      await provider.getBibtexTable();
      await provider.getBibtexTable();
      
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('getVersions', () => {
    it('should fetch cached versions for a package', async () => {
      const mockVersions = [
        { version: '1.0.0', doi: '10.5281/zenodo.123' },
        { version: '1.1.0', doi: '10.5281/zenodo.456' }
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockVersions)
      });

      const versions = await provider.getVersions('scipy');
      
      expect(fetch).toHaveBeenCalledWith('data/zenodo-versions/scipy.json');
      expect(versions).toEqual(mockVersions);
    });

    it('should return empty array if versions file not found', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404
      });

      const versions = await provider.getVersions('unknown-package');
      
      expect(versions).toEqual([]);
    });
  });

  describe('getZenodoBibtex', () => {
    it('should fetch BibTeX from Zenodo API', async () => {
      const mockBibtex = '@software{test, title={Test Software}}';
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockBibtex)
      });

      const bibtex = await provider.getZenodoBibtex('10.5281/zenodo.123');
      
      expect(fetch).toHaveBeenCalled();
      expect(bibtex).toBe(mockBibtex);
    });

    it('should return empty string on error', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const bibtex = await provider.getZenodoBibtex('10.5281/zenodo.123');
      
      expect(bibtex).toBe('');
    });
  });

  describe('expandWithDependencies', () => {
    it('should expand packages with dependencies', async () => {
      const citationsWithDeps = {
        scipy: {
          name: 'scipy',
          language: 'python',
          category: 'data',
          zenodo_doi: '10.5281/zenodo.595738',
          tags: ['2020SciPy-NMeth'],
          dependencies: ['numpy', 'python']
        },
        numpy: {
          name: 'numpy',
          language: 'python',
          category: 'data',
          zenodo_doi: '10.5281/zenodo.595738',
          tags: ['numpy'],
          dependencies: ['python']
        },
        python: {
          name: 'python',
          language: 'python',
          category: 'language',
          zenodo_doi: '',
          tags: ['python']
        }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(citationsWithDeps)
      });

      const packages = await provider.expandWithDependencies(['scipy'], true);
      
      expect(packages).toContain('scipy');
      expect(packages).toContain('numpy');
      expect(packages).toContain('python');
    });

    it('should not expand if autoExpand is false', async () => {
      const packages = await provider.expandWithDependencies(['scipy'], false);
      
      expect(packages).toEqual(['scipy']);
      expect(fetch).not.toHaveBeenCalled();
    });
  });
});

describe('parseBibtexFrontend', () => {
  it('should parse simple BibTeX', () => {
    const bibtex = `@article{test2020,
  title = {Test Article},
  author = {Test Author},
  year = {2020}
}`;

    const result = parseBibtexFrontend(bibtex);
    
    expect(result).toHaveProperty('test2020');
    expect(result.test2020).toContain('@article');
    expect(result.test2020).toContain('test2020');
  });

  it('should parse multiple BibTeX entries', () => {
    const bibtex = `@article{article1,
  title = {First Article}
}

@book{book1,
  title = {First Book}
}`;

    const result = parseBibtexFrontend(bibtex);
    
    expect(Object.keys(result)).toHaveLength(2);
    expect(result).toHaveProperty('article1');
    expect(result).toHaveProperty('book1');
  });

  it('should handle empty BibTeX', () => {
    const result = parseBibtexFrontend('');
    expect(result).toEqual({});
  });
});

describe('parseEnvironmentFile', () => {
  it('should auto-detect requirements.txt format', () => {
    const content = `numpy==1.24.0
scipy==1.10.0`;
    
    const result = parseEnvironmentFile(content, 'requirements.txt');
    
    expect(result.source).toBe('requirements');
    expect(result.packages).toEqual(['numpy', 'scipy']);
  });

  it('should auto-detect conda env format', () => {
    const content = `name: testenv
dependencies:
  - numpy=1.24.0
  - scipy=1.10.0`;
    
    const result = parseEnvironmentFile(content, 'environment.yaml');
    
    expect(result.source).toBe('conda');
    expect(result.packages).toEqual(['numpy', 'scipy']);
  });

  it('should detect format by content if filename is unclear', () => {
    const content = `name: testenv
dependencies:
  - numpy=1.24.0`;
    
    // Use a filename that doesn't match .yaml or .txt patterns
    const result = parseEnvironmentFile(content, 'unknown_file');
    
    // Should auto-detect conda format from content
    expect(result.source).toBe('conda');
    expect(result.packages).toEqual(['numpy']);
  });
});

describe('expandDependencies', () => {
  it('should expand package with dependencies', () => {
    const citations = {
      scipy: { dependencies: ['numpy', 'python'] } as any,
      numpy: { dependencies: ['python'] } as any,
      python: {} as any
    };

    const result = expandDependencies(['scipy'], citations, { autoExpand: true });
    
    expect(result).toContain('scipy');
    expect(result).toContain('numpy');
    expect(result).toContain('python');
  });

  it('should handle circular dependencies', () => {
    const citations = {
      a: { dependencies: ['b'] } as any,
      b: { dependencies: ['a'] } as any
    };

    const result = expandDependencies(['a'], citations, { autoExpand: true });
    
    expect(result).toContain('a');
    expect(result).toContain('b');
    expect(result).toHaveLength(2); // Should not have duplicates
  });

  it('should respect maxDepth option', () => {
    const citations = {
      a: { dependencies: ['b'] } as any,
      b: { dependencies: ['c'] } as any,
      c: { dependencies: ['d'] } as any,
      d: {} as any
    };

    // maxDepth: 2 means we process up to depth 1 (0-indexed)
    // depth 0: a (added)
    // depth 1: b (added)
    // depth 2: c (skipped because depth >= maxDepth)
    const result = expandDependencies(['a'], citations, { autoExpand: true, maxDepth: 2 });
    
    expect(result).toContain('a');
    expect(result).toContain('b');
    expect(result).not.toContain('c'); // Should stop before depth 2
    expect(result).not.toContain('d');
  });

  it('should return original list if autoExpand is false', () => {
    const citations = {
      scipy: { dependencies: ['numpy'] } as any,
      numpy: {} as any
    };

    const result = expandDependencies(['scipy'], citations, { autoExpand: false });
    
    expect(result).toEqual(['scipy']);
  });

  it('should handle packages with no dependencies', () => {
    const citations = {
      standalone: {} as any
    };

    const result = expandDependencies(['standalone'], citations, { autoExpand: true });
    
    expect(result).toEqual(['standalone']);
  });

  it('should skip unknown packages', () => {
    const citations = {
      known: { dependencies: ['unknown'] } as any
    };

    const result = expandDependencies(['known'], citations, { autoExpand: true });
    
    expect(result).toEqual(['known']);
  });
});

describe('parseRequirementsTxt', () => {
  it('should handle packages with extras', () => {
    const content = `package[extra1]==1.0.0
package2[extra1,extra2]>=2.0.0`;

    const result = parseRequirementsTxt(content);
    
    expect(result.packages).toEqual(['package', 'package2']);
  });

  it('should handle various version specifiers', () => {
    const content = `pkg1==1.0.0
pkg2>=2.0.0
pkg3~=3.0.0
pkg4!=4.0.0
pkg5>5.0.0
pkg6<6.0.0`;

    const result = parseRequirementsTxt(content);
    
    expect(result.packages).toEqual(['pkg1', 'pkg2', 'pkg3', 'pkg4', 'pkg5', 'pkg6']);
  });

  it('should handle pip freeze output', () => {
    const content = `astropy==5.3.4
certifi==2023.11.17
cffi==1.16.0`;

    const result = parseRequirementsTxt(content);
    
    expect(result.packages).toEqual(['astropy', 'certifi', 'cffi']);
    expect(result.source).toBe('requirements');
  });
});

describe('parseCondaEnvYaml', () => {
  it('should parse conda dependencies', () => {
    const content = `name: testenv
channels:
  - conda-forge
dependencies:
  - python=3.9
  - numpy=1.24.0
  - scipy=1.10.0`;

    const result = parseCondaEnvYaml(content);
    
    expect(result.packages).toEqual(['python', 'numpy', 'scipy']);
    expect(result.pythonVersion).toBe('3.9');
  });

  it('should parse pip subsection', () => {
    const content = `name: testenv
dependencies:
  - numpy=1.24.0
  - pip:
    - requests==2.28.0
    - tqdm==4.65.0`;

    const result = parseCondaEnvYaml(content);
    
    expect(result.packages).toEqual(['numpy', 'requests', 'tqdm']);
  });

  it('should handle empty pip subsection', () => {
    const content = `name: testenv
dependencies:
  - numpy=1.24.0
  - pip:`;

    const result = parseCondaEnvYaml(content);
    
    expect(result.packages).toEqual(['numpy']);
  });
});
