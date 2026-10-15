import {
  cleanSharedFilename,
  createLocalSharePage,
  createLocalShareRootPage,
  getLocalShareContentFilename,
} from './localDocumentShareContent.ts';

function assertEqual<T>(actual: T, expected: T, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: attendu ${String(expected)}, obtenu ${String(actual)}.`);
  }
}

const filename = 'Cours & important.pdf';
const page = createLocalSharePage(filename);

assertEqual(cleanSharedFilename('  cours:maths.pdf  '), 'cours_maths.pdf', 'Les caractères de chemin et de contrôle sont nettoyés');
assertEqual(cleanSharedFilename('..'), 'document', 'Les noms assimilables à un chemin parent sont rejetés');
assertEqual(getLocalShareContentFilename('index.html'), 'document-index.html', 'Le fichier ne peut pas écraser la page de téléchargement');
assertEqual(page.includes('Cours &amp; important.pdf'), true, 'Le nom de fichier est échappé dans le HTML');
assertEqual(page.includes('href="./document-Cours%20%26%20important.pdf"'), true, 'Le lien relatif encode le nom du fichier dans le dossier QR');
assertEqual(page.includes('Aucune connexion Internet'), true, 'La page indique que le transfert reste local');
assertEqual(createLocalShareRootPage().includes('Scannez le QR code'), true, 'La racine ne révèle pas le dossier temporaire');

console.log('Tests du partage local réussis.');
