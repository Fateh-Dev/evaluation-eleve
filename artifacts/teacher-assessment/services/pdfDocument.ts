import { Paths } from 'expo-file-system';
import * as LegacyFS from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Linking } from 'react-native';
import { Platform } from 'react-native';

function safeFilename(value: string) {
  const base = value.replace(/\.pdf$/i, '').replace(/[^\p{L}\p{N}-]+/gu, '_');
  return `${base || 'document'}.pdf`;
}

export async function savePdfFromHtml(
  html: string,
  filename: string,
  title: string,
): Promise<void> {
  const normalizedFilename = safeFilename(filename);
  if (Platform.OS === 'web') {
    await Print.printAsync({ html });
    return;
  }

  const { base64 } = await Print.printToFileAsync({ html, base64: true });
  if (!base64) throw new Error('Expo Print n’a pas fourni le contenu du PDF.');

  const cacheDirectory = LegacyFS.cacheDirectory ?? Paths.cache.uri;
  const targetUri = `${cacheDirectory.endsWith('/') ? cacheDirectory : `${cacheDirectory}/`}${Date.now()}-${normalizedFilename}`;
  await LegacyFS.writeAsStringAsync(targetUri, base64, {
    encoding: LegacyFS.EncodingType.Base64,
  });
  const fileInfo = await LegacyFS.getInfoAsync(targetUri);
  if (!fileInfo.exists || fileInfo.size === 0) {
    throw new Error('Le PDF n’a pas été enregistré correctement.');
  }
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Le partage de fichiers PDF n’est pas disponible sur cet appareil.');
  }
  await Sharing.shareAsync(targetUri, {
    mimeType: 'application/pdf',
    dialogTitle: `Enregistrer ou partager — ${title}`,
    UTI: 'com.adobe.pdf',
  });
}

export async function saveExistingPdf(uri: string, title: string): Promise<void> {
  if (Platform.OS === 'web') {
    await Linking.openURL(uri);
    return;
  }
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Le partage de fichiers PDF n’est pas disponible sur cet appareil.');
  }
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: `Enregistrer ou partager — ${title}`,
    UTI: 'com.adobe.pdf',
  });
}
