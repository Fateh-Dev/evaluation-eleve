import {
  getDocumentMediaType,
  getDocumentMimeType,
  isSupportedDocument,
} from './documentMedia.ts';

function assertEqual<T>(actual: T, expected: T, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: attendu ${String(expected)}, obtenu ${String(actual)}.`);
  }
}

assertEqual(getDocumentMediaType('cours.pdf'), 'pdf', 'Les PDF sont reconnus par leur extension');
assertEqual(getDocumentMediaType('photo.png', 'image/png'), 'image', 'Les images sont reconnues par leur type MIME');
assertEqual(getDocumentMediaType('cours.mp4', 'application/octet-stream'), 'video', 'Les vidéos sans type MIME utile sont reconnues par leur extension');
assertEqual(getDocumentMimeType('photo.jpg'), 'image/jpeg', 'Le type MIME d’une image est déduit de son extension');
assertEqual(isSupportedDocument('notes.docx'), false, 'Les formats non pris en charge sont rejetés');

console.log('Tests de types de documents réussis.');
