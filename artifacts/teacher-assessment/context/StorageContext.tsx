import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as LegacyFS from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import React, { PropsWithChildren, createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Linking, Platform } from 'react-native';
import {
  deleteWebPdf,
  getWebPdf,
  getWebPdfId,
  getWebPdfUri,
  hasWebPdf,
  saveWebPdf,
} from '@/services/webPdfStorage';
import { getDocumentMimeType, isSupportedDocument } from '@/services/documentMedia';

export type StoredDocument = {
  id: string;
  name: string;
  uri: string;
  mimeType?: string;
  folderId?: string | null;
  size?: number;
  createdAt: string;
};

export type StoredPdf = StoredDocument;

export type StorageFolder = {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
};

type DeletedDocument = StoredDocument & { deletedAt: string };
type DeletedPdf = DeletedDocument;

type BackupDocument = (StoredDocument | DeletedDocument) & { contentBase64: string };
type BackupPdf = BackupDocument;

export type DocumentLibraryBackup = {
  version: 1;
  folders: StorageFolder[];
  files: BackupDocument[];
  trash: BackupDocument[];
};

export type PdfLibraryBackup = DocumentLibraryBackup;

type StorageContextValue = {
  files: StoredDocument[];
  folders: StorageFolder[];
  trash: DeletedDocument[];
  hydrated: boolean;
  usageBytes: number;
  availableBytes: number | null;
  lowSpace: boolean;
  uploadDocuments: (folderId?: string | null) => Promise<void>;
  createFolder: (name: string, parentId: string | null) => Promise<void>;
  deleteFolder: (folderId: string) => Promise<void>;
  moveDocumentToFolder: (fileId: string, folderId: string | null) => Promise<void>;
  openDocument: (file: StoredDocument) => Promise<void>;
  deleteDocument: (file: StoredDocument) => Promise<void>;
  restoreDocument: (file: DeletedDocument) => Promise<void>;
  emptyTrash: () => Promise<void>;
  renameDocument: (file: StoredDocument, name: string) => Promise<void>;
  refreshStorage: () => Promise<void>;
  getBackupData: () => Promise<PdfLibraryBackup>;
  validateBackupData: (backup: unknown) => void;
  restoreBackupData: (backup: unknown) => Promise<void>;
};

const STORAGE_KEY = 'teacher-assessment-pdf-library-v1';
const FOLDERS_KEY = 'teacher-assessment-pdf-folders-v1';
const TRASH_KEY = 'teacher-assessment-pdf-trash-v1';
const DIRECTORY_NAME = 'teacher-storage';
const MAX_DOCUMENT_SIZE = 200 * 1024 * 1024;
const LOW_SPACE_LIMIT = 100 * 1024 * 1024;
const StorageContext = createContext<StorageContextValue | null>(null);

function cleanDocumentName(name: string, fallback: string) {
  const normalized = name.trim().replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_');
  return normalized || fallback;
}

function blobToBase64(blob: Blob, name: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error(`Le contenu de « ${name} » ne peut pas être encodé pour la sauvegarde.`));
        return;
      }
      const separator = reader.result.indexOf(',');
      if (separator < 0) {
        reject(new Error(`Le contenu de « ${name} » ne peut pas être encodé pour la sauvegarde.`));
        return;
      }
      resolve(reader.result.slice(separator + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error(`Impossible de lire « ${name} » pour la sauvegarde.`));
    reader.readAsDataURL(blob);
  });
}

function isBackupDocument(value: unknown, requireDeletedAt: boolean): value is BackupDocument {
  if (!value || typeof value !== 'object') return false;
  const file = value as Partial<BackupPdf>;
  return typeof file.id === 'string' &&
    typeof file.name === 'string' &&
    typeof file.uri === 'string' &&
    (file.mimeType === undefined || (typeof file.mimeType === 'string' && isSupportedDocument(file.name, file.mimeType))) &&
    (file.folderId === undefined || file.folderId === null || typeof file.folderId === 'string') &&
    (file.size === undefined || (typeof file.size === 'number' && Number.isFinite(file.size) && file.size >= 0)) &&
    typeof file.createdAt === 'string' &&
    (!requireDeletedAt || ('deletedAt' in file && typeof file.deletedAt === 'string')) &&
    typeof file.contentBase64 === 'string' &&
    /^[A-Za-z0-9+/]*={0,2}$/.test(file.contentBase64) &&
    file.contentBase64.length % 4 !== 1 &&
    file.contentBase64.length <= Math.ceil(MAX_DOCUMENT_SIZE / 3) * 4 + 4;
}

function validateDocumentLibraryBackup(backup: unknown): asserts backup is DocumentLibraryBackup {
  if (!backup || typeof backup !== 'object') throw new Error('La bibliothèque de documents de la sauvegarde est invalide.');
  const candidate = backup as Partial<DocumentLibraryBackup>;
  if (
    candidate.version !== 1 ||
    !Array.isArray(candidate.folders) ||
    !candidate.folders.every((folder) =>
      Boolean(folder) &&
      typeof folder.id === 'string' &&
      typeof folder.name === 'string' &&
      (folder.parentId === null || typeof folder.parentId === 'string') &&
      typeof folder.createdAt === 'string',
    ) ||
    !Array.isArray(candidate.files) ||
    !candidate.files.every((file) => isBackupDocument(file, false)) ||
    !Array.isArray(candidate.trash) ||
    !candidate.trash.every((file) => isBackupDocument(file, true))
  ) {
    throw new Error('La bibliothèque de documents de la sauvegarde est incomplète ou invalide.');
  }
  const folderIds = new Set(candidate.folders.map((folder) => folder.id));
  if (folderIds.size !== candidate.folders.length) {
    throw new Error('La sauvegarde contient des identifiants de dossier en double.');
  }
  if (candidate.folders.some((folder) => folder.parentId && !folderIds.has(folder.parentId))) {
    throw new Error('La sauvegarde contient un dossier parent introuvable.');
  }
  const foldersById = new Map(candidate.folders.map((folder) => [folder.id, folder]));
  for (const folder of candidate.folders) {
    const ancestors = new Set<string>();
    let current: StorageFolder | undefined = folder;
    while (current) {
      if (ancestors.has(current.id)) throw new Error('La sauvegarde contient une boucle de dossiers.');
      ancestors.add(current.id);
      current = current.parentId ? foldersById.get(current.parentId) : undefined;
    }
  }
  if ([...candidate.files, ...candidate.trash].some((file) => file.folderId && !folderIds.has(file.folderId))) {
    throw new Error('La sauvegarde contient un document rattaché à un dossier introuvable.');
  }
  const documentIds = [...candidate.files, ...candidate.trash].map((file) => file.id);
  if (new Set(documentIds).size !== documentIds.length) {
    throw new Error('La sauvegarde contient des identifiants de document en double.');
  }
}

function newDocumentId() {
  return `document-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function StorageProvider({ children }: PropsWithChildren) {
  const [files, setFiles] = useState<StoredDocument[]>([]);
  const [folders, setFolders] = useState<StorageFolder[]>([]);
  const [trash, setTrash] = useState<DeletedDocument[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [availableBytes, setAvailableBytes] = useState<number | null>(null);

  const refreshStorage = async () => {
    if (Platform.OS === 'web') {
      setAvailableBytes(null);
      return;
    }
    try {
      setAvailableBytes(await LegacyFS.getFreeDiskStorageAsync());
    } catch {
      setAvailableBytes(null);
    }
  };

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(STORAGE_KEY),
      AsyncStorage.getItem(TRASH_KEY),
      AsyncStorage.getItem(FOLDERS_KEY),
    ]).then(([stored, storedTrash, storedFolders]) => {
      try {
        const parsed = stored ? JSON.parse(stored) : [];
        if (Array.isArray(parsed)) setFiles(parsed);
        const parsedTrash = storedTrash ? JSON.parse(storedTrash) : [];
        if (Array.isArray(parsedTrash)) setTrash(parsedTrash);
        const parsedFolders = storedFolders ? JSON.parse(storedFolders) : [];
        if (Array.isArray(parsedFolders)) setFolders(parsedFolders);
      } catch {
        setFiles([]);
        setTrash([]);
        setFolders([]);
      }
    }).finally(() => {
      setHydrated(true);
      void refreshStorage();
    });
  }, []);

  useEffect(() => {
    if (hydrated) void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(files));
  }, [files, hydrated]);

  useEffect(() => {
    if (hydrated) void AsyncStorage.setItem(TRASH_KEY, JSON.stringify(trash));
  }, [trash, hydrated]);

  useEffect(() => {
    if (hydrated) void AsyncStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
  }, [folders, hydrated]);

  const usageBytes = useMemo(() => files.reduce((sum, file) => sum + (file.size ?? 0), 0), [files]);
  const lowSpace = availableBytes !== null && availableBytes < LOW_SPACE_LIMIT;

  const value = useMemo<StorageContextValue>(() => ({
    files,
    folders,
    trash,
    hydrated,
    usageBytes,
    availableBytes,
    lowSpace,
    uploadDocuments: async (folderId = null) => {
      if (folderId && !folders.some((folder) => folder.id === folderId)) {
        throw new Error('Le dossier sélectionné est introuvable.');
      }
      await refreshStorage();
      if (availableBytes !== null && availableBytes < LOW_SPACE_LIMIT) throw new Error('Espace disponible insuffisant. Libérez de l’espace avant d’ajouter des documents.');
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*', 'video/*'],
        copyToCacheDirectory: Platform.OS !== 'android',
        multiple: true,
      });
      if (result.canceled || !result.assets?.length) return;
      for (const picked of result.assets) {
        const mimeType = getDocumentMimeType(picked.name, picked.mimeType);
        if (!isSupportedDocument(picked.name, mimeType)) {
          throw new Error(`« ${picked.name} » n’est pas un type de document pris en charge. Choisissez un PDF, une image ou une vidéo.`);
        }
        const pickedSize = picked.size ?? picked.file?.size;
        if (pickedSize && pickedSize > MAX_DOCUMENT_SIZE) {
          throw new Error(`« ${picked.name} » dépasse la taille maximale autorisée de 200 Mo.`);
        }
        if (Platform.OS === 'web' && !picked.file) {
          throw new Error(`Le navigateur n’a pas fourni le contenu du fichier « ${picked.name} ».`);
        }
      }

      const imported: StoredDocument[] = [];
      const createdWebPdfIds: string[] = [];
      const createdNativeFiles: File[] = [];
      try {
        for (const picked of result.assets) {
          const id = newDocumentId();
          const originalName = cleanDocumentName(picked.name, `document-${id}`);
          const mimeType = getDocumentMimeType(picked.name, picked.mimeType);
          if (Platform.OS === 'web') {
            if (!picked.file) {
              throw new Error(`Le navigateur n’a pas fourni le contenu du fichier « ${picked.name} ».`);
            }
            await saveWebPdf(id, picked.file);
            createdWebPdfIds.push(id);
            imported.push({
              id,
              name: originalName,
              uri: getWebPdfUri(id),
              mimeType,
              folderId,
              size: picked.size ?? picked.file.size,
              createdAt: new Date().toISOString(),
            });
            continue;
          }
          const directory = new Directory(Paths.document, DIRECTORY_NAME, id);
          directory.create({ intermediates: true, idempotent: true });
          const destination = new File(directory, originalName);
          createdNativeFiles.push(destination);
          await LegacyFS.copyAsync({ from: picked.uri, to: destination.uri });
          if (!destination.exists || destination.size <= 0) {
            throw new Error(`La copie de « ${picked.name} » dans le stockage de l’application a échoué.`);
          }
          if (destination.size > MAX_DOCUMENT_SIZE) {
            throw new Error(`« ${picked.name} » dépasse la taille maximale autorisée de 200 Mo.`);
          }
          imported.push({
            id,
            name: originalName,
            uri: destination.uri,
            mimeType,
            folderId,
            size: destination.size,
            createdAt: new Date().toISOString(),
          });
        }
      } catch (error) {
        if (Platform.OS === 'web') {
          await Promise.allSettled(createdWebPdfIds.map((id) => deleteWebPdf(id)));
        } else {
          await Promise.allSettled(createdNativeFiles.map((file) =>
            file.exists ? file.delete() : Promise.resolve(),
          ));
        }
        throw error;
      }

      setFiles((current) => [...imported.reverse(), ...current]);
      await refreshStorage();
    },
    createFolder: async (name, parentId) => {
      const normalizedName = name.trim();
      if (!normalizedName) throw new Error('Saisissez un nom de dossier.');
      if (parentId && !folders.some((folder) => folder.id === parentId)) {
        throw new Error('Le dossier parent est introuvable.');
      }
      if (folders.some((folder) => folder.parentId === parentId && folder.name.toLocaleLowerCase() === normalizedName.toLocaleLowerCase())) {
        throw new Error('Un dossier portant ce nom existe déjà à cet emplacement.');
      }
      setFolders((current) => [{
        id: `folder-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: normalizedName,
        parentId,
        createdAt: new Date().toISOString(),
      }, ...current]);
    },
    deleteFolder: async (folderId) => {
      const folder = folders.find((item) => item.id === folderId);
      if (!folder) throw new Error('Le dossier est introuvable.');
      if (
        folders.some((item) => item.parentId === folderId) ||
        files.some((file) => file.folderId === folderId) ||
        trash.some((file) => file.folderId === folderId)
      ) {
        throw new Error('Ce dossier n’est pas vide. Déplacez son contenu ou restaurez/supprimez définitivement les documents de la corbeille.');
      }
      setFolders((current) => current.filter((item) => item.id !== folderId));
    },
    moveDocumentToFolder: async (fileId, folderId) => {
      if (!files.some((file) => file.id === fileId)) throw new Error('Le document est introuvable.');
      if (folderId && !folders.some((folder) => folder.id === folderId)) {
        throw new Error('Le dossier de destination est introuvable.');
      }
      setFiles((current) => current.map((file) => file.id === fileId ? { ...file, folderId } : file));
    },
    openDocument: async (file) => {
      const stored = new File(file.uri);
      if (!stored.exists || !stored.size) throw new Error('Ce document est introuvable ou semble endommagé.');
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType: getDocumentMimeType(file.name, file.mimeType), dialogTitle: file.name });
      else await Linking.openURL(file.uri);
    },
    deleteDocument: async (file) => {
      setFiles((current) => current.filter((item) => item.id !== file.id));
      setTrash((current) => [{ ...file, deletedAt: new Date().toISOString() }, ...current.filter((item) => item.id !== file.id)]);
    },
    restoreDocument: async (file) => {
      const available = Platform.OS === 'web'
        ? await hasWebPdf(file.id)
        : new File(file.uri).exists;
      if (!available) throw new Error('Le fichier supprimé n’est plus disponible pour restauration.');
      setTrash((current) => current.filter((item) => item.id !== file.id));
      setFiles((current) => [file, ...current.filter((item) => item.id !== file.id)]);
    },
    emptyTrash: async () => {
      const results = await Promise.allSettled(trash.map(async (file) => {
        if (Platform.OS === 'web') {
          await deleteWebPdf(file.id);
        } else {
          const stored = new File(file.uri);
          if (stored.exists) stored.delete();
        }
        return file.id;
      }));
      const failedIds = new Set<string>();
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          failedIds.add(trash[index].id);
        }
      });
      setTrash((current) => current.filter((file) => failedIds.has(file.id)));
      if (Platform.OS !== 'web') await refreshStorage();
      if (failedIds.size > 0) {
        throw new Error(
          `${failedIds.size} fichier${failedIds.size > 1 ? 's' : ''} n’a${failedIds.size > 1 ? 'ont' : ''} pas pu être supprimé${failedIds.size > 1 ? 's' : ''}. Ils restent dans la corbeille.`,
        );
      }
    },
    renameDocument: async (file, name) => {
      const nextName = cleanDocumentName(name, file.name);
      if (Platform.OS === 'web') {
        if (!(await hasWebPdf(file.id))) throw new Error('Ce document est introuvable.');
        setFiles((current) => current.map((item) => item.id === file.id ? { ...item, name: nextName } : item));
        return;
      }
      const currentFile = new File(file.uri);
      if (!currentFile.exists) throw new Error('Ce document est introuvable.');
      currentFile.rename(nextName);
      setFiles((current) => current.map((item) => item.id === file.id ? { ...item, name: nextName, uri: currentFile.uri.replace(/[^/]+$/, nextName) } : item));
    },
    refreshStorage,
    getBackupData: async () => {
      const encodeFile = async (file: StoredDocument | DeletedDocument): Promise<BackupDocument> => {
        const contentBase64 = Platform.OS === 'web'
          ? await blobToBase64(await getWebPdf(getWebPdfId(file.uri)), file.name)
          : await LegacyFS.readAsStringAsync(file.uri, { encoding: LegacyFS.EncodingType.Base64 });
        if (!contentBase64) throw new Error(`Le document « ${file.name} » est vide ou illisible.`);
        return { ...file, contentBase64 };
      };
      const [backupFiles, backupTrash] = await Promise.all([
        Promise.all(files.map(encodeFile)),
        Promise.all(trash.map(encodeFile)),
      ]);
      return { version: 1, folders, files: backupFiles, trash: backupTrash };
    },
    validateBackupData: (backup) => {
      validateDocumentLibraryBackup(backup);
    },
    restoreBackupData: async (backup) => {
      validateDocumentLibraryBackup(backup);
      const candidate = backup;
      const created: Array<{ id: string; uri: string }> = [];
      const restoreFile = async (file: BackupDocument, deleted: boolean): Promise<StoredDocument | DeletedDocument> => {
        const id = newDocumentId();
        const mimeType = getDocumentMimeType(file.name, file.mimeType);
        const { contentBase64: _contentBase64, ...metadata } = file;
        if (Platform.OS === 'web') {
          const binary = atob(file.contentBase64);
          const bytes = new Uint8Array(binary.length);
          for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
          await saveWebPdf(id, new Blob([bytes], { type: mimeType }));
          const uri = getWebPdfUri(id);
          created.push({ id, uri });
          return { ...metadata, id, uri, mimeType, size: file.size ?? bytes.byteLength } as StoredDocument | DeletedDocument;
        }
        const directory = new Directory(Paths.document, DIRECTORY_NAME, id);
        directory.create({ intermediates: true, idempotent: true });
        const restoredFile = new File(directory, cleanDocumentName(file.name, `document-${id}`));
        created.push({ id, uri: restoredFile.uri });
        await LegacyFS.writeAsStringAsync(restoredFile.uri, file.contentBase64, {
          encoding: LegacyFS.EncodingType.Base64,
        });
        if (!restoredFile.exists || restoredFile.size <= 0) {
          throw new Error(`Le document « ${file.name} » n’a pas pu être restauré.`);
        }
        const restoredMetadata = { ...metadata, id, uri: restoredFile.uri, size: restoredFile.size };
        return deleted
          ? restoredMetadata as DeletedPdf
          : restoredMetadata as StoredDocument;
      };
      try {
        const restoredFiles = await Promise.all(candidate.files.map((file) => restoreFile(file, false)));
        const restoredTrash = await Promise.all(candidate.trash.map((file) => restoreFile(file, true)));
        const oldFiles = [...files, ...trash];
        setFiles(restoredFiles as StoredPdf[]);
        setTrash(restoredTrash as DeletedPdf[]);
        setFolders(candidate.folders);
        if (Platform.OS === 'web') {
          const deletions = await Promise.allSettled(oldFiles.map((file) => deleteWebPdf(getWebPdfId(file.uri))));
          deletions.filter((result) => result.status === 'rejected').forEach((result) => {
            console.warn('Impossible de nettoyer un ancien document après restauration.', result.reason);
          });
        } else {
          const deletions = oldFiles.map((file) => {
            const stored = new File(file.uri);
            return stored.exists ? stored.delete() : Promise.resolve();
          });
          const results = await Promise.allSettled(deletions);
          results.filter((result) => result.status === 'rejected').forEach((result) => {
            console.warn('Impossible de nettoyer un ancien document après restauration.', result.reason);
          });
          await refreshStorage();
        }
      } catch (error) {
        if (Platform.OS === 'web') {
          await Promise.allSettled(created.map(({ id }) => deleteWebPdf(id)));
        } else {
          created.forEach(({ uri }) => {
            const stored = new File(uri);
            if (stored.exists) stored.delete();
          });
        }
        throw error;
      }
    },
  }), [files, folders, trash, hydrated, usageBytes, availableBytes, lowSpace]);

  return <StorageContext.Provider value={value}>{children}</StorageContext.Provider>;
}

export function useStorage() {
  const context = useContext(StorageContext);
  if (!context) throw new Error('useStorage must be used within StorageProvider');
  return context;
}
