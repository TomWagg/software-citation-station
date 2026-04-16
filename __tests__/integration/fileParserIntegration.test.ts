import * as fs from 'fs';
import * as path from 'path';
import {
  parseRequirementsTxt,
  parseCondaEnvYaml,
  parseEnvironmentFile,
  ParsedEnvironment
} from '../../src/shared/fileParser';

/**
 * Integration tests that read actual files from test-data/
 * 
 * These tests verify the complete workflow:
 * 1. Reading files from disk (using fs.readFileSync)
 * 2. Parsing the file content
 * 3. Validating the parsed results match expectations
 * 
 * This ensures the parser works with real files as users would use them,
 * catching any file I/O or encoding issues that unit tests with inline strings might miss.
 */

describe('Integration Tests - parseRequirementsTxt with test-data files', () => {
  it('should parse test-data/requirements.txt file from disk', () => {
    const filePath = path.join(__dirname, '../../test-data/requirements.txt');
    const content = fs.readFileSync(filePath, 'utf-8');
    
    const result = parseRequirementsTxt(content);
    
    expect(result.source).toBe('requirements');
    expect(result.packages).toContain('numpy');
    expect(result.packages).toContain('scipy');
    expect(result.packages).toContain('matplotlib');
    expect(result.packages).toContain('pandas');
    expect(result.packages).toContain('scikit-learn');
    expect(result.packages).toContain('tensorflow');
    expect(result.packages).toContain('astropy');
    expect(result.packages).toContain('h5py');
    expect(result.packages).toContain('requests');
    expect(result.packages).toContain('tqdm');
    expect(result.packages.length).toBe(10);
  });

  it('should handle file with comments correctly', () => {
    const filePath = path.join(__dirname, '../../test-data/requirements.txt');
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // The file starts with comments, verify they're ignored
    const lines = content.split('\n');
    expect(lines[0]).toMatch(/^#/); // First line is a comment
    
    const result = parseRequirementsTxt(content);
    
        // Comments should not appear in parsed packages
    expect(result.packages).not.toContain('#');
    expect(result.packages.length).toBeGreaterThan(0);
  });
});

describe('Integration Tests - parseCondaEnvYaml with test-data files', () => {
  it('should parse test-data/environment.yaml file from disk', () => {
    const filePath = path.join(__dirname, '../../test-data/environment.yaml');
    const content = fs.readFileSync(filePath, 'utf-8');
    
    const result = parseCondaEnvYaml(content);
    
    expect(result.source).toBe('conda');
    expect(result.packages).toContain('numpy');
    expect(result.packages).toContain('scipy');
    expect(result.packages).toContain('matplotlib');
    expect(result.packages).toContain('pandas');
    expect(result.packages).toContain('scikit-learn');
    expect(result.packages).toContain('astropy');
    expect(result.packages).toContain('h5py');
    expect(result.packages).toContain('tensorflow');
    expect(result.packages).toContain('requests');
    expect(result.packages).toContain('tqdm');
    expect(result.packages).toContain('python');
  });

  it('should extract Python version from environment.yaml', () => {
    const filePath = path.join(__dirname, '../../test-data/environment.yaml');
    const content = fs.readFileSync(filePath, 'utf-8');
    
    const result = parseCondaEnvYaml(content);
    
    expect(result.pythonVersion).toBe('3.10');
  });

  it('should handle pip subsection in conda environment', () => {
    const filePath = path.join(__dirname, '../../test-data/environment.yaml');
    const content = fs.readFileSync(filePath, 'utf-8');
    
    const result = parseCondaEnvYaml(content);
    
    // Verify packages from pip subsection are included
    expect(result.packages).toContain('tensorflow');
    expect(result.packages).toContain('requests');
    expect(result.packages).toContain('tqdm');
    
        // Verify conda packages are also included
    expect(result.packages).toContain('numpy');
    expect(result.packages).toContain('scipy');
  });
});

describe('Integration Tests - parseEnvironmentFile with test-data files', () => {
  it('should parse requirements.txt using auto-detection by filename', () => {
    const filePath = path.join(__dirname, '../../test-data/requirements.txt');
    const content = fs.readFileSync(filePath, 'utf-8');
    
    const result = parseEnvironmentFile(content, 'requirements.txt');
    
    expect(result.source).toBe('requirements');
    expect(result.packages.length).toBeGreaterThan(0);
    expect(result.packages).toContain('numpy');
  });

  it('should parse environment.yaml using auto-detection by filename', () => {
    const filePath = path.join(__dirname, '../../test-data/environment.yaml');
    const content = fs.readFileSync(filePath, 'utf-8');
    
    const result = parseEnvironmentFile(content, 'environment.yaml');
    
    expect(result.source).toBe('conda');
    expect(result.packages).toContain('python');
    expect(result.packages).toContain('numpy');
    expect(result.pythonVersion).toBe('3.10');
  });

  it('should parse requirements.yml using auto-detection by filename', () => {
    const filePath = path.join(__dirname, '../../test-data/environment.yaml');
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Test with .yml extension
    const result = parseEnvironmentFile(content, 'environment.yml');
    
    expect(result.source).toBe('conda');
    expect(result.packages).toContain('python');
  });

  it('should auto-detect conda format from content even without filename', () => {
    const filePath = path.join(__dirname, '../../test-data/environment.yaml');
    const content = fs.readFileSync(filePath, 'utf-8');
    
    const result = parseEnvironmentFile(content);
    
        // Should detect conda format from content (contains 'name:' and 'dependencies:')
    expect(result.source).toBe('conda');
    expect(result.packages).toContain('python');
  });
});

describe('Integration Tests - File I/O behavior', () => {
  it('should handle UTF-8 encoding correctly', () => {
    const filePath = path.join(__dirname, '../../test-data/requirements.txt');
    
    // Read with explicit UTF-8 encoding (as the CLI does)
    const content = fs.readFileSync(filePath, 'utf-8');
    
    expect(content).toBeDefined();
    expect(typeof content).toBe('string');
    expect(content.length).toBeGreaterThan(0);
    
    // Should parse without errors
    const result = parseRequirementsTxt(content);
    expect(result.packages.length).toBeGreaterThan(0);
  });

  it('should read file using same pattern as CLI', () => {
    // The CLI reads files like this:
    // content = readFileSync(filename, 'utf-8');
    // Then parses with parseEnvironmentFile(content, filename)
    
    const filePath = path.join(__dirname, '../../test-data/requirements.txt');
    
    // Simulate CLI behavior
    const filename = 'test-data/requirements.txt';
    const content = fs.readFileSync(filePath, 'utf-8');
    const result = parseEnvironmentFile(content, filename);
    
    expect(result.source).toBe('requirements');
    expect(result.packages).toContain('numpy');
  });

  it('should handle conda file using same pattern as CLI', () => {
    const filePath = path.join(__dirname, '../../test-data/environment.yaml');
    
    // Simulate CLI behavior
    const filename = 'test-data/environment.yaml';
    const content = fs.readFileSync(filePath, 'utf-8');
    const result = parseEnvironmentFile(content, filename);
    
        expect(result.source).toBe('conda');
    expect(result.packages).toContain('python');
    expect(result.pythonVersion).toBeDefined();
  });
});

describe('Integration Tests - Validation against test-data expectations', () => {
  it('requirements.txt should contain expected scientific packages', () => {
    const filePath = path.join(__dirname, '../../test-data/requirements.txt');
    const content = fs.readFileSync(filePath, 'utf-8');
    const result = parseRequirementsTxt(content);
    
    // Core scientific Python packages
    expect(result.packages).toContain('numpy');
    expect(result.packages).toContain('scipy');
    expect(result.packages).toContain('matplotlib');
    expect(result.packages).toContain('pandas');
  });

  it('requirements.txt should contain expected ML packages', () => {
    const filePath = path.join(__dirname, '../../test-data/requirements.txt');
    const content = fs.readFileSync(filePath, 'utf-8');
    const result = parseRequirementsTxt(content);
    
    expect(result.packages).toContain('scikit-learn');
    expect(result.packages).toContain('tensorflow');
  });

  it('requirements.txt should contain expected astronomy packages', () => {
    const filePath = path.join(__dirname, '../../test-data/requirements.txt');
    const content = fs.readFileSync(filePath, 'utf-8');
    const result = parseRequirementsTxt(content);
    
    expect(result.packages).toContain('astropy');
  });

  it('environment.yaml should contain all conda packages', () => {
    const filePath = path.join(__dirname, '../../test-data/environment.yaml');
    const content = fs.readFileSync(filePath, 'utf-8');
    const result = parseCondaEnvYaml(content);
    
    // Verify all major package categories are present
    expect(result.packages).toContain('python'); // Base conda package
    expect(result.packages).toContain('numpy'); // Scientific
    expect(result.packages).toContain('scipy'); // Scientific
    expect(result.packages).toContain('scikit-learn'); // ML
    expect(result.packages).toContain('astropy'); // Astronomy
  });

  it('environment.yaml should specify correct Python version', () => {
    const filePath = path.join(__dirname, '../../test-data/environment.yaml');
    const content = fs.readFileSync(filePath, 'utf-8');
    const result = parseCondaEnvYaml(content);
    
        // The file specifies python=3.10
    expect(result.pythonVersion).toBe('3.10');
    expect(result.packages).toContain('python');
  });
});

describe('Integration Tests - Cross-format consistency', () => {
  it('should parse same packages from both files where they overlap', () => {
    // Both files contain numpy and scipy
    const reqsPath = path.join(__dirname, '../../test-data/requirements.txt');
    const envPath = path.join(__dirname, '../../test-data/environment.yaml');
    
    const reqsResult = parseRequirementsTxt(fs.readFileSync(reqsPath, 'utf-8'));
    const envResult = parseCondaEnvYaml(fs.readFileSync(envPath, 'utf-8'));
    
    // Common packages should be in both
    expect(reqsResult.packages).toContain('numpy');
    expect(envResult.packages).toContain('numpy');
    
    expect(reqsResult.packages).toContain('scipy');
    expect(envResult.packages).toContain('scipy');
  });

  it('should identify correct source for each file type', () => {
    const reqsPath = path.join(__dirname, '../../test-data/requirements.txt');
    const envPath = path.join(__dirname, '../../test-data/environment.yaml');
    
    const reqsResult = parseEnvironmentFile(fs.readFileSync(reqsPath, 'utf-8'), 'requirements.txt');
    const envResult = parseEnvironmentFile(fs.readFileSync(envPath, 'utf-8'), 'environment.yaml');
    
    expect(reqsResult.source).toBe('requirements');
    expect(envResult.source).toBe('conda');
  });
});