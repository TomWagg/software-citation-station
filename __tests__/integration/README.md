# Integration Tests

This directory contains integration tests that test the complete workflow by reading actual files from the repository.

## Purpose

Integration tests complement unit tests by:
- Reading real files from disk using Node.js `fs.readFileSync`
- Testing the complete file I/O → parse → validate pipeline
- Catching file encoding, path resolution, and I/O issues
- Validating behavior against real user workflows

## Test Files

### `fileParserIntegration.test.ts`

Integration tests for the file parser that read from `test-data/` directory:

- **Requirements.txt parsing**: Tests with actual `test-data/requirements.txt`
- **Conda environment parsing**: Tests with actual `test-data/environment.yaml`
- **Auto-detection**: Tests filename-based and content-based format detection
- **File I/O behavior**: Tests UTF-8 encoding and CLI-like file reading patterns
- **Validation**: Verifies expected packages are parsed correctly
- **Cross-format consistency**: Ensures overlapping packages parse correctly from both formats

## Running Integration Tests

```bash
# Run only integration tests
npm test -- __tests__/integration

# Run all tests (including integration tests)
npm test
```

## Benefits Over Unit Tests

Unit tests (in `__tests__/shared/fileParser.test.ts`) use inline string literals and are great for:
- Fast execution
- Testing edge cases
- Self-documenting test code

Integration tests add value by:
- Testing actual file I/O (fs.readFileSync)
- Catching encoding issues
- Validating complete user workflows
- Ensuring parsers work with real files as users would use them
