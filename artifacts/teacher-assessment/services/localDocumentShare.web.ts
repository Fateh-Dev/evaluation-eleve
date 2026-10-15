import type { StoredDocument } from '@/context/StorageContext';
import type { LocalDocumentShare } from './localDocumentShare.types';

export async function startLocalDocumentShare(_file: StoredDocument): Promise<LocalDocumentShare> {
  throw new Error('Le partage par QR Wi-Fi est disponible dans l’application Android ou iOS.');
}
