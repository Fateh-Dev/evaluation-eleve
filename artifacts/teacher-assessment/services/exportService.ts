import { File as ExpoFile, Paths } from 'expo-file-system';
import * as LegacyFS from 'expo-file-system/legacy';
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
        UTI: filename.endsWith('.csv')
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
