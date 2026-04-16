import { test, expect } from '@playwright/test';

test.describe('BibTeX Display', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000); // Wait for bibtex.bib to load
  });

  test('should display complete BibTeX entry with syntax highlighting', async ({ page }) => {
    // Click on scipy
    await page.click('[data-key="scipy"]');
    await page.waitForTimeout(1000);
    
    // Get the BibTeX HTML
    const bibtexHTML = await page.locator('#bibtex').innerHTML();
    
    // Should have syntax highlighting spans
    expect(bibtexHTML).toContain('class="bibtex-type"');
    expect(bibtexHTML).toContain('class="bibtex-key"');
    
    // Get text content
    const bibtexText = await page.locator('#bibtex').textContent();
    
    // Check for complete BibTeX structure
    expect(bibtexText).toContain('@');
    expect(bibtexText).toContain('{');
    expect(bibtexText).toContain('}');
  });

  test('should display BibTeX without horizontal overflow', async ({ page }) => {
    // Click on scipy
    await page.click('[data-key="scipy"]');
    await page.waitForTimeout(1000);
    
    const bibtexBox = page.locator('#bibtex');
    const boxWidth = await bibtexBox.evaluate(el => (el as HTMLElement).clientWidth);
    const scrollWidth = await bibtexBox.evaluate(el => (el as HTMLElement).scrollWidth);
    
    // Content should fit without significant horizontal overflow
    expect(scrollWidth).toBeLessThanOrEqual(boxWidth + 2); // 2px tolerance
  });
});
