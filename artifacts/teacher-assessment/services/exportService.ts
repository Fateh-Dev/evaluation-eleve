import { File as ExpoFile, Paths } from 'expo-file-system';
import * as LegacyFS from 'expo-file-system/legacy';
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeightRule,
  Packer,
  PageOrientation,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Alert, Platform } from 'react-native';

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
 * Generates a CSV file compatible with Excel, matching the assessment grid format.
 * Uses UTF-8 BOM so Excel on Windows correctly interprets accented characters.
 */
export function generateAssessmentExcel(data: AssessmentExportData): Uint8Array {
  const rows: string[][] = [];

  // Header metadata
  rows.push([
    `Établissement : ${data.school.name || ''}`,
    `Niveau : ${data.level || ''}`,
    `Enseignant(e) : ${data.teacherName || ''}`,
  ]);
  rows.push([
    `CompÃ©tence : ${data.assessment.competency || ''}`,
    `Objectif de la sÃ©ance : ${data.assessment.sessionObjectives || ''}`,
    `Support : ${data.assessment.support || ''}`,
  ]);
  rows.push([`Objectifs d'Ã©valuation (${data.objectives.length} Objectifs) :`]);
  data.objectives.forEach((obj, idx) => {
    const num = String(obj.order || idx + 1).padStart(2, '0');
    rows.push([`${num}. ${obj.description}`]);
  });
  rows.push([]); // spacer

  // â”€â”€ Grid title â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  rows.push([`Grille d'analyse des rÃ©sultats â€” Classe : ${data.className || ''}`]);

  // â”€â”€ Table header row 1 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const objHeaders: string[] = [];
  data.objectives.forEach((obj, idx) => {
    const num = String(obj.order || idx + 1).padStart(2, '0');
    objHeaders.push(`Obj ${num} (+)`, `Obj ${num} (Â±)`, `Obj ${num} (-)`);
  });
  rows.push(['NÂ°', 'Nom et PrÃ©nom', ...objHeaders, 'Total (+)', 'Total (Â±)', 'Total (-)']);

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
        evalCells.push('', 'Â±', '');
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
  rows.push(['DÃ©cisions Ã  prendre :']);
  rows.push(['A) Au plan individuel :']);
  (data.individualRemediation || 'Aucune dÃ©cision saisie.').split('\n').filter(Boolean).forEach((line) => {
    rows.push([`   ${line.startsWith('â€¢') || line.startsWith('-') ? line : `â€¢ ${line}`}`]);
  });
  rows.push(['B) Au plan de la classe :']);
  (data.classRemediation || 'Aucune dÃ©cision saisie.').split('\n').filter(Boolean).forEach((line) => {
    rows.push([`   ${line.startsWith('â€¢') || line.startsWith('-') ? line : `â€¢ ${line}`}`]);
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
 * Generates a Word (.docx) document matching the exact format in the reference image and notation document.
 */
export async function generateAssessmentDocx(data: AssessmentExportData): Promise<Uint8Array<ArrayBuffer>> {
  const numObjectives = data.objectives.length;

  // Column width calculations (landscape 15840 twips - 1440 twips margins = 14400 twips available)
  const colWNum = 440; // NÂ°
  const colWName = 2560; // Nom et PrÃ©nom
  const colWObj = 320; // Each objective subcol (+, Â±, -)
  const colWTotal = 360; // Each total subcol (+, Â±, -)

  const borderSingle = { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER };
  const cellBorders = {
    top: borderSingle,
    bottom: borderSingle,
    left: borderSingle,
    right: borderSingle,
  };

  const tableRows: TableRow[] = [];

  // ROW 1:
  // - NÂ° (rowSpan 3)
  // - Nom et PrÃ©nom (rowSpan 3)
  // - Objectifs dâ€™Ã©valuation (columnSpan: numObjectives * 3)
  // - Total (columnSpan: 3, rowSpan: 2)
  tableRows.push(
    new TableRow({
      tableHeader: true,
      height: { value: 340, rule: HeightRule.ATLEAST },
      children: [
        new TableCell({
          rowSpan: 3,
          width: { size: colWNum, type: WidthType.DXA },
          verticalAlign: VerticalAlign.CENTER,
          shading: { type: ShadingType.CLEAR, fill: COLOR_SUBHEADER_BG },
          borders: cellBorders,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: 'NÂ°', bold: true, size: 16, font: 'Calibri' })],
            }),
          ],
        }),
        new TableCell({
          rowSpan: 3,
          width: { size: colWName, type: WidthType.DXA },
          verticalAlign: VerticalAlign.CENTER,
          shading: { type: ShadingType.CLEAR, fill: COLOR_SUBHEADER_BG },
          borders: cellBorders,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: 'Nom et PrÃ©nom', bold: true, size: 16, font: 'Calibri' })],
            }),
          ],
        }),
        new TableCell({
          columnSpan: numObjectives * 3,
          verticalAlign: VerticalAlign.CENTER,
          shading: { type: ShadingType.CLEAR, fill: COLOR_HEADER_BG },
          borders: cellBorders,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: 'Objectifs dâ€™Ã©valuation', bold: true, size: 17, font: 'Calibri' })],
            }),
          ],
        }),
        new TableCell({
          columnSpan: 3,
          rowSpan: 2,
          verticalAlign: VerticalAlign.CENTER,
          shading: { type: ShadingType.CLEAR, fill: COLOR_HEADER_BG },
          borders: cellBorders,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: 'Total', bold: true, size: 16, font: 'Calibri' })],
            }),
          ],
        }),
      ],
    }),
  );

  // ROW 2:
  // - Sub-headers for each objective (01, 02, ..., 11) with columnSpan 3 each
  const r2ObjectiveCells: TableCell[] = [];
  data.objectives.forEach((obj, idx) => {
    const numLabel = String(obj.order || idx + 1).padStart(2, '0');
    r2ObjectiveCells.push(
      new TableCell({
        columnSpan: 3,
        width: { size: colWObj * 3, type: WidthType.DXA },
        verticalAlign: VerticalAlign.CENTER,
        shading: { type: ShadingType.CLEAR, fill: COLOR_SUBHEADER_BG },
        borders: cellBorders,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: numLabel, bold: true, size: 15, font: 'Calibri' })],
          }),
        ],
      }),
    );
  });

  tableRows.push(
    new TableRow({
      tableHeader: true,
      height: { value: 300, rule: HeightRule.ATLEAST },
      children: r2ObjectiveCells,
    }),
  );

  // ROW 3:
  // - (+, Â±, -) for each objective
  // - (+, Â±, -) for Total
  const r3SubCells: TableCell[] = [];
  for (let idx = 0; idx < numObjectives; idx++) {
    ['+', 'Â±', '-'].forEach((mark) => {
      r3SubCells.push(
        new TableCell({
          width: { size: colWObj, type: WidthType.DXA },
          verticalAlign: VerticalAlign.CENTER,
          shading: { type: ShadingType.CLEAR, fill: COLOR_SUBHEADER_BG },
          borders: cellBorders,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: mark, bold: true, size: 15, font: 'Calibri' })],
            }),
          ],
        }),
      );
    });
  }
  // Total subcols
  ['+', 'Â±', '-'].forEach((mark) => {
    r3SubCells.push(
      new TableCell({
        width: { size: colWTotal, type: WidthType.DXA },
        verticalAlign: VerticalAlign.CENTER,
        shading: { type: ShadingType.CLEAR, fill: COLOR_SUBHEADER_BG },
        borders: cellBorders,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: mark, bold: true, size: 15, font: 'Calibri' })],
          }),
        ],
      }),
    );
  });

  tableRows.push(
    new TableRow({
      tableHeader: true,
      height: { value: 280, rule: HeightRule.ATLEAST },
      children: r3SubCells,
    }),
  );

  // PUPIL DATA ROWS
  const objectiveTotals: Array<{ plus: number; plusMinus: number; minus: number }> = data.objectives.map(() => ({
    plus: 0,
    plusMinus: 0,
    minus: 0,
  }));
  let grandTotalPlus = 0;
  let grandTotalPlusMinus = 0;
  let grandTotalMinus = 0;

  data.pupils.forEach((pupil, pIdx) => {
    const isAlt = pIdx % 2 === 1;
    const rowFill = isAlt ? COLOR_TR_ALT_BG : 'FFFFFF';
    const regNo = pupil.registrationNumber || String(pIdx + 1).padStart(2, '0');
    const fullName = `${pupil.lastName || ''} ${pupil.firstName || ''}`.trim();

    let pPlus = 0;
    let pPlusMinus = 0;
    let pMinus = 0;

    const rowCells: TableCell[] = [
      new TableCell({
        width: { size: colWNum, type: WidthType.DXA },
        verticalAlign: VerticalAlign.CENTER,
        shading: { type: ShadingType.CLEAR, fill: rowFill },
        borders: cellBorders,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: regNo, size: 15, font: 'Calibri' })],
          }),
        ],
      }),
      new TableCell({
        width: { size: colWName, type: WidthType.DXA },
        verticalAlign: VerticalAlign.CENTER,
        shading: { type: ShadingType.CLEAR, fill: rowFill },
        borders: cellBorders,
        children: [
          new Paragraph({
            alignment: AlignmentType.LEFT,
            children: [new TextRun({ text: fullName, size: 15, font: 'Calibri' })],
          }),
        ],
      }),
    ];

    data.objectives.forEach((obj, objIdx) => {
      const evalVal = data.evaluations[pupil.id]?.[obj.id] ?? 'NotEvaluated';
      let valPlus = '';
      let valPlusMinus = '';
      let valMinus = '';

      if (evalVal === 'Acquired') {
        valPlus = '+';
        pPlus++;
        objectiveTotals[objIdx].plus++;
      } else if (evalVal === 'PartiallyAcquired') {
        valPlusMinus = 'Â±';
        pPlusMinus++;
        objectiveTotals[objIdx].plusMinus++;
      } else if (evalVal === 'NotAcquired') {
        valMinus = '-';
        pMinus++;
        objectiveTotals[objIdx].minus++;
      }

      [valPlus, valPlusMinus, valMinus].forEach((textVal) => {
        rowCells.push(
          new TableCell({
            width: { size: colWObj, type: WidthType.DXA },
            verticalAlign: VerticalAlign.CENTER,
            shading: { type: ShadingType.CLEAR, fill: rowFill },
            borders: cellBorders,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: textVal, size: 15, bold: Boolean(textVal), font: 'Calibri' })],
              }),
            ],
          }),
        );
      });
    });

    grandTotalPlus += pPlus;
    grandTotalPlusMinus += pPlusMinus;
    grandTotalMinus += pMinus;

    // Pupil Totals
    [pPlus, pPlusMinus, pMinus].forEach((totalVal) => {
      rowCells.push(
        new TableCell({
          width: { size: colWTotal, type: WidthType.DXA },
          verticalAlign: VerticalAlign.CENTER,
          shading: { type: ShadingType.CLEAR, fill: rowFill },
          borders: cellBorders,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: totalVal > 0 ? String(totalVal) : '', size: 15, bold: true, font: 'Calibri' })],
            }),
          ],
        }),
      );
    });

    tableRows.push(
      new TableRow({
        height: { value: 290, rule: HeightRule.ATLEAST },
        children: rowCells,
      }),
    );
  });

  // BOTTOM TOTAL ROW
  const totalRowCells: TableCell[] = [
    new TableCell({
      columnSpan: 2,
      width: { size: colWNum + colWName, type: WidthType.DXA },
      verticalAlign: VerticalAlign.CENTER,
      shading: { type: ShadingType.CLEAR, fill: COLOR_HEADER_BG },
      borders: cellBorders,
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: 'Total', bold: true, size: 16, font: 'Calibri' })],
        }),
      ],
    }),
  ];

  objectiveTotals.forEach((tot) => {
    [tot.plus, tot.plusMinus, tot.minus].forEach((val) => {
      totalRowCells.push(
        new TableCell({
          width: { size: colWObj, type: WidthType.DXA },
          verticalAlign: VerticalAlign.CENTER,
          shading: { type: ShadingType.CLEAR, fill: COLOR_HEADER_BG },
          borders: cellBorders,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: val > 0 ? String(val) : '', bold: true, size: 14, font: 'Calibri' })],
            }),
          ],
        }),
      );
    });
  });

  // Grand totals
  [grandTotalPlus, grandTotalPlusMinus, grandTotalMinus].forEach((val) => {
    totalRowCells.push(
      new TableCell({
        width: { size: colWTotal, type: WidthType.DXA },
        verticalAlign: VerticalAlign.CENTER,
        shading: { type: ShadingType.CLEAR, fill: COLOR_HEADER_BG },
        borders: cellBorders,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: val > 0 ? String(val) : '', bold: true, size: 14, font: 'Calibri' })],
          }),
        ],
      }),
    );
  });

  tableRows.push(
    new TableRow({
      height: { value: 320, rule: HeightRule.ATLEAST },
      children: totalRowCells,
    }),
  );

  // Document Paragraphs
  const paragraphs: Paragraph[] = [];

  // Line 1: Établissement, Niveau & Enseignant
  paragraphs.push(
    new Paragraph({
      spacing: { after: 70 },
      children: [
        new TextRun({
          text: `Établissement : ${data.school.name || ''} | Niveau : ${data.level || ''}${data.teacherName ? ` | Enseignant(e) : ${data.teacherName}` : ''}`,
          bold: true,
          size: 22, // 11pt
          color: COLOR_PRIMARY_HEX,
          font: 'Calibri',
        }),
      ],
    }),
  );

  // Line 2: CompÃ©tence | Objectif | Support
  paragraphs.push(
    new Paragraph({
      spacing: { after: 120 },
      children: [
        new TextRun({ text: 'CompÃ©tence : ', bold: true, size: 19, font: 'Calibri' }),
        new TextRun({ text: `${data.assessment.competency || ''}   |   `, size: 19, font: 'Calibri' }),
        new TextRun({ text: 'Objectif de la sÃ©ance : ', bold: true, size: 19, font: 'Calibri' }),
        new TextRun({ text: `${data.assessment.sessionObjectives || ''}   |   `, size: 19, font: 'Calibri' }),
        new TextRun({ text: 'Support : ', bold: true, size: 19, font: 'Calibri' }),
        new TextRun({ text: `${data.assessment.support || ''}`, size: 19, font: 'Calibri' }),
      ],
    }),
  );

  // Line 3: Objectifs dâ€™Ã©valuation Title
  paragraphs.push(
    new Paragraph({
      spacing: { after: 50 },
      children: [
        new TextRun({
          text: `Objectifs dâ€™Ã©valuation (${numObjectives} Objectifs) :`,
          bold: true,
          size: 20,
          color: COLOR_PRIMARY_HEX,
          font: 'Calibri',
        }),
      ],
    }),
  );

  // Objectives List
  data.objectives.forEach((obj, idx) => {
    const numStr = String(obj.order || idx + 1).padStart(2, '0');
    paragraphs.push(
      new Paragraph({
        spacing: { after: 25 },
        indent: { left: 240 },
        children: [
          new TextRun({ text: `${numStr}. `, bold: true, color: COLOR_PRIMARY_HEX, size: 18, font: 'Calibri' }),
          new TextRun({ text: obj.description, size: 18, font: 'Calibri' }),
        ],
      }),
    );
  });

  // Table Title: Grille dâ€™analyse des rÃ©sultats
  paragraphs.push(
    new Paragraph({
      spacing: { before: 140, after: 80 },
      children: [
        new TextRun({
          text: `Grille dâ€™analyse des rÃ©sultats â€” Classe : ${data.className || ''}`,
          bold: true,
          size: 22,
          color: COLOR_PRIMARY_HEX,
          font: 'Calibri',
        }),
      ],
    }),
  );

  // Table
  const table = new Table({
    rows: tableRows,
    width: { size: 100, type: WidthType.PERCENTAGE },
  });

  // Post-Table Decisions Section
  const decisionParagraphs: Paragraph[] = [
    new Paragraph({
      spacing: { before: 180, after: 70 },
      children: [
        new TextRun({
          text: 'DÃ©cisions Ã  prendre :',
          bold: true,
          size: 20,
          color: COLOR_PRIMARY_HEX,
          font: 'Calibri',
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 50 },
      children: [
        new TextRun({
          text: 'A) Au plan individuel :',
          bold: true,
          size: 19,
          font: 'Calibri',
        }),
      ],
    }),
  ];

  const indivLines = (data.individualRemediation || 'Aucune dÃ©cision saisie.').split('\n').filter(Boolean);
  indivLines.forEach((line) => {
    const text = line.startsWith('â€¢') || line.startsWith('-') ? line : `â€¢ ${line}`;
    decisionParagraphs.push(
      new Paragraph({
        spacing: { after: 30 },
        indent: { left: 280 },
        children: [new TextRun({ text, size: 18, font: 'Calibri' })],
      }),
    );
  });

  decisionParagraphs.push(
    new Paragraph({
      spacing: { before: 80, after: 50 },
      children: [
        new TextRun({
          text: 'B) Au plan de la classe :',
          bold: true,
          size: 19,
          font: 'Calibri',
        }),
      ],
    }),
  );

  const classLines = (data.classRemediation || 'Aucune dÃ©cision saisie.').split('\n').filter(Boolean);
  classLines.forEach((line) => {
    const text = line.startsWith('â€¢') || line.startsWith('-') ? line : `â€¢ ${line}`;
    decisionParagraphs.push(
      new Paragraph({
        spacing: { after: 30 },
        indent: { left: 280 },
        children: [new TextRun({ text, size: 18, font: 'Calibri' })],
      }),
    );
  });

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              width: 15840, // 11 in (Landscape)
              height: 12240, // 8.5 in
              orientation: PageOrientation.LANDSCAPE,
            },
            margin: {
              top: 720, // 0.5 in
              bottom: 720,
              left: 720,
              right: 720,
            },
          },
        },
        children: [...paragraphs, table, ...decisionParagraphs],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  // Copy into a plain ArrayBuffer so TypeScript is happy (no SharedArrayBuffer)
  const plain = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(plain).set(new Uint8Array(buffer));
  return new Uint8Array(plain);
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
        UTI: filename.endsWith('.docx')
          ? 'com.microsoft.word.doc'
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
        <td class="col-val col-pm">${isPlusMinus ? 'Â±' : ''}</td>
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
    <th class="th-sub col-pm">Â±</th>
    <th class="th-sub col-minus">-</th>
  `).join('');

  const totalCells = objTotals.map((tot) => `
    <td class="col-total col-plus">${tot.plus}</td>
    <td class="col-total col-pm">${tot.plusMinus}</td>
    <td class="col-total col-minus">${tot.minus}</td>
  `).join('');

  const indivItems = (data.individualRemediation || 'Aucune dÃ©cision saisie.').split('\n').filter(Boolean)
    .map(line => `<li>${line.replace(/^[â€¢\-]\s*/, '')}</li>`).join('');

  const classItems = (data.classRemediation || 'Aucune dÃ©cision saisie.').split('\n').filter(Boolean)
    .map(line => `<li>${line.replace(/^[â€¢\-]\s*/, '')}</li>`).join('');

  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="utf-8">
      <title>Ã‰valuation â€” ${data.className} â€” ${data.assessment.title}</title>
      <style>
        @page {
          size: A4 landscape;
          margin: 8mm;
        }
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
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
          <span class="meta-label">CompÃ©tence :</span> ${data.assessment.competency} |
          <span class="meta-label">Objectif de la sÃ©ance :</span> ${data.assessment.sessionObjectives || 'Objectifs'} |
          <span class="meta-label">Support :</span> ${data.assessment.support || 'Support pÃ©dagogique'}
        </div>
      </div>

      <div class="objectives-box">
        <div class="objectives-title">Objectifs dâ€™Ã©valuation (${numObjectives} objectifs) :</div>
        <div class="objectives-grid">
          ${data.objectives.map(obj => `
            <div class="objective-item"><strong>${String(obj.order).padStart(2, '0')}.</strong> ${obj.description}</div>
          `).join('')}
        </div>
      </div>

      <div class="section-title">Grille dâ€™analyse des rÃ©sultats â€” Classe : ${data.className}</div>
      <table>
        <thead>
          <tr>
            <th rowspan="2" class="th-num">NÂ°</th>
            <th rowspan="2" class="th-name">Nom et PrÃ©nom</th>
            ${objHeaders}
            <th colspan="3" class="th-obj">Total</th>
          </tr>
          <tr>
            ${subHeaders}
            <th class="th-sub col-plus">+</th>
            <th class="th-sub col-pm">Â±</th>
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
          <h4>A) DÃ©cisions au plan individuel :</h4>
          <ul>${indivItems}</ul>
        </div>
        <div class="remed-card">
          <h4>B) DÃ©cisions au plan de la classe :</h4>
          <ul>${classItems}</ul>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Directly prints or exports PDF for the assessment.
 */
export async function exportAssessmentPdf(data: AssessmentExportData): Promise<void> {
  const html = generateAssessmentPdfHtml(data);
  if (Platform.OS === 'web') {
    await Print.printAsync({ html });
    return;
  }
  try {
    // printToFileAsync writes to a system temp URI that expo-sharing cannot read.
    // Copy it into the app cache dir which is always accessible to sharing.
    const { uri: tempUri } = await Print.printToFileAsync({ html });
    const filename = `Evaluation_${(data.className || 'Classe').replace(/\s+/g, '_')}_${(data.assessment?.title || 'Evaluation').replace(/\s+/g, '_')}.pdf`;
    const cacheDir = LegacyFS.cacheDirectory ?? Paths.cache.uri;
    const destUri = `${cacheDir}${filename}`;

    await LegacyFS.copyAsync({ from: tempUri, to: destUri });

    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(destUri, {
        mimeType: 'application/pdf',
        dialogTitle: `Enregistrer ${filename}`,
        UTI: 'com.adobe.pdf',
      });
    } else {
      Alert.alert('PDF généré', `Le PDF a été créé : ${filename}`);
    }
  } catch (error) {
    console.error('Erreur génération PDF:', error);
    Alert.alert('Erreur', 'Impossible de générer le fichier PDF.');
  }
}

