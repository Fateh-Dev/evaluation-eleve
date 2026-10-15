import * as Crypto from 'expo-crypto';
import * as LegacyFS from 'expo-file-system/legacy';
import * as Network from 'expo-network';
import type StaticServer from '@dr.pogodin/react-native-static-server';
import { Platform } from 'react-native';
import {
  createLocalSharePage,
  createLocalShareRootPage,
  cleanSharedFilename,
  getLocalShareContentFilename,
} from './localDocumentShareContent';
import type { StoredDocument } from '@/context/StorageContext';
import type { LocalDocumentShare } from './localDocumentShare.types';

const SHARE_FOLDER = 'teacher-assessment-local-share';
const SHARE_DURATION_MS = 10 * 60 * 1000;

let stopActiveShare: (() => Promise<void>) | null = null;

function toNativePath(uri: string) {
  if (!uri.startsWith('file://')) {
    throw new Error('Le stockage temporaire du partage n’est pas accessible.');
  }
  return uri.slice('file://'.length);
}

export async function startLocalDocumentShare(file: StoredDocument): Promise<LocalDocumentShare> {
  if (Platform.OS === 'web') {
    throw new Error('Le partage par QR Wi-Fi est disponible dans l’application Android ou iOS.');
  }
  const networkState = await Network.getNetworkStateAsync();
  if (networkState.type !== Network.NetworkStateType.WIFI) {
    throw new Error('Connectez ce téléphone à un réseau Wi-Fi avant de créer un QR code.');
  }

  await stopActiveShare?.();

  const source = await LegacyFS.getInfoAsync(file.uri);
  if (!source.exists || !source.size) {
    throw new Error('Ce document est introuvable ou semble endommagé.');
  }
  const availableBytes = await LegacyFS.getFreeDiskStorageAsync();
  if (source.size > availableBytes) {
    throw new Error('Il n’y a pas assez d’espace libre pour préparer le partage temporaire.');
  }
  if (!LegacyFS.cacheDirectory) {
    throw new Error('Le dossier temporaire du téléphone est indisponible.');
  }

  const cacheDirectory = LegacyFS.cacheDirectory.replace(/\/+$/, '');
  const shareRootUri = `${cacheDirectory}/${SHARE_FOLDER}`;
  const shareRootPath = toNativePath(shareRootUri);
  const token = Crypto.randomUUID().replaceAll('-', '');
  const sessionDirectory = `${shareRootUri}/${token}`;
  const filename = cleanSharedFilename(file.name);
  const copiedFileUri = `${sessionDirectory}/${getLocalShareContentFilename(filename)}`;
  const pageUri = `${sessionDirectory}/index.html`;
  const rootPageUri = `${shareRootUri}/index.html`;
  let server: StaticServer | null = null;

  try {
    const { default: StaticServerModule } = await import('@dr.pogodin/react-native-static-server');
    await LegacyFS.deleteAsync(shareRootUri, { idempotent: true });
    await LegacyFS.makeDirectoryAsync(sessionDirectory, { intermediates: true });
    await LegacyFS.copyAsync({ from: file.uri, to: copiedFileUri });
    await LegacyFS.writeAsStringAsync(rootPageUri, createLocalShareRootPage(), {
      encoding: LegacyFS.EncodingType.UTF8,
    });
    await LegacyFS.writeAsStringAsync(pageUri, createLocalSharePage(filename), {
      encoding: LegacyFS.EncodingType.UTF8,
    });

    server = new StaticServerModule({
      fileDir: shareRootPath,
      nonLocal: true,
      port: 0,
      stopInBackground: true,
    });
    const origin = await server.start();
    const url = new URL(`${token}/`, `${origin.replace(/\/+$/, '')}/`).toString();
    const expiresAt = Date.now() + SHARE_DURATION_MS;
    let stopped = false;
    let expiryTimer: ReturnType<typeof setTimeout>;

    const stop = async () => {
      if (stopped) return;
      stopped = true;
      clearTimeout(expiryTimer);
      try {
        await server?.stop();
      } finally {
        try {
          await LegacyFS.deleteAsync(shareRootUri, { idempotent: true });
        } finally {
          if (stopActiveShare === stop) stopActiveShare = null;
        }
      }
    };

    stopActiveShare = stop;
    expiryTimer = setTimeout(() => {
      void stop().catch((error) => {
        console.warn('Impossible d’arrêter automatiquement le partage local.', error);
      });
    }, SHARE_DURATION_MS);
    return { url, expiresAt, stop };
  } catch (error) {
    if (server) {
      try {
        await server.stop();
      } catch (stopError) {
        console.warn('Impossible d’arrêter le serveur de partage après une erreur.', stopError);
      }
    }
    try {
      await LegacyFS.deleteAsync(shareRootUri, { idempotent: true });
    } catch (cleanupError) {
      console.warn('Impossible de nettoyer les fichiers temporaires du partage.', cleanupError);
    }
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('ReactNativeFs') || message.includes('TurboModuleRegistry')) {
      throw new Error(
        'Le partage QR nécessite une version Android ou iOS recompilée avec le module de partage local. Réinstallez la nouvelle version de l’application. Le partage système reste disponible.',
      );
    }
    throw error;
  }
}
