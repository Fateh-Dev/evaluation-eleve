type ArabicSchedulePdfData = {
  title: string;
  subtitle: string;
  footer: string;
  times: string[];
  days: string[];
  cells: Record<string, string>;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character] ?? character);
}

function cellHtml(value: string | undefined) {
  if (!value) return '<span class="empty">---</span>';
  return escapeHtml(value).replace(/\n/g, '<br>');
}

export function generateArabicSchedulePdfHtml(data: ArabicSchedulePdfData): string {
  const timeHeaders = data.times.slice().reverse().map((time) => `<th>${escapeHtml(time)}</th>`).join('');
  const rows = data.days.map((day) => {
    const cells = data.times.slice().reverse().map((time) => `<td>${cellHtml(data.cells[`${day}|${time}`])}</td>`).join('');
    return `<tr><th class="day">${escapeHtml(day)}</th>${cells}</tr>`;
  }).join('');
  return `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${escapeHtml(data.title)}</title>
<style>
@page { size: A4 landscape; margin: 9mm; }
* { box-sizing: border-box; }
body { margin: 0; color: #172b35; background: #fff; font-family: Tahoma, Arial, sans-serif; direction: rtl; }
.header { text-align: center; margin: 0 0 8px; }
h1 { font-size: 20px; margin: 0 0 3px; font-weight: 800; }
.subtitle { font-size: 16px; margin: 0; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; direction: rtl; }
th, td { border: 1px solid #7e807e; text-align: center; vertical-align: middle; height: 47px; padding: 3px 2px; font-size: 12px; line-height: 1.25; }
thead th { background: #f3f1ed; height: 32px; font-size: 13px; font-weight: 800; }
th.day { width: 8.5%; background: #faf8f3; font-size: 14px; }
td { width: 11.45%; }
td:empty { background: #fff; }
.empty { color: #5b6465; letter-spacing: 1px; }
.footer { text-align: center; margin-top: 7px; font-size: 10px; color: #414a4c; }
@media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
</style></head><body>
<div class="header"><h1>${escapeHtml(data.title)}</h1><p class="subtitle">${escapeHtml(data.subtitle)}</p></div>
<table><thead><tr><th class="day">التوقيت</th>${timeHeaders}</tr></thead><tbody>${rows}</tbody></table>
<div class="footer">${escapeHtml(data.footer)}</div>
</body></html>`;
}
