import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
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

type StorageContextValue = {
  files: StoredPdf[];
  hydrated: boolean;
  uploadPdf: () => Promise<void>;
  openPdf: (file: StoredPdf) => Promise<void>;
  deletePdf: (file: StoredPdf) => Promise<void>;
};

const STORAGE_KEY = 'teacher-assessment-pdf-library-v1';
const DIRECTORY_NAME = 'teacher-storage';
const StorageContext = createContext<StorageContextValue | null>(null);

export function StorageProvider({ children }: PropsWithChildren) {
  const [files, setFiles] = useState<StoredPdf[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (!stored) return;
      try {
        const parsed = JSON.parse(stored) as StoredPdf[];
        if (Array.isArray(parsed)) setFiles(parsed);
      } catch {
        setFiles([]);
      }
    }).finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (hydrated) void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(files));
  }, [files, hydrated]);

  const value = useMemo<StorageContextValue>(() => ({
    files,
    hydrated,
    uploadPdf: async () => {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: false,
        multiple: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const picked = result.assets[0];
      const id = `pdf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const originalName = picked.name || `${id}.pdf`;
      const directory = new Directory(Paths.document, DIRECTORY_NAME, id);
      directory.create({ intermediates: true, idempotent: true });
      const destination = new File(directory, originalName);
      await new File(picked.uri).copy(destination, { overwrite: true });
      const created: StoredPdf = {
        id,
        name: originalName,
        uri: destination.uri,
        size: picked.size,
        createdAt: new Date().toISOString(),
      };
      setFiles((current) => [created, ...current]);
    },
    openPdf: async (file) => {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', dialogTitle: file.name });
      } else {
        await Linking.openURL(file.uri);
      }
    },
    deletePdf: async (file) => {
      try {
        const stored = new File(file.uri);
        if (stored.exists) stored.delete();
      } catch {
        // The metadata is still removed if the original file was already deleted.
      }
      setFiles((current) => current.filter((item) => item.id !== file.id));
    },
  }), [files, hydrated]);

  return <StorageContext.Provider value={value}>{children}</StorageContext.Provider>;
}

export function useStorage() {
  const context = useContext(StorageContext);
  if (!context) throw new Error('useStorage must be used within StorageProvider');
  return context;
}
