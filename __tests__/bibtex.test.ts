/**
 * Unit tests for bibtex.ts
 */

import { parseBibtexTable, replaceBibtexTag } from '../src/bibtex';

describe('parseBibtexTable', () => {
  it('should parse simple BibTeX entry', () => {
    const bibtex = `@article{test2020,
  title = {Test Article},
  author = {Test Author},
  year = {2020}
}`;

    const result = parseBibtexTable(bibtex);
    
    expect(result).toHaveProperty('test2020');
    expect(result.test2020).toContain('title = {Test Article}');
  });

  it('should parse multiple BibTeX entries', () => {
    const bibtex = `@article{article1,
  title = {First Article}
}

@book{book1,
  title = {First Book}
}`;

    const result = parseBibtexTable(bibtex);
    
    expect(Object.keys(result)).toHaveLength(2);
    expect(result).toHaveProperty('article1');
    expect(result).toHaveProperty('book1');
  });

  it('should handle empty BibTeX', () => {
    const result = parseBibtexTable('');
    expect(result).toEqual({});
  });

  it('should handle BibTeX with nested braces', () => {
    const bibtex = `@article{test,
  title = {A {Nested} Title},
  author = {{Last Name, First Name}}
}`;

    const result = parseBibtexTable(bibtex);
    
    expect(result).toHaveProperty('test');
    expect(result.test).toContain('A {Nested} Title');
  });

  it('should skip entries without valid tags', () => {
    const bibtex = `@article{,
  title = {No Tag}
}`;

    const result = parseBibtexTable(bibtex);
    
    expect(result).toEqual({});
  });

  it('should handle BibTeX with comments', () => {
    const bibtex = `@article{test,
  title = {Test},
  note = {This is a comment}
}`;

    const result = parseBibtexTable(bibtex);
    
    expect(result.test).toContain('note = {This is a comment}');
  });
});

describe('replaceBibtexTag', () => {
  it('should replace BibTeX tag', () => {
    const entry = '@article{oldTag,\n  title = {Test}}';
    const result = replaceBibtexTag(entry, 'newTag');
    
    expect(result).toBe('@article{newTag,\n  title = {Test}}');
  });

  it('should handle entry with spaces', () => {
    const entry = '@article{ oldTag ,\n  title = {Test}}';
    const result = replaceBibtexTag(entry, 'newTag');
    
    expect(result).toContain('newTag');
  });

  it('should return original if no open brace', () => {
    const entry = '@article oldTag';
    const result = replaceBibtexTag(entry, 'newTag');
    
    expect(result).toBe(entry);
  });

  it('should return original if no comma', () => {
    const entry = '@article{oldTag}';
    const result = replaceBibtexTag(entry, 'newTag');
    
    expect(result).toBe(entry);
  });

  it('should handle software entry type', () => {
    const entry = `@software{scipy,
  author = {SciPy Developers},
  title = {SciPy 1.0}
}`;
    const result = replaceBibtexTag(entry, 'scipy_2020');
    
    expect(result).toContain('@software{scipy_2020,');
  });
});
