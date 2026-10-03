import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as LegacyFS from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import React, { PropsWithChildren, createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Linking } from 'react-native';

export type StoredPdf = {
  id: string;
  name: string;
  uri: string;
  size?: number;
  createdAt: string;
};

type DeletedPdf = StoredPdf & { deletedAt: string };

type StorageContextValue = {
  files: StoredPdf[];
  trash: DeletedPdf[];
  hydrated: boolean;
  usageBytes: number;
  availableBytes: number | null;
  lowSpace: boolean;
  uploadPdf: () => Promise<void>;
  openPdf: (file: StoredPdf) => Promise<void>;
  deletePdf: (file: StoredPdf) => Promise<void>;
  restorePdf: (file: DeletedPdf) => Promise<void>;
  emptyTrash: () => Promise<void>;
  renamePdf: (file: StoredPdf, name: string) => Promise<void>;
  refreshStorage: () => Promise<void>;
};

const STORAGE_KEY = 'teacher-assessment-pdf-library-v1';
const TRASH_KEY = 'teacher-assessment-pdf-trash-v1';
const DIRECTORY_NAME = 'teacher-storage';
const MAX_PDF_SIZE = 50 * 1024 * 1024;
const LOW_SPACE_LIMIT = 100 * 1024 * 1024;
const StorageContext = createContext<StorageContextValue | null>(null);

function cleanPdfName(name: string, fallback: string) {
  const normalized = name.trim().replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_');
  if (!normalized) return fallback;
  return normalized.toLowerCase().endsWith('.pdf') ? normalized : `${normalized}.pdf`;
}

export function StorageProvider({ children }: PropsWithChildren) {
  const [files, setFiles] = useState<StoredPdf[]>([]);
  const [trash, setTrash] = useState<DeletedPdf[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [availableBytes, setAvailableBytes] = useState<number | null>(null);

  const refreshStorage = async () => {
    try {
      setAvailableBytes(await LegacyFS.getFreeDiskStorageAsync());
    } catch {
      setAvailableBytes(null);
    }
  };

  useEffect(() => {
    Promise.all([AsyncStorage.getItem(STORAGE_KEY), AsyncStorage.getItem(TRASH_KEY)]).then(([stored, storedTrash]) => {
      try {
        const parsed = stored ? JSON.parse(stored) : [];
        if (Array.isArray(parsed)) setFiles(parsed);
        const parsedTrash = storedTrash ? JSON.parse(storedTrash) : [];
        if (Array.isArray(parsedTrash)) setTrash(parsedTrash);
      } catch {
        setFiles([]);
        setTrash([]);
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

  const usageBytes = useMemo(() => files.reduce((sum, file) => sum + (file.size ?? 0), 0), [files]);
  const lowSpace = availableBytes !== null && availableBytes < LOW_SPACE_LIMIT;

  const value = useMemo<StorageContextValue>(() => ({
    files,
    trash,
    hydrated,
    usageBytes,
    availableBytes,
    lowSpace,
    uploadPdf: async () => {
      await refreshStorage();
      if (availableBytes !== null && availableBytes < LOW_SPACE_LIMIT) throw new Error('Espace disponible insuffisant. Libérez de l’espace avant d’ajouter un PDF.');
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: false, multiple: false });
      if (result.canceled || !result.assets?.[0]) return;
      const picked = result.assets[0];
      if (picked.mimeType && picked.mimeType !== 'application/pdf') throw new Error('Seuls les fichiers PDF sont acceptés.');
      if (picked.size && picked.size > MAX_PDF_SIZE) throw new Error('La taille maximale autorisée est de 50 Mo.');
      const id = `pdf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const originalName = cleanPdfName(picked.name, `${id}.pdf`);
      const directory = new Directory(Paths.document, DIRECTORY_NAME, id);
      directory.create({ intermediates: true, idempotent: true });
      const destination = new File(directory, originalName);
      await new File(picked.uri).copy(destination, { overwrite: true });
      setFiles((current) => [{ id, name: originalName, uri: destination.uri, size: picked.size, createdAt: new Date().toISOString() }, ...current]);
      await refreshStorage();
    },
    openPdf: async (file) => {
      const stored = new File(file.uri);
      if (!stored.exists || !stored.size) throw new Error('Ce fichier PDF est introuvable ou semble endommagé.');
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', dialogTitle: file.name });
      else await Linking.openURL(file.uri);
    },
    deletePdf: async (file) => {
      setFiles((current) => current.filter((item) => item.id !== file.id));
      setTrash((current) => [{ ...file, deletedAt: new Date().toISOString() }, ...current.filter((item) => item.id !== file.id)]);
    },
    restorePdf: async (file) => {
      if (!new File(file.uri).exists) throw new Error('Le fichier supprimé n’est plus disponible pour restauration.');
      setTrash((current) => current.filter((item) => item.id !== file.id));
      setFiles((current) => [file, ...current.filter((item) => item.id !== file.id)]);
    },
    emptyTrash: async () => {
      trash.forEach((file) => { try { const stored = new File(file.uri); if (stored.exists) stored.delete(); } catch { /* best effort */ } });
      setTrash([]);
      await refreshStorage();
    },
    renamePdf: async (file, name) => {
      const nextName = cleanPdfName(name, file.name);
      const currentFile = new File(file.uri);
      if (!currentFile.exists) throw new Error('Ce fichier PDF est introuvable.');
      currentFile.rename(nextName);
      setFiles((current) => current.map((item) => item.id === file.id ? { ...item, name: nextName, uri: currentFile.uri.replace(/[^/]+$/, nextName) } : item));
    },
    refreshStorage,
  }), [files, trash, hydrated, usageBytes, availableBytes, lowSpace]);

  return <StorageContext.Provider value={value}>{children}</StorageContext.Provider>;
}

export function useStorage() {
  const context = useContext(StorageContext);
  if (!context) throw new Error('useStorage must be used within StorageProvider');
  return context;
}
