export function cleanSharedFilename(name: string) {
  const cleaned = name.trim().replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_');
  return cleaned && cleaned !== '.' && cleaned !== '..' ? cleaned : 'document';
}

export function getLocalShareContentFilename(name: string) {
  return `document-${cleanSharedFilename(name)}`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function createLocalSharePage(filename: string) {
  const safeName = cleanSharedFilename(filename);
  const downloadPath = encodeURIComponent(getLocalShareContentFilename(safeName));
  const escapedName = escapeHtml(safeName);
  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>Recevoir un document</title>
  <style>
    body{font-family:system-ui,sans-serif;margin:0;background:#f6f7fb;color:#17212b;min-height:100vh;display:grid;place-items:center}
    main{box-sizing:border-box;width:min(100% - 32px,440px);padding:28px;background:#fff;border:1px solid #e3e7ee;border-radius:20px;box-shadow:0 12px 40px #17212b18}
    h1{font-size:22px;margin:0 0 12px}p{line-height:1.55;color:#54616e}
    a{display:block;margin-top:22px;padding:15px;border-radius:12px;background:#1b6a62;color:#fff;text-align:center;text-decoration:none;font-weight:700}
    small{display:block;margin-top:18px;color:#687581}
  </style>
</head>
<body>
  <main>
    <h1>Recevoir un document</h1>
    <p>${escapedName}</p>
    <p>Le transfert se fait directement sur le réseau Wi-Fi local. Aucune connexion Internet n’est utilisée.</p>
    <a href="./${downloadPath}" download="${escapedName}">Télécharger le document</a>
    <small>Le lien temporaire expire automatiquement.</small>
  </main>
</body>
</html>`;
}

export function createLocalShareRootPage() {
  return `<!doctype html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="robots" content="noindex, nofollow"><title>Partage temporaire</title></head>
<body><p>Ce partage est temporaire. Scannez le QR code fourni par l’expéditeur.</p></body>
</html>`;
}
