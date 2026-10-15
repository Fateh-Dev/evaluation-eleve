function splitCsvRow(row: string, delimiter: string): string[] {
  const cells: string[] = [];
  let cell = '';
  let insideQuotes = false;

  for (let index = 0; index < row.length; index += 1) {
    const character = row[index];
    if (character === '"') {
      if (insideQuotes && row[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (character === delimiter && !insideQuotes) {
      cells.push(cell.trim());
      cell = '';
    } else {
      cell += character;
    }
  }
  cells.push(cell.trim());
  return cells;
}

function detectDelimiter(row: string): string {
  const delimiters = [';', ',', '\t'];
  return delimiters.reduce((selected, delimiter) => {
    const count = splitCsvRow(row, delimiter).length;
    return count > splitCsvRow(row, selected).length ? delimiter : selected;
  }, delimiters[0]);
}

function cleanObjective(value: string): string {
  return value
    .replace(/^\uFEFF/, '')
    .trim()
    .replace(/^(?:[-*•▪]\s*|\d+\s*[.)-]\s*)/, '')
    .trim();
}

function normalizeHeader(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .trim();
}

export function parseObjectiveListFile(
  contents: string,
  format: 'txt' | 'csv' = 'txt',
): string[] {
  const rows = contents.replace(/^\uFEFF/, '').split(/\r?\n/);
  const firstNonEmptyIndex = rows.findIndex((row) => row.trim());
  if (firstNonEmptyIndex < 0) return [];

  const delimiter = format === 'csv' ? detectDelimiter(rows[firstNonEmptyIndex]) : '';
  const firstCells = format === 'csv'
    ? splitCsvRow(rows[firstNonEmptyIndex], delimiter)
    : [rows[firstNonEmptyIndex].trim()];
  const headerIndex = firstCells.findIndex((cell) =>
    /^(objectif|objectifs|prerequis|prerequisites|description|critere|criteres|item|items)$/i
      .test(normalizeHeader(cell)),
  );
  const objectiveColumnIndex = headerIndex >= 0 ? headerIndex : 0;
  const items = rows.flatMap((row, index) => {
    if (!row.trim()) return [];
    const cells = (format === 'csv' ? splitCsvRow(row, delimiter) : [row.trim()])
      .filter(Boolean);
    if (!cells.length) return [];
    if (index === firstNonEmptyIndex && headerIndex >= 0) {
      return [];
    }
    const value = headerIndex >= 0
      ? cells[objectiveColumnIndex] ?? ''
      : cells.length > 1 && /^\d+$/.test(cells[0].trim())
        ? cells.slice(1).find(Boolean) ?? ''
        : cells[0];
    const cleaned = cleanObjective(value);
    return cleaned ? [cleaned] : [];
  });

  return items;
}
