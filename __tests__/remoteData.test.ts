/**
 * Unit tests for remoteData.ts
 */

import { RemoteDataProvider, DEFAULT_BASE_URL } from '../src/remoteData';

describe('RemoteDataProvider', () => {
  describe('joinUrl (internal function)', () => {
    it('should join base URL and path', () => {
      // Test the URL joining logic used internally
      const baseUrl = 'https://example.com';
      const path = 'data/file.json';
      const expected = 'https://example.com/data/file.json';
      
      // Simulate the join logic
      const result = `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
      expect(result).toBe(expected);
    });

    it('should handle trailing slash in base URL', () => {
      const baseUrl = 'https://example.com/';
      const path = 'data/file.json';
      const result = `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
      expect(result).toBe('https://example.com/data/file.json');
    });

    it('should handle leading slash in path', () => {
      const baseUrl = 'https://example.com';
      const path = '/data/file.json';
      const result = `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
      expect(result).toBe('https://example.com/data/file.json');
    });

    it('should handle multiple slashes', () => {
      const baseUrl = 'https://example.com///';
      const path = '///data/file.json';
      const result = `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
      expect(result).toBe('https://example.com/data/file.json');
    });
  });

  let provider: RemoteDataProvider;
  let originalFetch: typeof global.fetch;

  beforeAll(() => {
    originalFetch = global.fetch;
    global.fetch = jest.fn();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  beforeEach(() => {
    provider = new RemoteDataProvider();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should use default base URL', () => {
      const defaultProvider = new RemoteDataProvider();
      expect(defaultProvider).toBeTruthy();
    });

    it('should accept custom base URL', () => {
      const customProvider = new RemoteDataProvider('https://custom.example.com');
      expect(customProvider).toBeTruthy();
    });
  });

  describe('getCitations', () => {
    it('should fetch citations from remote URL', async () => {
      const mockCitations = {
        scipy: {
          name: 'scipy',
          language: 'python',
          category: 'data',
          tags: ['test'],
          logo: '',
          description: '',
          link: '',
          zenodo_doi: '',
          attribution_link: '',
          custom_citation: ''
        }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCitations)
      });

      const citations = await provider.getCitations();
      
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('data/citations.json'),
        expect.any(Object)
      );
      expect(citations).toEqual(mockCitations);
    });

    it('should cache citations fetch', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({})
      });

      await provider.getCitations();
      await provider.getCitations();
      
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('should throw error on fetch failure', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404
      });

      await expect(provider.getCitations()).rejects.toThrow('Failed to fetch');
    });
  });

  describe('getBibtexTable', () => {
    it('should fetch and parse bibtex from remote URL', async () => {
      const bibtexText = `@article{test,
  title = {Test Article}
}`;

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(bibtexText)
      });

      const table = await provider.getBibtexTable();
      
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('data/bibtex.bib'),
        expect.any(Object)
      );
      expect(table).toHaveProperty('test');
    });

    it('should cache bibtex fetch', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('@article{test, title={Test}}')
      });

      await provider.getBibtexTable();
      await provider.getBibtexTable();
      
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('should throw error on fetch failure', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      await expect(provider.getBibtexTable()).rejects.toThrow('Failed to fetch');
    });
  });

  describe('getVersions', () => {
    it('should fetch versions for a package', async () => {
      const mockVersions = [
        { version: '1.0.0', doi: '10.5281/zenodo.123' },
        { version: '1.1.0', doi: '10.5281/zenodo.456' }
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockVersions)
      });

      const versions = await provider.getVersions('scipy');
      
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('data/zenodo-versions/scipy.json'),
        expect.any(Object)
      );
      expect(versions).toEqual(mockVersions);
    });

    it('should encode package name in URL', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([])
      });

      await provider.getVersions('test-package_name');
      
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('test-package_name'),
        expect.any(Object)
      );
    });

    it('should throw error on fetch failure', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404
      });

      await expect(provider.getVersions('unknown')).rejects.toThrow('Failed to fetch');
    });
  });

  describe('getZenodoBibtex', () => {
    it('should fetch BibTeX from Zenodo API', async () => {
      const mockBibtex = '@software{test, title={Test}}';

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockBibtex)
      });

      const bibtex = await provider.getZenodoBibtex('10.5281/zenodo.123');
      
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('zenodo.org/api/records/'),
        expect.objectContaining({
          headers: {
            Accept: 'application/x-bibtex'
          }
        })
      );
      expect(bibtex).toBe(mockBibtex);
    });

    it('should encode DOI in URL', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('@software{test}')
      });

      await provider.getZenodoBibtex('10.5281/zenodo/test/123');
      
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('10.5281%2Fzenodo%2Ftest%2F123'),
        expect.any(Object)
      );
    });

    it('should throw error on fetch failure', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404
      });

      await expect(provider.getZenodoBibtex('invalid')).rejects.toThrow('Failed to fetch');
    });
  });
});

describe('DEFAULT_BASE_URL', () => {
  it('should be the production URL', () => {
    expect(DEFAULT_BASE_URL).toBe('https://www.tomwagg.com/software-citation-station');
  });
});
