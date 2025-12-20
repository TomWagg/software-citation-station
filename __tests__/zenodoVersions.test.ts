/**
 * Comprehensive unit tests for Zenodo version fetching functionality
 */

import { compareVersions, getZenodoVersionInfo } from '../src/zenodoVersions';

describe('compareVersions', () => {
  it('should return 0 for equal versions', () => {
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    expect(compareVersions('v2.3.4', 'v2.3.4')).toBe(0);
  });

  it('should handle versions with v prefix', () => {
    expect(compareVersions('v1.0.0', '1.0.0')).toBe(0);
    expect(compareVersions('1.0.0', 'v1.0.0')).toBe(0);
  });

  it('should correctly compare major versions', () => {
    expect(compareVersions('2.0.0', '1.0.0')).toBeGreaterThan(0);
    expect(compareVersions('1.0.0', '2.0.0')).toBeLessThan(0);
  });

  it('should correctly compare minor versions', () => {
    expect(compareVersions('1.2.0', '1.1.0')).toBeGreaterThan(0);
    expect(compareVersions('1.1.0', '1.2.0')).toBeLessThan(0);
  });

  it('should correctly compare patch versions', () => {
    expect(compareVersions('1.0.2', '1.0.1')).toBeGreaterThan(0);
    expect(compareVersions('1.0.1', '1.0.2')).toBeLessThan(0);
  });

  it('should handle versions with different lengths', () => {
    // Versions with trailing zeros are considered equal (1.0 == 1.0.0)
    expect(compareVersions('1.0', '1.0.0')).toBe(0);
    expect(compareVersions('1.0.1', '1.0')).toBeGreaterThan(0);
    expect(compareVersions('1.0', '1.0.1')).toBeLessThan(0);
  });

  it('should handle complex version comparisons', () => {
    expect(compareVersions('1.10.0', '1.9.0')).toBeGreaterThan(0);
    expect(compareVersions('2.0.0', '1.99.99')).toBeGreaterThan(0);
  });

  it('should correctly sort an array of versions', () => {
    const versions = ['1.0.0', 'v2.1.0', '1.5.3', 'v1.0.1', '2.0.0'];
    const sorted = versions.sort(compareVersions);
    expect(sorted).toEqual(['1.0.0', 'v1.0.1', '1.5.3', '2.0.0', 'v2.1.0']);
  });
});

describe('getZenodoVersionInfo', () => {
  // Mock fetch globally
  global.fetch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch and parse version information correctly', async () => {
    const mockResponse = {
      hits: {
        total: 3,
        hits: [
          { id: 12345, metadata: { version: '1.0.0' } },
          { id: 12346, metadata: { version: '1.1.0' } },
          { id: 12347, metadata: { version: '2.0.0' } }
        ]
      }
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse
    });

    const result = await getZenodoVersionInfo('10.5281/zenodo.1234567');

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ version: '2.0.0', doi: '12347' });
    expect(result[1]).toEqual({ version: '1.1.0', doi: '12346' });
    expect(result[2]).toEqual({ version: '1.0.0', doi: '12345' });
    // IDs returned as numbers should be coerced to strings
    expect(typeof result[0].doi).toBe('string');
  });

  it('should handle empty results', async () => {
    const mockResponse = {
      hits: {
        total: 0,
        hits: []
      }
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse
    });

    const result = await getZenodoVersionInfo('10.5281/zenodo.9999999');

    expect(result).toHaveLength(0);
  });

  it('should handle duplicate versions', async () => {
    const mockResponse = {
      hits: {
        total: 4,
        hits: [
          { id: '12345', metadata: { version: '1.0.0' }, updated: '2025-12-01T10:00:00Z' },
          { id: '12346', metadata: { version: '1.0.0' }, updated: '2025-12-05T10:00:00Z' }, // duplicate, newer
          { id: '12347', metadata: { version: '1.1.0' }, updated: '2025-12-02T10:00:00Z' },
          { id: '12348', metadata: { version: undefined } } // no version
        ]
      }
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse
    });

    const result = await getZenodoVersionInfo('10.5281/zenodo.1234567');

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ version: '1.1.0', doi: '12347' });
    expect(result[1]).toEqual({ version: '1.0.0', doi: '12346' });
  });

  it('should prefer latest created record when updated is missing', async () => {
    const mockResponse = {
      hits: {
        total: 2,
        hits: [
          { id: '12345', metadata: { version: '1.0.0' }, created: '2025-12-01T10:00:00Z' },
          { id: '12346', metadata: { version: '1.0.0' }, created: '2025-12-03T10:00:00Z' }
        ]
      }
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse
    });

    const result = await getZenodoVersionInfo('10.5281/zenodo.1234567');

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ version: '1.0.0', doi: '12346' });
  });

  it('should ignore undefined versions before checking duplicates', async () => {
    const mockResponse = {
      hits: {
        total: 2,
        hits: [
          { id: 'v0', metadata: { version: '' } }, // empty string is a valid (if odd) version
          { id: 'missing', metadata: { version: undefined } } // should be skipped before duplicate check
        ]
      }
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse
    });

    const result = await getZenodoVersionInfo('10.5281/zenodo.1234567');

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ version: '', doi: 'v0' });
  });

  it('should throw error on HTTP failure', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 404
    });

    await expect(getZenodoVersionInfo('10.5281/zenodo.invalid'))
      .rejects.toThrow('HTTP error! Status: 404');
  });

  it('should handle rate limiting with retry', async () => {
    // First call returns 429, second call succeeds
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: {
          get: (header: string) => {
            if (header === 'x-ratelimit-reset') {
              return String(Math.floor(Date.now() / 1000) + 1);
            }
            return null;
          }
        }
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          hits: {
            total: 1,
            hits: [{ id: '12345', metadata: { version: '1.0.0' } }]
          }
        })
      });

    const result = await getZenodoVersionInfo('10.5281/zenodo.1234567');

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ version: '1.0.0', doi: '12345' });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('should handle pagination correctly', async () => {
    const mockResponsePage1 = {
      hits: {
        total: 50, // More than PAGE_SIZE (25)
        hits: Array.from({ length: 25 }, (_, i) => ({
          id: `id${i}`,
          metadata: { version: `1.${i}.0` }
        }))
      }
    };

    const mockResponsePage2 = {
      hits: {
        total: 50,
        hits: Array.from({ length: 25 }, (_, i) => ({
          id: `id${i + 25}`,
          metadata: { version: `1.${i + 25}.0` }
        }))
      }
    };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponsePage1
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponsePage2
      });

    const result = await getZenodoVersionInfo('10.5281/zenodo.1234567');

    expect(result).toHaveLength(50);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('should stop after 10 pages to avoid rate limiting', async () => {
    const mockResponse = {
      hits: {
        total: 100000, // Unrealistically high number
        hits: Array.from({ length: 25 }, (_, i) => ({
          id: `id${i}`,
          metadata: { version: `1.${i}.0` }
        }))
      }
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse
    });

    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

    const result = await getZenodoVersionInfo('10.5281/zenodo.1234567');

    expect(global.fetch).toHaveBeenCalledTimes(10);
    expect(consoleWarnSpy).toHaveBeenCalled();
    expect(result.length).toBeGreaterThan(0);

    consoleWarnSpy.mockRestore();
  });
});
