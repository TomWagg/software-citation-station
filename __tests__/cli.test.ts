import { parseFlags } from "../src/cli";

describe("CLI flag parsing", () => {
  it("parses default flags", () => {
    const result = parseFlags(["scipy", "numpy"]);
    expect(result.format).toBe("text");
    expect(result.acknowledgement).toBe(false);
    expect(result.bibtex).toBe(false);
    expect(result.deps).toBe(false);
    expect(result.positional).toEqual(["scipy", "numpy"]);
  });

  it("parses --json flag", () => {
    const result = parseFlags(["scipy", "--json"]);
    expect(result.format).toBe("json");
  });

  it("parses --acknowledgement flag", () => {
    const result = parseFlags(["scipy", "--acknowledgement"]);
    expect(result.acknowledgement).toBe(true);
    expect(result.bibtex).toBe(false);
  });

  it("parses --ack short flag", () => {
    const result = parseFlags(["scipy", "--ack"]);
    expect(result.acknowledgement).toBe(true);
    expect(result.bibtex).toBe(false);
  });

  it("parses --bibtex flag", () => {
    const result = parseFlags(["scipy", "--bibtex"]);
    expect(result.bibtex).toBe(true);
    expect(result.acknowledgement).toBe(false);
  });

  it("parses --deps flag", () => {
    const result = parseFlags(["scipy", "--deps"]);
    expect(result.deps).toBe(true);
  });

  it("parses multiple flags together", () => {
    const result = parseFlags(["scipy", "numpy", "--json", "--deps"]);
    expect(result.format).toBe("json");
    expect(result.deps).toBe(true);
    expect(result.positional).toEqual(["scipy", "numpy"]);
  });

  it("parses version pinning in positional args", () => {
    const result = parseFlags(["scipy==1.10.0", "numpy"]);
    expect(result.positional).toEqual(["scipy==1.10.0", "numpy"]);
  });

  it("ignores unknown flags as positional", () => {
    const result = parseFlags(["scipy", "--unknown"]);
    expect(result.positional).toEqual(["scipy", "--unknown"]);
  });
});
