/**
 * Unit tests for fetchVersions.ts
 */

import * as fs from 'fs';
import { fetchAllVersions } from '../src/fetchVersions';
import { getZenodoVersionInfo } from '../src/zenodoVersions';

jest.mock('fs');
jest.mock('../src/zenodoVersions');

describe('fetchAllVersions', () => {
  let mockMkdirSync: jest.Mock;
  let mockExistsSync: jest.Mock;
  let mockWriteFileSync: jest.Mock;
  let mockReadFileSync: jest.Mock;
  let mockConsoleLog: jest.SpyInstance;
  let mockConsoleError: jest.SpyInstance;

  const mockCitations = {
    package1: { zenodo_doi: '10.5281/zenodo.123', name: 'Package 1' },
    package2: { zenodo_doi: '10.5281/zenodo.456', name: 'Package 2' },
    package3: { zenodo_doi: '', name: 'Package 3' },
    package4: { name: 'Package 4' } // no zenodo_doi key
  };

  beforeEach(() => {
    mockMkdirSync = fs.mkdirSync as jest.Mock;
    mockExistsSync = fs.existsSync as jest.Mock;
    mockWriteFileSync = fs.writeFileSync as jest.Mock;
    mockReadFileSync = fs.readFileSync as jest.Mock;
    
    mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
    mockConsoleError = jest.spyOn(console, 'error').mockImplementation();
    
    mockExistsSync.mockReturnValue(false);
    mockMkdirSync.mockImplementation();
    mockWriteFileSync.mockImplementation();
    mockReadFileSync.mockReturnValue(JSON.stringify(mockCitations));
    
    (getZenodoVersionInfo as jest.Mock).mockResolvedValue([
      { version: '1.0.0', doi: '10.5281/zenodo.123' }
    ]);
  });

  afterEach(() => {
    jest.clearAllMocks();
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
  });

  it('should create output directory if it does not exist', async () => {
    await fetchAllVersions();
    
    expect(fs.mkdirSync).toHaveBeenCalledWith(
      expect.stringContaining('zenodo-versions'),
      { recursive: true }
    );
  });

  it('should skip packages without Zenodo DOI', async () => {
    const result = await fetchAllVersions();
    
    expect(result.skipped).toBe(2); // package3 and package4
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Skipped'));
  });

  it('should process packages with Zenodo DOI', async () => {
    const result = await fetchAllVersions();
    
    expect(result.processed).toBe(2); // package1 and package2
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Fetching versions for package1')
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Fetching versions for package2')
    );
  });

  it('should handle errors gracefully without throwing', async () => {
    (getZenodoVersionInfo as jest.Mock).mockImplementation(async (doi: string) => {
      if (doi.includes('123')) {
        throw new Error('Network error');
      }
      return [{ version: '1.0.0', doi }];
    });
    
    const result = await fetchAllVersions();
    
    expect(result.failed).toBe(1);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('package1'),
      expect.any(Error)
    );
  });

  it('should write version data to output files', async () => {
    const mockVersions = [
      { version: '1.0.0', doi: '10.5281/zenodo.123' },
      { version: '1.1.0', doi: '10.5281/zenodo.456' }
    ];
    (getZenodoVersionInfo as jest.Mock).mockResolvedValue(mockVersions);
    
    await fetchAllVersions();
    
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('package1.json'),
      expect.stringContaining('1.0.0'),
      'utf-8'
    );
  });

  it('should log summary at the end', async () => {
    await fetchAllVersions();
    
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Summary:'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Processed:'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Skipped'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Failed:'));
  });

  it('should log total packages found', async () => {
    await fetchAllVersions();
    
    expect(console.log).toHaveBeenCalledWith('Found 4 packages to process');
  });

  it('should save correct number of versions per package', async () => {
    await fetchAllVersions();
    
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Saved 1 versions for package1')
    );
  });
});
