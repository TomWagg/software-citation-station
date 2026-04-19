// @ts-ignore
import { parseBibtex, collectDependencies, parsePackageInput, generateAcknowledgment, generateBibtex } from '../js/citationCore.js';

describe('citationCore', () => {
  describe('parseBibtex', () => {
    it('should parse simple bibtex', () => {
      const bibtex = '@article{numpy, author={Harris et al.}}';
      const parsed = parseBibtex(bibtex);
      expect(parsed['numpy']).toBeDefined();
      expect(parsed['numpy']).toContain('author={Harris et al.}');
    });

    it('should parse multiple entries', () => {
      const bibtex = '@article{a, title={A}}\n@software{b, title={B}}';
      const parsed = parseBibtex(bibtex);
      expect(Object.keys(parsed)).toHaveLength(2);
      expect(parsed['a']).toContain('title={A}');
      expect(parsed['b']).toContain('title={B}');
    });
  });

  describe('collectDependencies', () => {
    const citationsData = {
      'A': { dependencies: ['B', 'C'] },
      'B': { dependencies: ['D'] },
      'C': { dependencies: [] },
      'D': { dependencies: [] }
    };

    it('should recursively collect dependencies', () => {
      const depSet = new Set<string>();
      collectDependencies(depSet, 'A', citationsData);
      expect(depSet.has('B')).toBe(true);
      expect(depSet.has('C')).toBe(true);
      expect(depSet.has('D')).toBe(true);
      expect(depSet.size).toBe(3);
    });
  });

  describe('parsePackageInput', () => {
    it('should parse simple package name', () => {
      expect(parsePackageInput('numpy')).toEqual({ name: 'numpy', version: undefined, features: undefined });
    });

    it('should parse package with version', () => {
      expect(parsePackageInput('numpy==1.2.3')).toEqual({ name: 'numpy', version: '1.2.3', features: undefined });
    });

    it('should parse package with features', () => {
      expect(parsePackageInput('astropy[fitting,io]')).toEqual({ name: 'astropy', version: undefined, features: ['fitting', 'io'] });
    });

    it('should parse package with version and features', () => {
      expect(parsePackageInput('astropy==6.0.1[fitting]')).toEqual({ name: 'astropy', version: '6.0.1', features: ['fitting'] });
    });
  });

  describe('generateAcknowledgment', () => {
    const citationsData = {
      'numpy': { tags: ['numpy:2020'], custom_citation: '' },
      'astropy': { tags: ['astropy:2013'], custom_citation: 'Custom ack.' }
    };

    it('should generate simple acknowledgment', () => {
      const ack = generateAcknowledgment(['numpy'], citationsData);
      expect(ack).toContain('\\texttt{numpy}');
      expect(ack).toContain('\\citep{numpy:2020}');
    });

    it('should handle custom citations', () => {
      const ack = generateAcknowledgment(['astropy'], citationsData);
      expect(ack).toContain('Custom ack.');
    });
  });
});
