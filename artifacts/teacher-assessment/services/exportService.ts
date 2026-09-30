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
import ExcelJS from 'exceljs';
// Pure isomorphic export service (runs in Web, Mobile, and Node)

export type AssessmentExportData = {
  school: {
    name: string;
    address: string;
    wilaya: string;
  };
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
 * Generates an Excel (.xlsx) file matching the exact format in the reference image.
 */
export async function generateAssessmentExcel(data: AssessmentExportData): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Teacher Competency Assessment';
  workbook.lastModifiedBy = 'Teacher Competency Assessment';
  workbook.created = new Date();
  workbook.modified = new Date();

  const sheetName = (data.className || 'Évaluation').replace(/[:\\/?*[\]]/g, '-').slice(0, 31);
  const ws = workbook.addWorksheet(sheetName, {
    pageSetup: {
      orientation: 'landscape',
      paperSize: 9, // A4
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      showGridLines: true,
      margins: {
        left: 0.4,
        right: 0.4,
        top: 0.5,
        bottom: 0.5,
        header: 0.3,
        footer: 0.3,
      },
    },
    views: [{ showGridLines: true }],
  });

  const numObjectives = data.objectives.length;
  const totalCols = 2 + numObjectives * 3 + 3; // N°, Nom, [3 cols per obj], [3 cols for Total]

  // Configure Column Widths
  const columns: Partial<ExcelJS.Column>[] = [
    { key: 'num', width: 6 }, // N°
    { key: 'name', width: 30 }, // Nom et Prénom
  ];
  for (let i = 0; i < numObjectives; i++) {
    columns.push({ width: 4 }); // +
    columns.push({ width: 4 }); // ±
    columns.push({ width: 4 }); // -
  }
  // Total 3 columns
  columns.push({ width: 5 }); // Total +
  columns.push({ width: 5 }); // Total ±
  columns.push({ width: 5 }); // Total -
  ws.columns = columns as ExcelJS.Column[];

  let currentRow = 1;

  // 1. Header Metadata: Établissement & Niveau
  const row1 = ws.getRow(currentRow++);
  row1.height = 24;
  row1.getCell(1).value = `Établissement : ${data.school.name || ''}   |   Niveau : ${data.level || ''}`;
  row1.getCell(1).font = { name: 'Calibri', size: 11, bold: true, color: { argb: `FF${COLOR_PRIMARY_HEX}` } };
  row1.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
  ws.mergeCells(row1.number, 1, row1.number, totalCols);

  // 2. Header Metadata: Compétence, Objectif de la séance, Support
  const row2 = ws.getRow(currentRow++);
  row2.height = 20;
  row2.getCell(1).value = `Compétence : ${data.assessment.competency || ''}   |   Objectif de la séance : ${data.assessment.sessionObjectives || ''}   |   Support : ${data.assessment.support || ''}`;
  row2.getCell(1).font = { name: 'Calibri', size: 9.5 };
  row2.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
  ws.mergeCells(row2.number, 1, row2.number, totalCols);

  // 3. Objectifs d'évaluation Title
  const row3 = ws.getRow(currentRow++);
  row3.height = 20;
  row3.getCell(1).value = `Objectifs d’évaluation (${numObjectives} Objectifs) :`;
  row3.getCell(1).font = { name: 'Calibri', size: 10, bold: true, color: { argb: `FF${COLOR_PRIMARY_HEX}` } };
  row3.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
  ws.mergeCells(row3.number, 1, row3.number, totalCols);

  // 4. Objectifs Descriptions list
  data.objectives.forEach((obj, idx) => {
    const objRow = ws.getRow(currentRow++);
    objRow.height = 17;
    const numStr = String(obj.order || idx + 1).padStart(2, '0');
    objRow.getCell(1).value = `${numStr}. ${obj.description}`;
    objRow.getCell(1).font = { name: 'Calibri', size: 9 };
    objRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
    ws.mergeCells(objRow.number, 1, objRow.number, totalCols);
  });

  // Empty spacer
  currentRow++;

  // 5. Grid Title: Grille d’analyse des résultats — Classe : ...
  const gridTitleRow = ws.getRow(currentRow++);
  gridTitleRow.height = 24;
  gridTitleRow.getCell(1).value = `Grille d’analyse des résultats — Classe : ${data.className || ''}`;
  gridTitleRow.getCell(1).font = { name: 'Calibri', size: 11, bold: true, color: { argb: `FF${COLOR_PRIMARY_HEX}` } };
  gridTitleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
  ws.mergeCells(gridTitleRow.number, 1, gridTitleRow.number, totalCols);

  // TABLE HEADERS (3 rows)
  const tblHeaderR1 = currentRow++;
  const tblHeaderR2 = currentRow++;
  const tblHeaderR3 = currentRow++;

  const r1 = ws.getRow(tblHeaderR1);
  const r2 = ws.getRow(tblHeaderR2);
  const r3 = ws.getRow(tblHeaderR3);

  r1.height = 22;
  r2.height = 20;
  r3.height = 18;

  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FF000000' } },
    left: { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'thin', color: { argb: 'FF000000' } },
    right: { style: 'thin', color: { argb: 'FF000000' } },
  };

  // Header 1: N° (Merged across R1, R2, R3)
  r1.getCell(1).value = 'N°';
  ws.mergeCells(tblHeaderR1, 1, tblHeaderR3, 1);

  // Header 2: Nom et Prénom (Merged across R1, R2, R3)
  r1.getCell(2).value = 'Nom et Prénom';
  ws.mergeCells(tblHeaderR1, 2, tblHeaderR3, 2);

  // Header 3: Objectifs d’évaluation (Merged across all objective columns)
  const objStartCol = 3;
  const objEndCol = objStartCol + numObjectives * 3 - 1;
  r1.getCell(objStartCol).value = 'Objectifs d’évaluation';
  ws.mergeCells(tblHeaderR1, objStartCol, tblHeaderR1, objEndCol);

  // Header 4: Total (Merged across 3 total columns in R1 & R2)
  const totalStartCol = objEndCol + 1;
  const totalEndCol = totalStartCol + 2;
  r1.getCell(totalStartCol).value = 'Total';
  ws.mergeCells(tblHeaderR1, totalStartCol, tblHeaderR2, totalEndCol);

  // Row 2: Objective numbers (01, 02, ..., 11)
  data.objectives.forEach((obj, idx) => {
    const colIdx = objStartCol + idx * 3;
    const numLabel = String(obj.order || idx + 1).padStart(2, '0');
    r2.getCell(colIdx).value = numLabel;
    ws.mergeCells(tblHeaderR2, colIdx, tblHeaderR2, colIdx + 2);
  });

  // Row 3: Sub-headers (+, ±, -) for each objective and for Total
  for (let idx = 0; idx < numObjectives; idx++) {
    const colIdx = objStartCol + idx * 3;
    r3.getCell(colIdx).value = '+';
    r3.getCell(colIdx + 1).value = '±';
    r3.getCell(colIdx + 2).value = '-';
  }
  r3.getCell(totalStartCol).value = '+';
  r3.getCell(totalStartCol + 1).value = '±';
  r3.getCell(totalStartCol + 2).value = '-';

  // Apply styling to Table Headers
  for (let r = tblHeaderR1; r <= tblHeaderR3; r++) {
    const row = ws.getRow(r);
    for (let c = 1; c <= totalCols; c++) {
      const cell = row.getCell(c);
      cell.border = thinBorder;
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.font = { name: 'Calibri', size: 9, bold: true };
      if (r === tblHeaderR1 && c >= objStartCol && c <= objEndCol) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${COLOR_HEADER_BG}` } };
      } else if (r === tblHeaderR1 && c >= totalStartCol) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${COLOR_HEADER_BG}` } };
      } else {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${COLOR_SUBHEADER_BG}` } };
      }
    }
  }

  // PUPIL DATA ROWS
  const firstDataRow = currentRow;
  data.pupils.forEach((pupil, pupilIdx) => {
    const pRow = ws.getRow(currentRow++);
    pRow.height = 19;
    const isAlt = pupilIdx % 2 === 1;

    const regNo = pupil.registrationNumber || String(pupilIdx + 1).padStart(2, '0');
    const fullName = `${pupil.lastName || ''} ${pupil.firstName || ''}`.trim();

    pRow.getCell(1).value = regNo;
    pRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };

    pRow.getCell(2).value = fullName;
    pRow.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };

    let pupilPlusCount = 0;
    let pupilPlusMinusCount = 0;
    let pupilMinusCount = 0;

    data.objectives.forEach((obj, objIdx) => {
      const colIdx = objStartCol + objIdx * 3;
      const evalVal = data.evaluations[pupil.id]?.[obj.id] ?? 'NotEvaluated';

      const cellPlus = pRow.getCell(colIdx);
      const cellPlusMinus = pRow.getCell(colIdx + 1);
      const cellMinus = pRow.getCell(colIdx + 2);

      if (evalVal === 'Acquired') {
        cellPlus.value = '+';
        pupilPlusCount++;
      } else if (evalVal === 'PartiallyAcquired') {
        cellPlusMinus.value = '±';
        pupilPlusMinusCount++;
      } else if (evalVal === 'NotAcquired') {
        cellMinus.value = '-';
        pupilMinusCount++;
      }
    });

    // Total columns for this pupil (using Excel formulas with static count fallback)
    const plusColLetterStart = ws.getColumn(objStartCol).letter;
    const minusColLetterEnd = ws.getColumn(objEndCol).letter;
    const rowNum = pRow.number;

    pRow.getCell(totalStartCol).value = {
      formula: `COUNTIF(${plusColLetterStart}${rowNum}:${minusColLetterEnd}${rowNum}, "+")`,
      result: pupilPlusCount,
    };
    pRow.getCell(totalStartCol + 1).value = {
      formula: `COUNTIF(${plusColLetterStart}${rowNum}:${minusColLetterEnd}${rowNum}, "±")`,
      result: pupilPlusMinusCount,
    };
    pRow.getCell(totalStartCol + 2).value = {
      formula: `COUNTIF(${plusColLetterStart}${rowNum}:${minusColLetterEnd}${rowNum}, "-")`,
      result: pupilMinusCount,
    };

    // Format all cells in this pupil row
    for (let c = 1; c <= totalCols; c++) {
      const cell = pRow.getCell(c);
      cell.border = thinBorder;
      cell.font = { name: 'Calibri', size: 9, bold: c > objEndCol };
      if (c !== 2) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      }
      if (isAlt) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${COLOR_TR_ALT_BG}` } };
      }
    }
  });

  const lastDataRow = currentRow - 1;

  // BOTTOM TOTAL ROW
  const totalRow = ws.getRow(currentRow++);
  totalRow.height = 22;
  totalRow.getCell(1).value = 'Total';
  ws.mergeCells(totalRow.number, 1, totalRow.number, 2);

  // Column totals using formulas
  for (let c = objStartCol; c <= totalCols; c++) {
    const colLetter = ws.getColumn(c).letter;
    const cell = totalRow.getCell(c);

    if (c <= objEndCol) {
      // Find symbol for this subcol
      const subIdx = (c - objStartCol) % 3;
      const symbol = subIdx === 0 ? '+' : subIdx === 1 ? '±' : '-';
      cell.value = {
        formula: `COUNTIF(${colLetter}${firstDataRow}:${colLetter}${lastDataRow}, "${symbol}")`,
      };
    } else {
      // Sum the pupil totals
      cell.value = {
        formula: `SUM(${colLetter}${firstDataRow}:${colLetter}${lastDataRow})`,
      };
    }
  }

  // Format Bottom Total Row
  for (let c = 1; c <= totalCols; c++) {
    const cell = totalRow.getCell(c);
    cell.border = thinBorder;
    cell.font = { name: 'Calibri', size: 9, bold: true };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${COLOR_HEADER_BG}` } };
  }

  // Spacer
  currentRow++;

  // 6. Remediation Decisions Section
  const decHeaderRow = ws.getRow(currentRow++);
  decHeaderRow.height = 20;
  decHeaderRow.getCell(1).value = 'Décisions à prendre :';
  decHeaderRow.getCell(1).font = { name: 'Calibri', size: 10, bold: true, color: { argb: `FF${COLOR_PRIMARY_HEX}` } };
  ws.mergeCells(decHeaderRow.number, 1, decHeaderRow.number, totalCols);

  const decIndivTitle = ws.getRow(currentRow++);
  decIndivTitle.height = 18;
  decIndivTitle.getCell(1).value = 'A) Au plan individuel :';
  decIndivTitle.getCell(1).font = { name: 'Calibri', size: 9.5, bold: true };
  ws.mergeCells(decIndivTitle.number, 1, decIndivTitle.number, totalCols);

  const indivLines = (data.individualRemediation || 'Aucune décision saisie.').split('\n').filter(Boolean);
  indivLines.forEach((line) => {
    const r = ws.getRow(currentRow++);
    r.height = 18;
    const text = line.startsWith('•') || line.startsWith('-') ? line : `• ${line}`;
    r.getCell(1).value = `   ${text}`;
    r.getCell(1).font = { name: 'Calibri', size: 9 };
    ws.mergeCells(r.number, 1, r.number, totalCols);
  });

  const decClassTitle = ws.getRow(currentRow++);
  decClassTitle.height = 18;
  decClassTitle.getCell(1).value = 'B) Au plan de la classe :';
  decClassTitle.getCell(1).font = { name: 'Calibri', size: 9.5, bold: true };
  ws.mergeCells(decClassTitle.number, 1, decClassTitle.number, totalCols);

  const classLines = (data.classRemediation || 'Aucune décision saisie.').split('\n').filter(Boolean);
  classLines.forEach((line) => {
    const r = ws.getRow(currentRow++);
    r.height = 18;
    const text = line.startsWith('•') || line.startsWith('-') ? line : `• ${line}`;
    r.getCell(1).value = `   ${text}`;
    r.getCell(1).font = { name: 'Calibri', size: 9 };
    ws.mergeCells(r.number, 1, r.number, totalCols);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

/**
 * Generates a Word (.docx) document matching the exact format in the reference image and notation document.
 */
export async function generateAssessmentDocx(data: AssessmentExportData): Promise<Blob> {
  const numObjectives = data.objectives.length;

  // Column width calculations (landscape 15840 twips - 1440 twips margins = 14400 twips available)
  const colWNum = 440; // N°
  const colWName = 2560; // Nom et Prénom
  const colWObj = 320; // Each objective subcol (+, ±, -)
  const colWTotal = 360; // Each total subcol (+, ±, -)

  const borderSingle = { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER };
  const cellBorders = {
    top: borderSingle,
    bottom: borderSingle,
    left: borderSingle,
    right: borderSingle,
  };

  const tableRows: TableRow[] = [];

  // ROW 1:
  // - N° (rowSpan 3)
  // - Nom et Prénom (rowSpan 3)
  // - Objectifs d’évaluation (columnSpan: numObjectives * 3)
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
              children: [new TextRun({ text: 'N°', bold: true, size: 16, font: 'Calibri' })],
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
              children: [new TextRun({ text: 'Nom et Prénom', bold: true, size: 16, font: 'Calibri' })],
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
              children: [new TextRun({ text: 'Objectifs d’évaluation', bold: true, size: 17, font: 'Calibri' })],
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
  // - (+, ±, -) for each objective
  // - (+, ±, -) for Total
  const r3SubCells: TableCell[] = [];
  for (let idx = 0; idx < numObjectives; idx++) {
    ['+', '±', '-'].forEach((mark) => {
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
  ['+', '±', '-'].forEach((mark) => {
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
        valPlusMinus = '±';
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

  // Line 1: Établissement & Niveau
  paragraphs.push(
    new Paragraph({
      spacing: { after: 70 },
      children: [
        new TextRun({
          text: `Établissement : ${data.school.name || ''} | Niveau : ${data.level || ''}`,
          bold: true,
          size: 22, // 11pt
          color: COLOR_PRIMARY_HEX,
          font: 'Calibri',
        }),
      ],
    }),
  );

  // Line 2: Compétence | Objectif | Support
  paragraphs.push(
    new Paragraph({
      spacing: { after: 120 },
      children: [
        new TextRun({ text: 'Compétence : ', bold: true, size: 19, font: 'Calibri' }),
        new TextRun({ text: `${data.assessment.competency || ''}   |   `, size: 19, font: 'Calibri' }),
        new TextRun({ text: 'Objectif de la séance : ', bold: true, size: 19, font: 'Calibri' }),
        new TextRun({ text: `${data.assessment.sessionObjectives || ''}   |   `, size: 19, font: 'Calibri' }),
        new TextRun({ text: 'Support : ', bold: true, size: 19, font: 'Calibri' }),
        new TextRun({ text: `${data.assessment.support || ''}`, size: 19, font: 'Calibri' }),
      ],
    }),
  );

  // Line 3: Objectifs d’évaluation Title
  paragraphs.push(
    new Paragraph({
      spacing: { after: 50 },
      children: [
        new TextRun({
          text: `Objectifs d’évaluation (${numObjectives} Objectifs) :`,
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

  // Table Title: Grille d’analyse des résultats
  paragraphs.push(
    new Paragraph({
      spacing: { before: 140, after: 80 },
      children: [
        new TextRun({
          text: `Grille d’analyse des résultats — Classe : ${data.className || ''}`,
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
          text: 'Décisions à prendre :',
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

  const indivLines = (data.individualRemediation || 'Aucune décision saisie.').split('\n').filter(Boolean);
  indivLines.forEach((line) => {
    const text = line.startsWith('•') || line.startsWith('-') ? line : `• ${line}`;
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

  const classLines = (data.classRemediation || 'Aucune décision saisie.').split('\n').filter(Boolean);
  classLines.forEach((line) => {
    const text = line.startsWith('•') || line.startsWith('-') ? line : `• ${line}`;
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

  return await Packer.toBlob(doc);
}

/**
 * Triggers a browser download for the generated blob or arraybuffer.
 */
export function downloadFile(
  content: Blob | ArrayBuffer | Uint8Array,
  filename: string,
  mimeType: string,
) {
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const blob = content instanceof Blob ? content : new Blob([content as any], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } else {
    // If running inside React Native native app, we can use Share or FileSystem
    console.log(`Download triggered for ${filename} (${mimeType})`);
  }
}
