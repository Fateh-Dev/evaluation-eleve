import { Paths } from 'expo-file-system';
import * as LegacyFS from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Alert, Platform } from 'react-native';
import JSZip from 'jszip';

export type AssessmentExportData = {
  school: {
    name: string;
    address: string;
    wilaya: string;
  };
  teacherName?: string;
  level: string;
  className: string;
  academicYear?: string;
  assessment: {
    id: string;
    title: string;
    date: string;
    subject: string;
    competency: string;
    support: string;
    sessionObjectives: string;
  };
  objectives: Array<{
    id: string;
    order: number;
    description: string;
  }>;
  pupils: Array<{
    id: string;
    registrationNumber: string;
    firstName: string;
    lastName: string;
  }>;
  evaluations: Record<string, Record<string, string>>;
  individualRemediation: string;
  classRemediation: string;
};

// Colors matching the official reference format
const COLOR_PRIMARY_HEX = '1F4E78'; // Deep Slate Blue
const COLOR_HEADER_BG = 'D9E1F2'; // Soft lavender blue for top headers
const COLOR_SUBHEADER_BG = 'E9EEF4'; // Light header tint
const COLOR_TR_ALT_BG = 'F8FAFC'; // Very soft zebra row
const COLOR_BORDER = '7F7F7F'; // Crisp border gray

/**
 * Generates a CSV file matching the assessment grid format.
 * Uses UTF-8 BOM so Excel on Windows correctly interprets accented characters.
 */
export function generateAssessmentCsv(data: AssessmentExportData): Uint8Array {
  const rows: string[][] = [];

  // Header metadata
  rows.push([
    `Établissement : ${data.school.name || ''}`,
    `Niveau : ${data.level || ''}`,
    `Enseignant(e) : ${data.teacherName || ''}`,
  ]);
  rows.push([
    `Compétence : ${data.assessment.competency || ''}`,
    `Objectif de la séance : ${data.assessment.sessionObjectives || ''}`,
    `Support : ${data.assessment.support || ''}`,
  ]);
  rows.push([`Objectifs d'évaluation (${data.objectives.length} Objectifs) :`]);
  data.objectives.forEach((obj, idx) => {
    const num = String(obj.order || idx + 1).padStart(2, '0');
    rows.push([`${num}. ${obj.description}`]);
  });
  rows.push([]); // spacer

  // â”€â”€ Grid title â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  rows.push([`Grille d'analyse des résultats — Classe : ${data.className || ''}`]);

  // â”€â”€ Table header row 1 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const objHeaders: string[] = [];
  data.objectives.forEach((obj, idx) => {
    const num = String(obj.order || idx + 1).padStart(2, '0');
    objHeaders.push(`Obj ${num} (+)`, `Obj ${num} (±)`, `Obj ${num} (-)`);
  });
  rows.push(['N°', 'Nom et Prénom', ...objHeaders, 'Total (+)', 'Total (±)', 'Total (-)']);

  // â”€â”€ Pupil data rows â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const objectiveTotals = data.objectives.map(() => ({ plus: 0, pm: 0, minus: 0 }));
  let grandPlus = 0;
  let grandPm = 0;
  let grandMinus = 0;

  data.pupils.forEach((pupil, pIdx) => {
    const regNo = pupil.registrationNumber || String(pIdx + 1).padStart(2, '0');
    const fullName = `${pupil.lastName || ''} ${pupil.firstName || ''}`.trim();
    let pPlus = 0;
    let pPm = 0;
    let pMinus = 0;

    const evalCells: string[] = [];
    data.objectives.forEach((obj, oIdx) => {
      const val = data.evaluations[pupil.id]?.[obj.id] ?? 'NotEvaluated';
      if (val === 'Acquired') {
        evalCells.push('+', '', '');
        pPlus++;
        objectiveTotals[oIdx].plus++;
      } else if (val === 'PartiallyAcquired') {
        evalCells.push('', '±', '');
        pPm++;
        objectiveTotals[oIdx].pm++;
      } else if (val === 'NotAcquired') {
        evalCells.push('', '', '-');
        pMinus++;
        objectiveTotals[oIdx].minus++;
      } else {
        evalCells.push('', '', '');
      }
    });

    grandPlus += pPlus;
    grandPm += pPm;
    grandMinus += pMinus;

    rows.push([regNo, fullName, ...evalCells, String(pPlus), String(pPm), String(pMinus)]);
  });

  // â”€â”€ Bottom total row â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const totalCells: string[] = [];
  objectiveTotals.forEach((t) => {
    totalCells.push(String(t.plus), String(t.pm), String(t.minus));
  });
  rows.push(['Total', '', ...totalCells, String(grandPlus), String(grandPm), String(grandMinus)]);

  rows.push([]); // spacer

  // â”€â”€ Remediation decisions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  rows.push(['Décisions à prendre :']);
  rows.push(['A) Au plan individuel :']);
  (data.individualRemediation || 'Aucune décision saisie.').split('\n').filter(Boolean).forEach((line) => {
    rows.push([`   ${line.startsWith('•') || line.startsWith('-') ? line : `• ${line}`}`]);
  });
  rows.push(['B) Au plan de la classe :']);
  (data.classRemediation || 'Aucune décision saisie.').split('\n').filter(Boolean).forEach((line) => {
    rows.push([`   ${line.startsWith('•') || line.startsWith('-') ? line : `• ${line}`}`]);
  });

  // â”€â”€ Encode to CSV bytes with UTF-8 BOM â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const csvString = rows
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','),
    )
    .join('\r\n');

  // UTF-8 BOM so Excel on Windows auto-detects encoding
  const bom = '\uFEFF';
  const encoded = new TextEncoder().encode(bom + csvString);
  return encoded;
}

/**
 * Generates a ready-to-use Excel workbook with the assessment report and grid.
 */
export async function generateAssessmentWorkbook(data: AssessmentExportData): Promise<Uint8Array> {
  type Cell = { value: string | number; style?: number } | null;
  const zip = new JSZip();
  const rows: Cell[][] = [];
  const merges: string[] = [];
  const columnCount = Math.max(8, 5 + data.objectives.length * 3);
  const lastColumn = excelColumn(columnCount - 1);
  const mergedLine = (value: string, style: number) => {
    const row = rows.length + 1;
    rows.push([{ value, style }]);
    merges.push(`A${row}:${lastColumn}${row}`);
  };
  const xmlEscape = (value: string) => value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  })[char] ?? char);

  mergedLine(`GRILLE D’ÉVALUATION — ${data.className || 'Classe'}`, 1);
  mergedLine(`Établissement : ${data.school.name || '—'}${data.school.wilaya ? ` · ${data.school.wilaya}` : ''}${data.school.address ? ` · ${data.school.address}` : ''}`, 2);
  mergedLine(`Niveau : ${data.level || '—'}   |   Classe : ${data.className || '—'}   |   Année scolaire : ${data.academicYear || '—'}   |   Enseignant(e) : ${data.teacherName || '—'}`, 2);
  mergedLine(`Matière : ${data.assessment.subject || '—'}   |   Compétence : ${data.assessment.competency || '—'}`, 2);
  mergedLine(`Évaluation : ${data.assessment.title || '—'}   |   Date : ${data.assessment.date || '—'}`, 2);
  mergedLine(`Objectif de la séance : ${data.assessment.sessionObjectives || '—'}`, 2);
  mergedLine(`Support : ${data.assessment.support || '—'}`, 2);
  rows.push([]);

  mergedLine(`OBJECTIFS D’ÉVALUATION (${data.objectives.length})`, 3);
  data.objectives.forEach((objective, index) => {
    mergedLine(`${String(objective.order || index + 1).padStart(2, '0')}. ${objective.description}`, 4);
  });
  rows.push([]);
  mergedLine(`GRILLE D’ANALYSE DES RÉSULTATS — ${data.className || 'Classe'}`, 3);

  const headerRowNumber = rows.length + 1;
  const groupedHeader: Cell[] = [
    { value: 'N°', style: 5 },
    { value: 'Nom et prénom', style: 5 },
  ];
  data.objectives.forEach((objective, index) => {
    const firstColumn = groupedHeader.length;
    groupedHeader.push({
      value: `Objectif ${String(objective.order || index + 1).padStart(2, '0')}`,
      style: 5,
    }, null, null);
    merges.push(`${excelColumn(firstColumn)}${headerRowNumber}:${excelColumn(firstColumn + 2)}${headerRowNumber}`);
  });
  const totalColumn = groupedHeader.length;
  groupedHeader.push({ value: 'Totaux', style: 5 }, null, null);
  merges.push(`${excelColumn(totalColumn)}${headerRowNumber}:${excelColumn(totalColumn + 2)}${headerRowNumber}`);
  rows.push(groupedHeader);

  const subHeader: Cell[] = [null, null];
  data.objectives.forEach(() => {
    subHeader.push(
      { value: '+', style: 6 },
      { value: '±', style: 6 },
      { value: '−', style: 6 },
    );
  });
  subHeader.push(
    { value: '+', style: 6 },
    { value: '±', style: 6 },
    { value: '−', style: 6 },
  );
  rows.push(subHeader);
  merges.push(`A${headerRowNumber}:A${headerRowNumber + 1}`, `B${headerRowNumber}:B${headerRowNumber + 1}`);
  const pupilFirstRow = rows.length + 1;

  const objectiveTotals = data.objectives.map(() => ({ plus: 0, partial: 0, minus: 0 }));
  let grandPlus = 0;
  let grandPartial = 0;
  let grandMinus = 0;
  data.pupils.forEach((pupil, pupilIndex) => {
    let pupilPlus = 0;
    let pupilPartial = 0;
    let pupilMinus = 0;
    const pupilRow: Cell[] = [
      { value: pupil.registrationNumber || String(pupilIndex + 1).padStart(2, '0'), style: 7 },
      { value: `${pupil.lastName || ''} ${pupil.firstName || ''}`.trim(), style: 8 },
    ];
    data.objectives.forEach((objective, objectiveIndex) => {
      const evaluation = data.evaluations[pupil.id]?.[objective.id];
      const acquired = evaluation === 'Acquired';
      const partial = evaluation === 'PartiallyAcquired';
      const notAcquired = evaluation === 'NotAcquired';
      pupilRow.push(
        { value: acquired ? '+' : '', style: acquired ? 9 : 7 },
        { value: partial ? '±' : '', style: partial ? 10 : 7 },
        { value: notAcquired ? '−' : '', style: notAcquired ? 11 : 7 },
      );
      if (acquired) { pupilPlus++; objectiveTotals[objectiveIndex].plus++; }
      if (partial) { pupilPartial++; objectiveTotals[objectiveIndex].partial++; }
      if (notAcquired) { pupilMinus++; objectiveTotals[objectiveIndex].minus++; }
    });
    grandPlus += pupilPlus;
    grandPartial += pupilPartial;
    grandMinus += pupilMinus;
    pupilRow.push(
      { value: pupilPlus, style: 12 },
      { value: pupilPartial, style: 12 },
      { value: pupilMinus, style: 12 },
    );
    rows.push(pupilRow);
  });

  const totalRowNumber = rows.length + 1;
  const totalRow: Cell[] = [{ value: 'TOTAL CLASSE', style: 13 }, null];
  merges.push(`A${totalRowNumber}:B${totalRowNumber}`);
  objectiveTotals.forEach((total) => totalRow.push(
    { value: total.plus, style: 13 },
    { value: total.partial, style: 13 },
    { value: total.minus, style: 13 },
  ));
  totalRow.push(
    { value: grandPlus, style: 13 },
    { value: grandPartial, style: 13 },
    { value: grandMinus, style: 13 },
  );
  rows.push(totalRow);
  rows.push([]);

  mergedLine('DÉCISIONS ET REMÉDIATIONS', 3);
  const addDecision = (heading: string, content: string) => {
    mergedLine(heading, 3);
    const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (lines.length === 0) {
      mergedLine('Aucune décision saisie.', 14);
      return;
    }
    lines.forEach((line) => mergedLine(`• ${line.replace(/^[•\-]\s*/, '')}`, 14));
  };
  addDecision('A) AU PLAN INDIVIDUEL', data.individualRemediation || '');
  addDecision('B) AU PLAN DE LA CLASSE', data.classRemediation || '');

  const rowXml = rows.map((row, rowIndex) => {
    const rowNumber = rowIndex + 1;
    const cellXml = row.map((cell, columnIndex) => {
      if (!cell) return '';
      const reference = `${excelColumn(columnIndex)}${rowNumber}`;
      if (typeof cell.value === 'number') {
        return `<c r="${reference}" s="${cell.style ?? 0}"><v>${cell.value}</v></c>`;
      }
      return `<c r="${reference}" s="${cell.style ?? 0}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(cell.value)}</t></is></c>`;
    }).join('');
    const height = rowIndex === 0 ? ' ht="30" customHeight="1"' : '';
    return `<row r="${rowNumber}"${height}>${cellXml}</row>`;
  }).join('');
  const columns = [
    '<col min="1" max="1" width="7" customWidth="1"/>',
    '<col min="2" max="2" width="30" customWidth="1"/>',
    data.objectives.length
      ? `<col min="3" max="${2 + data.objectives.length * 3}" width="6" customWidth="1"/>`
      : '',
    `<col min="${3 + data.objectives.length * 3}" max="${5 + data.objectives.length * 3}" width="8" customWidth="1"/>`,
  ].join('');
  const mergeXml = `<mergeCells count="${merges.length}">${merges.map((merge) => `<mergeCell ref="${merge}"/>`).join('')}</mergeCells>`;
  const worksheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="${pupilFirstRow - 1}" topLeftCell="A${pupilFirstRow}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="21"/><cols>${columns}</cols><sheetData>${rowXml}</sheetData>${mergeXml}
<pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.2" footer="0.2"/>
<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/>
</worksheet>`;
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="4">
<font><sz val="10"/><name val="Arial"/></font>
<font><b/><color rgb="FFFFFFFF"/><sz val="16"/><name val="Arial"/></font>
<font><b/><color rgb="FF1F4E78"/><sz val="10"/><name val="Arial"/></font>
<font><b/><color rgb="FFFFFFFF"/><sz val="10"/><name val="Arial"/></font>
</fonts>
<fills count="8">
<fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF1F4E78"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFD9E1F2"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFE9EEF4"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFE8F5E9"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFFF3CD"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFDE8E7"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>
<border><left style="thin"><color rgb="FF9AA9B8"/></left><right style="thin"><color rgb="FF9AA9B8"/></right><top style="thin"><color rgb="FF9AA9B8"/></top><bottom style="thin"><color rgb="FF9AA9B8"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="15">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center"/></xf>
<xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1" indent="1"/></xf>
<xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center" horizontal="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="2" fillId="4" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center" horizontal="center"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center" horizontal="center"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center" horizontal="left" indent="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center" horizontal="center"/></xf>
<xf numFmtId="0" fontId="0" fillId="6" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center" horizontal="center"/></xf>
<xf numFmtId="0" fontId="0" fillId="7" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center" horizontal="center"/></xf>
<xf numFmtId="0" fontId="2" fillId="4" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center" horizontal="center"/></xf>
<xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center" horizontal="center"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1" indent="1"/></xf>
</cellXfs></styleSheet>`;

  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`);
  zip.folder('_rels')?.file('.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`);
  zip.folder('xl')?.file('workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="Grille d’évaluation" sheetId="1" r:id="rId1"/></sheets></workbook>`);
  zip.folder('xl')?.folder('_rels')?.file('workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`);
  zip.folder('xl')?.folder('worksheets')?.file('sheet1.xml', worksheetXml);
  zip.folder('xl')?.file('styles.xml', stylesXml);
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

function excelColumn(index: number) {
  let column = '';
  let value = index + 1;
  while (value > 0) {
    const remainder = (value - 1) % 26;
    column = String.fromCharCode(65 + remainder) + column;
    value = Math.floor((value - 1) / 26);
  }
  return column;
}

/**
 * Generates a Word document containing the formatted assessment report and grid.
 */
export async function generateAssessmentWord(data: AssessmentExportData): Promise<Uint8Array> {
  const zip = new JSZip();
  const escapeXml = (value: string) => value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  })[char] ?? char);
  const paragraph = (value: string, options: { bold?: boolean; size?: number; color?: string; after?: number } = {}) => {
    const { bold = false, size = 20, color = '243247', after = 80 } = options;
    return `<w:p><w:pPr><w:spacing w:after="${after}"/></w:pPr><w:r><w:rPr>${bold ? '<w:b/>' : ''}<w:color w:val="${color}"/><w:sz w:val="${size}"/></w:rPr><w:t xml:space="preserve">${escapeXml(value)}</w:t></w:r></w:p>`;
  };
  const cell = (
    value: string,
    width: number,
    options: { fill?: string; color?: string; bold?: boolean; align?: 'left' | 'center'; verticalMerge?: 'restart' | 'continue'; gridSpan?: number } = {},
  ) => {
    const { fill, color = '243247', bold = false, align = 'center', verticalMerge, gridSpan } = options;
    const properties = `<w:tcW w:w="${width}" w:type="dxa"/>${gridSpan ? `<w:gridSpan w:val="${gridSpan}"/>` : ''}${verticalMerge ? `<w:vMerge w:val="${verticalMerge}"/>` : ''}${fill ? `<w:shd w:fill="${fill}"/>` : ''}<w:vAlign w:val="center"/>`;
    const text = value ? `<w:p><w:pPr><w:jc w:val="${align}"/><w:spacing w:before="0" w:after="0"/></w:pPr><w:r><w:rPr>${bold ? '<w:b/>' : ''}<w:color w:val="${color}"/><w:sz w:val="16"/></w:rPr><w:t xml:space="preserve">${escapeXml(value)}</w:t></w:r></w:p>` : '<w:p/>';
    return `<w:tc><w:tcPr>${properties}</w:tcPr>${text}</w:tc>`;
  };
  const tableRow = (cells: string[], header = false) => `<w:tr>${header ? '<w:trPr><w:tblHeader/></w:trPr>' : ''}${cells.join('')}</w:tr>`;
  const tableStart = (gridWidths: number[]) => `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblLayout w:type="fixed"/><w:tblBorders><w:top w:val="single" w:sz="5" w:color="8291A3"/><w:left w:val="single" w:sz="5" w:color="8291A3"/><w:bottom w:val="single" w:sz="5" w:color="8291A3"/><w:right w:val="single" w:sz="5" w:color="8291A3"/><w:insideH w:val="single" w:sz="4" w:color="AAB5C1"/><w:insideV w:val="single" w:sz="4" w:color="AAB5C1"/></w:tblBorders></w:tblPr><w:tblGrid>${gridWidths.map((width) => `<w:gridCol w:w="${width}"/>`).join('')}</w:tblGrid>`;
  const sectionTitle = (title: string) => paragraph(title, { bold: true, size: 22, color: '1F4E78', after: 100 });
  const parts: string[] = [
    paragraph(`GRILLE D’ÉVALUATION — ${data.className || 'Classe'}`, { bold: true, size: 30, color: 'FFFFFF', after: 140 }),
    paragraph(`Établissement : ${data.school.name || '—'}${data.school.wilaya ? ` · ${data.school.wilaya}` : ''}${data.school.address ? ` · ${data.school.address}` : ''}`, { bold: true, size: 20 }),
    paragraph(`Niveau : ${data.level || '—'}   |   Classe : ${data.className || '—'}   |   Année scolaire : ${data.academicYear || '—'}   |   Enseignant(e) : ${data.teacherName || '—'}`),
    paragraph(`Matière : ${data.assessment.subject || '—'}   |   Compétence : ${data.assessment.competency || '—'}`),
    paragraph(`Évaluation : ${data.assessment.title || '—'}   |   Date : ${data.assessment.date || '—'}`),
    paragraph(`Objectif de la séance : ${data.assessment.sessionObjectives || '—'}`),
    paragraph(`Support : ${data.assessment.support || '—'}`, { after: 180 }),
    sectionTitle(`OBJECTIFS D’ÉVALUATION (${data.objectives.length})`),
  ];
  data.objectives.forEach((objective, index) => {
    parts.push(paragraph(`${String(objective.order || index + 1).padStart(2, '0')}.  ${objective.description}`, { after: 45 }));
  });
  parts.push(paragraph('', { after: 100 }), sectionTitle(`GRILLE D’ANALYSE DES RÉSULTATS — ${data.className || 'Classe'}`));

  const totalWidth = 15398;
  const numberWidth = 620;
  const nameWidth = 2800;
  const totalCellWidth = 520;
  const evaluationWidth = Math.max(180, Math.floor((totalWidth - numberWidth - nameWidth - totalCellWidth * 3) / Math.max(1, data.objectives.length * 3)));
  const gridWidths = [
    numberWidth,
    nameWidth,
    ...data.objectives.flatMap(() => [evaluationWidth, evaluationWidth, evaluationWidth]),
    totalCellWidth, totalCellWidth, totalCellWidth,
  ];
  const groupedHeaders = [
    cell('N°', numberWidth, { fill: '1F4E78', color: 'FFFFFF', bold: true, verticalMerge: 'restart' }),
    cell('Nom et prénom', nameWidth, { fill: '1F4E78', color: 'FFFFFF', bold: true, align: 'left', verticalMerge: 'restart' }),
    ...data.objectives.map((objective, index) => cell(`Objectif ${String(objective.order || index + 1).padStart(2, '0')}`, evaluationWidth * 3, { fill: '1F4E78', color: 'FFFFFF', bold: true, gridSpan: 3 })),
    cell('Totaux', totalCellWidth * 3, { fill: '1F4E78', color: 'FFFFFF', bold: true, gridSpan: 3 }),
  ];
  const subHeaders = [
    cell('', numberWidth, { fill: '1F4E78', verticalMerge: 'continue' }),
    cell('', nameWidth, { fill: '1F4E78', verticalMerge: 'continue' }),
    ...data.objectives.flatMap(() => [
      cell('+', evaluationWidth, { fill: 'D9E1F2', bold: true }),
      cell('±', evaluationWidth, { fill: 'FFF3CD', bold: true }),
      cell('−', evaluationWidth, { fill: 'FDE8E7', bold: true }),
    ]),
    cell('+', totalCellWidth, { fill: 'D9E1F2', bold: true }),
    cell('±', totalCellWidth, { fill: 'FFF3CD', bold: true }),
    cell('−', totalCellWidth, { fill: 'FDE8E7', bold: true }),
  ];
  const resultsTable = [tableStart(gridWidths), tableRow(groupedHeaders, true), tableRow(subHeaders, true)];
  const objectiveTotals = data.objectives.map(() => ({ plus: 0, partial: 0, minus: 0 }));
  let grandPlus = 0;
  let grandPartial = 0;
  let grandMinus = 0;
  data.pupils.forEach((pupil, index) => {
    let plus = 0;
    let partial = 0;
    let minus = 0;
    const resultCells = data.objectives.flatMap((objective, objectiveIndex) => {
      const result = data.evaluations[pupil.id]?.[objective.id];
      const acquired = result === 'Acquired';
      const partlyAcquired = result === 'PartiallyAcquired';
      const notAcquired = result === 'NotAcquired';
      if (acquired) { plus++; objectiveTotals[objectiveIndex].plus++; }
      if (partlyAcquired) { partial++; objectiveTotals[objectiveIndex].partial++; }
      if (notAcquired) { minus++; objectiveTotals[objectiveIndex].minus++; }
      return [
        cell(acquired ? '+' : '', evaluationWidth, { fill: acquired ? 'E8F5E9' : undefined, color: '166534', bold: acquired }),
        cell(partlyAcquired ? '±' : '', evaluationWidth, { fill: partlyAcquired ? 'FFF3CD' : undefined, color: 'B45309', bold: partlyAcquired }),
        cell(notAcquired ? '−' : '', evaluationWidth, { fill: notAcquired ? 'FDE8E7' : undefined, color: 'B91C1C', bold: notAcquired }),
      ];
    });
    grandPlus += plus;
    grandPartial += partial;
    grandMinus += minus;
    const stripe = index % 2 ? 'F4F7FA' : undefined;
    resultsTable.push(tableRow([
      cell(pupil.registrationNumber || String(index + 1).padStart(2, '0'), numberWidth, { fill: stripe }),
      cell(`${pupil.lastName || ''} ${pupil.firstName || ''}`.trim(), nameWidth, { fill: stripe, align: 'left' }),
      ...resultCells,
      cell(String(plus), totalCellWidth, { fill: 'E9EEF4', bold: true }),
      cell(String(partial), totalCellWidth, { fill: 'E9EEF4', bold: true }),
      cell(String(minus), totalCellWidth, { fill: 'E9EEF4', bold: true }),
    ]));
  });
  const totalCells = objectiveTotals.flatMap((total) => [
    cell(String(total.plus), evaluationWidth, { fill: 'D9E1F2', bold: true }),
    cell(String(total.partial), evaluationWidth, { fill: 'D9E1F2', bold: true }),
    cell(String(total.minus), evaluationWidth, { fill: 'D9E1F2', bold: true }),
  ]);
  resultsTable.push(tableRow([
    cell('TOTAL CLASSE', numberWidth + nameWidth, { fill: 'D9E1F2', bold: true, gridSpan: 2 }),
    ...totalCells,
    cell(String(grandPlus), totalCellWidth, { fill: 'D9E1F2', bold: true }),
    cell(String(grandPartial), totalCellWidth, { fill: 'D9E1F2', bold: true }),
    cell(String(grandMinus), totalCellWidth, { fill: 'D9E1F2', bold: true }),
  ]));
  parts.push(`${resultsTable.join('')}</w:tbl>`, paragraph('', { after: 100 }), sectionTitle('DÉCISIONS ET REMÉDIATIONS'));
  const addDecision = (heading: string, content: string) => {
    parts.push(paragraph(heading, { bold: true, color: '1F4E78', after: 50 }));
    const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    (lines.length ? lines : ['Aucune décision saisie.']).forEach((line) => {
      parts.push(paragraph(`•  ${line.replace(/^[•\-]\s*/, '')}`, { after: 45 }));
    });
  };
  addDecision('A) Décisions au plan individuel', data.individualRemediation || '');
  addDecision('B) Décisions au plan de la classe', data.classRemediation || '');

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="10" w:space="5" w:color="1F4E78"/></w:pBdr><w:shd w:fill="1F4E78"/><w:spacing w:after="140"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="30"/></w:rPr><w:t>${escapeXml(`GRILLE D’ÉVALUATION — ${data.className || 'Classe'}`)}</w:t></w:r></w:p>
${parts.slice(1).join('')}
<w:sectPr><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720" w:header="360" w:footer="360" w:gutter="0"/></w:sectPr>
</w:body></w:document>`;

  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);
  zip.folder('_rels')?.file('.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);
  zip.folder('word')?.file('document.xml', documentXml);
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

/**
 * Copies the PDF produced by expo-print to an app-owned cache URI before sharing.
 * Expo print's temporary URI may not be readable by the native sharing provider.
 */
export async function exportAssessmentPdf(data: AssessmentExportData): Promise<void> {
  const html = generateAssessmentPdfHtml(data);
  if (Platform.OS === 'web') {
    await Print.printAsync({ html });
    return;
  }

  const { base64 } = await Print.printToFileAsync({ html, base64: true });
  if (!base64) {
    throw new Error('Expo Print n’a pas fourni le contenu du PDF.');
  }
  const safeName = (value: string) => value.replace(/[^\p{L}\p{N}-]+/gu, '_');
  const filename = `Evaluation_${safeName(data.className || 'Classe')}_${safeName(data.assessment?.title || 'Evaluation')}.pdf`;
  const cacheDirectory = LegacyFS.cacheDirectory ?? Paths.cache.uri;
  const targetUri = `${cacheDirectory.endsWith('/') ? cacheDirectory : `${cacheDirectory}/`}${Date.now()}-${filename}`;
  await LegacyFS.writeAsStringAsync(targetUri, base64, {
    encoding: LegacyFS.EncodingType.Base64,
  });

  const fileInfo = await LegacyFS.getInfoAsync(targetUri);
  if (!fileInfo.exists || fileInfo.size === 0) {
    throw new Error('Le PDF n’a pas été enregistré correctement dans le cache.');
  }

  if (!(await Sharing.isAvailableAsync())) {
    Alert.alert('PDF généré', `Le fichier a été créé dans le cache de l’application : ${filename}`);
    return;
  }
  try {
    await Sharing.shareAsync(targetUri, {
      mimeType: 'application/pdf',
      dialogTitle: `Enregistrer ${filename}`,
      UTI: 'com.adobe.pdf',
    });
  } catch (error) {
    console.error('Erreur partage PDF:', error);
    throw new Error('Le PDF a été généré, mais le partage a échoué. Vérifiez les autorisations de fichiers de l’appareil et réessayez.');
  }
}

/**
 * Converts any supported content type to a Uint8Array.
 */
async function toUint8Array(content: Blob | ArrayBuffer | Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
  if (content instanceof Uint8Array) {
    // Ensure the underlying buffer is a plain ArrayBuffer (not SharedArrayBuffer)
    const buf = new ArrayBuffer(content.byteLength);
    new Uint8Array(buf).set(content);
    return new Uint8Array(buf);
  }
  if (content instanceof ArrayBuffer) {
    return new Uint8Array(content);
  }
  // Blob
  const ab = await content.arrayBuffer();
  return new Uint8Array(ab);
}

/**
 * Triggers a browser download (on web) or saves and opens native sharing (on mobile).
 */
export async function downloadFile(
  content: Blob | ArrayBuffer | Uint8Array,
  filename: string,
  mimeType: string,
): Promise<void> {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof document !== 'undefined') {
    const bytes = await toUint8Array(content);
    const blob = new Blob([bytes], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }

  // Native Mobile (Android & iOS) — use legacy writeAsStringAsync (base64) which is proven stable
  try {
    const bytes = await toUint8Array(content);
    // Convert bytes to base64 string in chunks to avoid call stack overflow
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    const base64 = btoa(binary);

    const cacheDir = LegacyFS.cacheDirectory ?? Paths.cache.uri;
    const fileUri = `${cacheDir}${filename}`;
    await LegacyFS.writeAsStringAsync(fileUri, base64, {
      encoding: LegacyFS.EncodingType.Base64,
    });

    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(fileUri, {
        mimeType,
        dialogTitle: `Enregistrer ou partager ${filename}`,
        UTI: filename.endsWith('.xlsx')
          ? 'org.openxmlformats.spreadsheetml.sheet'
          : filename.endsWith('.docx')
            ? 'org.openxmlformats.wordprocessingml.document'
          : filename.endsWith('.csv')
            ? 'public.comma-separated-values-text'
            : 'public.data',
      });
    } else {
      Alert.alert('Fichier généré', `Le document a été créé : ${filename}`);
    }
  } catch (error) {
    console.error('Erreur téléchargement mobile:', error);
    Alert.alert('Erreur', "Impossible d'enregistrer le fichier sur cet appareil.");
  }
}

/**
 * Generates formatted HTML for PDF printing and exporting.
 */
export function generateAssessmentPdfHtml(data: AssessmentExportData): string {
  const numObjectives = data.objectives.length;

  // Compute totals
  const objTotals = data.objectives.map((obj) => {
    let plus = 0;
    let plusMinus = 0;
    let minus = 0;
    data.pupils.forEach((pupil) => {
      const val = data.evaluations[pupil.id]?.[obj.id];
      if (val === 'Acquired') plus++;
      else if (val === 'PartiallyAcquired') plusMinus++;
      else if (val === 'NotAcquired') minus++;
    });
    return { plus, plusMinus, minus };
  });

  let grandPlus = 0;
  let grandPlusMinus = 0;
  let grandMinus = 0;

  const pupilRows = data.pupils.map((pupil, pIndex) => {
    let pPlus = 0;
    let pPlusMinus = 0;
    let pMinus = 0;

    const objCells = data.objectives.map((obj) => {
      const val = data.evaluations[pupil.id]?.[obj.id];
      const isPlus = val === 'Acquired';
      const isPlusMinus = val === 'PartiallyAcquired';
      const isMinus = val === 'NotAcquired';

      if (isPlus) { pPlus++; grandPlus++; }
      if (isPlusMinus) { pPlusMinus++; grandPlusMinus++; }
      if (isMinus) { pMinus++; grandMinus++; }

      return `
        <td class="col-val col-plus">${isPlus ? '+' : ''}</td>
        <td class="col-val col-pm">${isPlusMinus ? '&plusmn;' : ''}</td>
        <td class="col-val col-minus">${isMinus ? '-' : ''}</td>
      `;
    }).join('');

    return `
      <tr>
        <td class="col-num">${pupil.registrationNumber || pIndex + 1}</td>
        <td class="col-name">${pupil.lastName} ${pupil.firstName}</td>
        ${objCells}
        <td class="col-total col-plus">${pPlus}</td>
        <td class="col-total col-pm">${pPlusMinus}</td>
        <td class="col-total col-minus">${pMinus}</td>
      </tr>
    `;
  }).join('');

  const objHeaders = data.objectives.map((obj) => `
    <th colspan="3" class="th-obj">Obj ${String(obj.order).padStart(2, '0')}</th>
  `).join('');

  const subHeaders = data.objectives.map(() => `
    <th class="th-sub col-plus">+</th>
    <th class="th-sub col-pm">&plusmn;</th>
    <th class="th-sub col-minus">-</th>
  `).join('');

  const totalCells = objTotals.map((tot) => `
    <td class="col-total col-plus">${tot.plus}</td>
    <td class="col-total col-pm">${tot.plusMinus}</td>
    <td class="col-total col-minus">${tot.minus}</td>
  `).join('');

  const indivItems = (data.individualRemediation || 'Aucune décision saisie.').split('\n').filter(Boolean)
    .map(line => `<li>${line.replace(/^[•\-]\s*/, '')}</li>`).join('');

  const classItems = (data.classRemediation || 'Aucune décision saisie.').split('\n').filter(Boolean)
    .map(line => `<li>${line.replace(/^[•\-]\s*/, '')}</li>`).join('');

  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <title>Évaluation — ${data.className} — ${data.assessment.title}</title>
      <style>
        @page {
          size: A4 landscape;
          margin: 8mm;
        }
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
          font-family: "DejaVu Sans", "Noto Sans", "Segoe UI", Arial, sans-serif;
        }
        body {
          padding: 8mm;
          color: #1a202c;
          background: #ffffff;
          font-size: 11px;
          line-height: 1.3;
        }
        .header-box {
          border: 1px solid #1f4e78;
          background: #f0f4f8;
          padding: 8px 12px;
          border-radius: 4px;
          margin-bottom: 8px;
        }
        .header-top {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          margin-bottom: 4px;
          font-weight: 600;
          color: #1f4e78;
        }
        .meta-line {
          font-size: 11px;
          margin-top: 3px;
        }
        .meta-label {
          font-weight: 700;
          color: #2d3748;
        }
        .objectives-box {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          padding: 6px 10px;
          border-radius: 4px;
          margin-bottom: 10px;
        }
        .objectives-title {
          font-weight: 700;
          color: #1f4e78;
          margin-bottom: 4px;
          font-size: 11px;
        }
        .objectives-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 2px 14px;
        }
        .objective-item {
          font-size: 10px;
          color: #4a5568;
        }
        .section-title {
          font-size: 13px;
          font-weight: 800;
          color: #1f4e78;
          margin-bottom: 6px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 12px;
          table-layout: fixed;
        }
        th, td {
          border: 1px solid #718096;
          padding: 3px 2px;
          text-align: center;
          font-size: 9.5px;
        }
        th {
          background-color: #d9e1f2;
          color: #1f4e78;
          font-weight: 700;
        }
        .th-num { width: 32px; }
        .th-name { width: 140px; text-align: left; padding-left: 6px; }
        .col-num { font-weight: 600; color: #4a5568; }
        .col-name { text-align: left; padding-left: 6px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .th-obj { font-size: 9px; }
        .th-sub { width: 18px; font-size: 9px; background-color: #e9eef4; }
        .col-val { font-weight: 800; font-size: 10px; }
        .col-plus { color: #166534; }
        .col-pm { color: #b45309; }
        .col-minus { color: #b91c1c; }
        .col-total { font-weight: 800; background-color: #f8fafc; }
        .total-row {
          background-color: #e2e8f0;
          font-weight: 800;
        }
        .remediation-box {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-top: 8px;
          page-break-inside: avoid;
        }
        .remed-card {
          border: 1px solid #cbd5e1;
          border-radius: 4px;
          padding: 8px 10px;
          background: #f8fafc;
        }
        .remed-card h4 {
          font-size: 11px;
          color: #1f4e78;
          margin-bottom: 4px;
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 3px;
        }
        .remed-card ul {
          padding-left: 14px;
          font-size: 10px;
          color: #334155;
        }
        .remed-card li {
          margin-bottom: 2px;
        }
        @media print {
          body { padding: 0; }
          .header-box { border-color: #333; }
        }
      </style>
    </head>
    <body>
      <div class="header-box">
        <div class="header-top">
          <span>Établissement : ${data.school.name || 'Établissement scolaire'}</span>
          <span>Niveau : ${data.level || '—'}</span>
          <span>Année scolaire : ${data.academicYear || '2026-2027'}</span>
          <span>Enseignant(e) : ${data.teacherName || '—'}</span>
        </div>
        <div class="meta-line">
          <span class="meta-label">Compétence :</span> ${data.assessment.competency} |
          <span class="meta-label">Objectif de la séance :</span> ${data.assessment.sessionObjectives || 'Objectifs'} |
          <span class="meta-label">Support :</span> ${data.assessment.support || 'Support pédagogique'}
        </div>
      </div>

      <div class="objectives-box">
        <div class="objectives-title">Objectifs d’évaluation (${numObjectives} objectifs) :</div>
        <div class="objectives-grid">
          ${data.objectives.map(obj => `
            <div class="objective-item"><strong>${String(obj.order).padStart(2, '0')}.</strong> ${obj.description}</div>
          `).join('')}
        </div>
      </div>

      <div class="section-title">Grille d’analyse des résultats — Classe : ${data.className}</div>
      <table>
        <thead>
          <tr>
            <th rowspan="2" class="th-num">N°</th>
            <th rowspan="2" class="th-name">Nom et Prénom</th>
            ${objHeaders}
            <th colspan="3" class="th-obj">Total</th>
          </tr>
          <tr>
            ${subHeaders}
            <th class="th-sub col-plus">+</th>
            <th class="th-sub col-pm">&plusmn;</th>
            <th class="th-sub col-minus">-</th>
          </tr>
        </thead>
        <tbody>
          ${pupilRows}
          <tr class="total-row">
            <td colspan="2" style="text-align: right; padding-right: 8px; font-weight: 800;">TOTAL CLASSE :</td>
            ${totalCells}
            <td class="col-total col-plus">${grandPlus}</td>
            <td class="col-total col-pm">${grandPlusMinus}</td>
            <td class="col-total col-minus">${grandMinus}</td>
          </tr>
        </tbody>
      </table>

      <div class="remediation-box">
        <div class="remed-card">
          <h4>A) Décisions au plan individuel :</h4>
          <ul>${indivItems}</ul>
        </div>
        <div class="remed-card">
          <h4>B) Décisions au plan de la classe :</h4>
          <ul>${classItems}</ul>
        </div>
      </div>
    </body>
    </html>
  `;
}
