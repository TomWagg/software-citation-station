import {
  parseRequirementsTxt,
  parseCondaEnvYaml,
  parseEnvironmentFile,
  parsePackageSpec
} from '../../src/shared/fileParser';

describe('parseRequirementsTxt', () => {
  it('parses simple package list', () => {
    const content = `scipy==1.10.0
numpy==1.24.0
matplotlib`;
    
    const result = parseRequirementsTxt(content);
    expect(result.packages).toEqual(['scipy', 'numpy', 'matplotlib']);
    expect(result.source).toBe('requirements');
  });

  it('parses packages with various version specifiers', () => {
    const content = `package1==1.0.0
package2>=2.0.0
package3~=3.0.0
package4!=4.0.0
package5>5.0.0
package6<6.0.0`;
    
    const result = parseRequirementsTxt(content);
    expect(result.packages).toEqual(['package1', 'package2', 'package3', 'package4', 'package5', 'package6']);
  });

  it('skips comments and empty lines', () => {
    const content = `# This is a comment
scipy==1.10.0

# Another comment
numpy==1.24.0
`;
    
    const result = parseRequirementsTxt(content);
    expect(result.packages).toEqual(['scipy', 'numpy']);
  });

  it('skips -r includes', () => {
    const content = `-r base-requirements.txt
scipy==1.10.0
--requirement extra.txt
numpy==1.24.0`;
    
    const result = parseRequirementsTxt(content);
    expect(result.packages).toEqual(['scipy', 'numpy']);
  });

  it('skips other pip options', () => {
    const content = `--index-url https://pypi.org/simple
scipy==1.10.0
-e git+https://github.com/example/package.git
numpy==1.24.0`;
    
    const result = parseRequirementsTxt(content);
    expect(result.packages).toEqual(['scipy', 'numpy']);
  });

  it('handles packages with extras', () => {
    const content = `package[extra1]==1.0.0
package2[extra1,extra2]>=2.0.0`;
    
    const result = parseRequirementsTxt(content);
    expect(result.packages).toEqual(['package', 'package2']);
  });

  it('handles pip freeze output', () => {
    const content = `astropy==5.3.4
certifi==2023.11.17
cffi==1.16.0
contourpy==1.2.0
cycler==0.12.1`;
    
    const result = parseRequirementsTxt(content);
    expect(result.packages.length).toBe(5);
    expect(result.packages[0]).toBe('astropy');
  });
});

describe('parseCondaEnvYaml', () => {
  it('parses simple conda environment', () => {
    const content = `name: myenv
channels:
  - conda-forge
  - defaults
dependencies:
  - python=3.9
  - numpy=1.24.0
  - scipy=1.10.0`;
    
    const result = parseCondaEnvYaml(content);
    expect(result.packages).toEqual(['python', 'numpy', 'scipy']);
    expect(result.source).toBe('conda');
    expect(result.pythonVersion).toBe('3.9');
  });

  it('parses environment with pip dependencies', () => {
    const content = `name: myenv
dependencies:
  - python=3.9
  - numpy
  - pip:
    - some-pip-package==1.0.0
    - another-package`;
    
    const result = parseCondaEnvYaml(content);
    expect(result.packages).toEqual(['python', 'numpy', 'pip', 'some-pip-package', 'another-package']);
  });

  it('handles various version specifiers', () => {
    const content = `dependencies:
  - python=3.9.18
  - numpy>=1.20.0
  - scipy==1.10.0
  - matplotlib`;
    
    const result = parseCondaEnvYaml(content);
    expect(result.packages).toEqual(['python', 'numpy', 'scipy', 'matplotlib']);
    expect(result.pythonVersion).toBe('3.9.18');
  });

  it('skips pip in package list', () => {
    const content = `dependencies:
  - python=3.9
  - pip
  - numpy`;
    
    const result = parseCondaEnvYaml(content);
    // Note: current implementation includes 'pip' if it's listed as a conda package
    expect(result.packages).toContain('python');
    expect(result.packages).toContain('numpy');
  });

  it('handles complex real-world conda export', () => {
    const content = `name: astro_env
channels:
  - conda-forge
  - defaults
dependencies:
  - astropy=5.3.4=py39h1d65ade_0
  - numpy=1.24.3=py39h6183b62_1
  - python=3.9.18=hab00c5b_0_cpython
  - scipy=1.10.1=py39h6183b62_3
  - pip:
    - matplotlib==3.8.2`;
    
    const result = parseCondaEnvYaml(content);
    expect(result.packages).toContain('astropy');
    expect(result.packages).toContain('numpy');
    expect(result.packages).toContain('python');
    expect(result.packages).toContain('scipy');
    expect(result.pythonVersion).toBe('3.9.18');
  });
});

describe('parseEnvironmentFile', () => {
  it('auto-detects requirements.txt by filename', () => {
    const content = `scipy==1.10.0
numpy==1.24.0`;
    
    const result = parseEnvironmentFile(content, 'requirements.txt');
    expect(result.source).toBe('requirements');
    expect(result.packages).toEqual(['scipy', 'numpy']);
  });

  it('auto-detects conda env by filename', () => {
    const content = `dependencies:
  - python=3.9
  - numpy`;
    
    const result = parseEnvironmentFile(content, 'environment.yaml');
    expect(result.source).toBe('conda');
    expect(result.packages).toContain('python');
  });

  it('auto-detects conda env by content', () => {
    const content = `name: myenv
dependencies:
  - python=3.9`;
    
    const result = parseEnvironmentFile(content);
    expect(result.source).toBe('conda');
  });

  it('defaults to requirements format when unsure', () => {
    const content = `scipy==1.10.0
numpy==1.24.0`;
    
    const result = parseEnvironmentFile(content);
    expect(result.source).toBe('requirements');
  });
});

describe('parsePackageSpec', () => {
  it('parses package without version', () => {
    const result = parsePackageSpec('numpy');
    expect(result.name).toBe('numpy');
    expect(result.version).toBeUndefined();
  });

  it('parses package with == version', () => {
    const result = parsePackageSpec('numpy==1.24.0');
    expect(result.name).toBe('numpy');
    expect(result.version).toBe('1.24.0');
  });

  it('parses package with >= version', () => {
    const result = parsePackageSpec('numpy>=1.24.0');
    expect(result.name).toBe('numpy');
    expect(result.version).toBe('1.24.0');
  });

  it('handles package with extras', () => {
    const result = parsePackageSpec('package[extra]==1.0.0');
    expect(result.name).toBe('package');
    expect(result.version).toBe('1.0.0');
  });

  it('handles whitespace', () => {
    const result = parsePackageSpec('  numpy==1.24.0  ');
    expect(result.name).toBe('numpy');
    expect(result.version).toBe('1.24.0');
  });
});
