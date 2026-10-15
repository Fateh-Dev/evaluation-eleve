const DATABASE_NAME = 'teacher-assessment-pdf-library';
const STORE_NAME = 'pdf-files';
const WEB_PDF_URI_PREFIX = 'web-pdf:';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Impossible d’ouvrir le stockage de documents du navigateur.'));
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Impossible d’accéder au document enregistré.'));
  });
}

export function getWebPdfUri(id: string): string {
  return `${WEB_PDF_URI_PREFIX}${id}`;
}

export function isWebPdfUri(uri: string): boolean {
  return uri.startsWith(WEB_PDF_URI_PREFIX);
}

export function getWebPdfId(uri: string): string {
  return uri.slice(WEB_PDF_URI_PREFIX.length);
}

export async function saveWebPdf(id: string, file: Blob): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    await requestResult(transaction.objectStore(STORE_NAME).put(file, id));
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Impossible d’enregistrer le document dans le navigateur.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('L’enregistrement du document a été interrompu.'));
    });
  } finally {
    database.close();
  }
}

export async function getWebPdf(id: string): Promise<Blob> {
  const database = await openDatabase();
  try {
    const file = await requestResult(database.transaction(STORE_NAME).objectStore(STORE_NAME).get(id)) as Blob | undefined;
    if (!file) throw new Error('Ce document est introuvable dans le stockage du navigateur.');
    return file;
  } finally {
    database.close();
  }
}

export async function hasWebPdf(id: string): Promise<boolean> {
  const database = await openDatabase();
  try {
    const file = await requestResult(database.transaction(STORE_NAME).objectStore(STORE_NAME).getKey(id));
    return file !== undefined;
  } finally {
    database.close();
  }
}

export async function deleteWebPdf(id: string): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).delete(id);
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Impossible de supprimer le document du navigateur.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('La suppression du document a été interrompue.'));
    });
  } finally {
    database.close();
  }
}
