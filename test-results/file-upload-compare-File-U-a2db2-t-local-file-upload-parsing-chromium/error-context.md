# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: file-upload-compare.test.ts >> File Upload - Production vs Deployed >> test local file upload parsing
- Location: __tests__/e2e/file-upload-compare.test.ts:102:7

# Error details

```
TimeoutError: page.waitForSelector: Timeout 10000ms exceeded.
Call log:
  - waiting for locator('#software-loading.hide') to be visible

```

# Test source

```ts
  4   | import path from 'path';
  5   | 
  6   | const PORT = 3456;
  7   | const BASE_DIR = path.join(__dirname, '..');
  8   | 
  9   | // Simple static file server
  10  | function createServer(): http.Server {
  11  |   return http.createServer((req, res) => {
  12  |     let filePath = path.join(BASE_DIR, req.url || '/');
  13  |     
  14  |     // Default to index.html
  15  |     if (req.url === '/') {
  16  |       filePath = path.join(BASE_DIR, 'index.html');
  17  |     }
  18  |     
  19  |     const ext = path.extname(filePath);
  20  |     const contentTypes: Record<string, string> = {
  21  |       '.html': 'text/html',
  22  |       '.js': 'application/javascript',
  23  |       '.css': 'text/css',
  24  |       '.json': 'application/json',
  25  |       '.png': 'image/png',
  26  |       '.svg': 'image/svg+xml',
  27  |       '.webp': 'image/webp',
  28  |     };
  29  |     
  30  |     fs.readFile(filePath, (err, data) => {
  31  |       if (err) {
  32  |         res.writeHead(404);
  33  |         res.end('Not found');
  34  |         return;
  35  |       }
  36  |       res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'text/plain' });
  37  |       res.end(data);
  38  |     });
  39  |   });
  40  | }
  41  | 
  42  | test.describe('File Upload - Production vs Deployed', () => {
  43  |   let server: http.Server;
  44  |   let localUrl: string;
  45  |   
  46  |   const productionUrl = 'https://www.tomwagg.com/software-citation-station/';
  47  |   const deployedUrl = 'https://zonca.github.io/software-citation-station/';
  48  |   const testFilePath = path.join(BASE_DIR, '..', 'test-data', 'requirements.txt');
  49  | 
  50  |   test.beforeAll(async () => {
  51  |     server = createServer();
  52  |     await new Promise<void>((resolve) => {
  53  |       server.listen(PORT, () => {
  54  |         console.log(`Test server running at http://localhost:${PORT}`);
  55  |         resolve();
  56  |       });
  57  |     });
  58  |     localUrl = `http://localhost:${PORT}`;
  59  |   });
  60  | 
  61  |   test.afterAll(async () => {
  62  |     await new Promise<void>((resolve) => {
  63  |       server.close(() => resolve());
  64  |     });
  65  |   });
  66  | 
  67  |   test('compare file upload on production vs deployed', async ({ page }) => {
  68  |     // Test production site
  69  |     await page.goto(productionUrl);
  70  |     await page.waitForSelector('#software-loading.hide', { timeout: 10000 });
  71  |     
  72  |     // Upload file on production
  73  |     const prodFileInput = page.locator('#file-upload');
  74  |     await prodFileInput.setInputFiles(testFilePath);
  75  |     await page.waitForTimeout(2000);
  76  |     
  77  |     // Count selected packages on production
  78  |     const prodSelected = await page.locator('.software-button.active').count();
  79  |     console.log(`Production: ${prodSelected} packages selected`);
  80  |     
  81  |     // Clear selections
  82  |     await page.locator('#software-clear').click();
  83  |     await page.waitForTimeout(500);
  84  |     
  85  |     // Test deployed site
  86  |     await page.goto(deployedUrl);
  87  |     await page.waitForSelector('#software-loading.hide', { timeout: 10000 });
  88  |     
  89  |     // Upload file on deployed
  90  |     const deployedFileInput = page.locator('#file-upload');
  91  |     await deployedFileInput.setInputFiles(testFilePath);
  92  |     await page.waitForTimeout(2000);
  93  |     
  94  |     // Count selected packages on deployed
  95  |     const deployedSelected = await page.locator('.software-button.active').count();
  96  |     console.log(`Deployed: ${deployedSelected} packages selected`);
  97  |     
  98  |     // They should match
  99  |     expect(deployedSelected).toBe(prodSelected);
  100 |   });
  101 | 
  102 |   test('test local file upload parsing', async ({ page }) => {
  103 |     await page.goto(localUrl);
> 104 |     await page.waitForSelector('#software-loading.hide', { timeout: 10000 });
      |                ^ TimeoutError: page.waitForSelector: Timeout 10000ms exceeded.
  105 |     
  106 |     const fileInput = page.locator('#file-upload');
  107 |     await fileInput.setInputFiles(testFilePath);
  108 |     await page.waitForTimeout(2000);
  109 |     
  110 |     // Count selected packages
  111 |     const selected = await page.locator('.software-button.active').count();
  112 |     console.log(`Local: ${selected} packages selected`);
  113 |     
  114 |     // Should have selected at least some packages
  115 |     expect(selected).toBeGreaterThan(0);
  116 |   });
  117 | });
  118 | 
```