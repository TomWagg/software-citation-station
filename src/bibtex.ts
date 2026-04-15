const BIBTEX_RE = /@\w*{(?<tag>.*?)(?=,)/gms;

function isolateBibtexEntry(text: string, start: number): string {
  let braces = 0;
  let cursor = start;
  let notOpened = true;

  while (braces > 0 || notOpened) {
    const ch = text[cursor];
    if (ch === "{") {
      braces += 1;
      notOpened = false;
    } else if (ch === "}") {
      braces -= 1;
    }
    cursor += 1;
    if (cursor >= text.length) {
      break;
    }
  }

  return text.slice(start, cursor);
}

export function parseBibtexTable(bibtexText: string): Record<string, string> {
  const table: Record<string, string> = {};
  BIBTEX_RE.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = BIBTEX_RE.exec(bibtexText)) !== null) {
    const tag = match.groups?.tag;
    if (!tag) {
      continue;
    }
    table[tag] = isolateBibtexEntry(bibtexText, match.index);
  }

  return table;
}

export function replaceBibtexTag(entry: string, newTag: string): string {
  const openBrace = entry.indexOf("{");
  const comma = entry.indexOf(",", openBrace + 1);
  if (openBrace === -1 || comma === -1) {
    return entry;
  }
  return `${entry.slice(0, openBrace + 1)}${newTag}${entry.slice(comma)}`;
}
