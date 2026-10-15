import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { DocumentPreviewFrame } from '@/components/DocumentPreviewFrame';
import { saveExistingDocument, savePdfFromHtml } from '@/services/pdfDocument';
import { getDocumentMediaType } from '@/services/documentMedia';
import { Alert } from '@/components/AppDialog';

export function PdfPreviewModal({
  visible,
  title,
  html,
  uri,
  mimeType,
  filename,
  onClose,
}: {
  visible: boolean;
  title: string;
  html?: string;
  uri?: string;
  mimeType?: string;
  filename: string;
  onClose: () => void;
}) {
  const colors = useColors();
  const [saving, setSaving] = useState(false);
  const mediaType = getDocumentMediaType(filename, mimeType);

  const saveDocument = async () => {
    if ((!html && !uri) || saving) return;
    setSaving(true);
    try {
      if (uri) await saveExistingDocument(uri, title, mimeType);
      else await savePdfFromHtml(html ?? '', filename, title);
    } catch (error) {
      Alert.alert(
        'Document indisponible',
        error instanceof Error ? error.message : 'Le document n’a pas pu être enregistré.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fermer l’aperçu"
            onPress={onClose}
            style={[styles.iconButton, { backgroundColor: colors.muted }]}
          >
            <Feather name="x" size={19} color={colors.foreground} />
          </Pressable>
          <View style={styles.titleContainer}>
            <Text numberOfLines={1} style={[styles.title, { color: colors.foreground }]}>
              {title}
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Aperçu · {mediaType === 'pdf' ? 'PDF' : mediaType === 'image' ? 'Image' : 'Vidéo'}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Télécharger ou partager le document"
            disabled={saving}
            onPress={() => { void saveDocument(); }}
            style={[styles.saveButton, { backgroundColor: colors.primary, opacity: saving ? 0.55 : 1 }]}
          >
            <Feather name="download" size={17} color={colors.primaryForeground} />
          </Pressable>
        </View>
        <View style={styles.preview}>
          <DocumentPreviewFrame html={html} uri={uri} mediaType={mediaType} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  preview: { flex: 1, paddingHorizontal: 12 },
  header: { minHeight: 66, borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 11 },
  iconButton: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  titleContainer: { flex: 1, gap: 3 },
  title: { fontSize: 15, fontWeight: '700' },
  subtitle: { fontSize: 11 },
  saveButton: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
});
