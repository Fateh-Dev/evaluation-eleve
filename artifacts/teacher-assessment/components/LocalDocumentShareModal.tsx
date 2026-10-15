import { Feather } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { StoredDocument } from '@/context/StorageContext';
import { startLocalDocumentShare } from '@/services/localDocumentShare';
import type { LocalDocumentShare } from '@/services/localDocumentShare.types';
import { useColors } from '@/hooks/useColors';

export function LocalDocumentShareModal({
  visible,
  file,
  onClose,
}: {
  visible: boolean;
  file: StoredDocument | null;
  onClose: () => void;
}) {
  const colors = useColors();
  const [session, setSession] = useState<LocalDocumentShare | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activeSession = useRef<LocalDocumentShare | null>(null);

  useEffect(() => {
    if (!visible || !file) return;
    let cancelled = false;
    setSession(null);
    setError(null);

    void startLocalDocumentShare(file).then((createdSession) => {
      if (cancelled) {
        void createdSession.stop().catch((stopError) => {
          console.warn('Impossible d’arrêter un partage local fermé pendant sa préparation.', stopError);
        });
        return;
      }
      activeSession.current = createdSession;
      setSession(createdSession);
    }).catch((shareError) => {
      if (!cancelled) {
        setError(shareError instanceof Error ? shareError.message : 'Le QR code n’a pas pu être créé.');
      }
    });

    return () => {
      cancelled = true;
      const current = activeSession.current;
      activeSession.current = null;
      if (current) {
        void current.stop().catch((stopError) => {
          console.warn('Impossible d’arrêter le partage local à la fermeture.', stopError);
        });
      }
    };
  }, [file, visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.header}>
            <View style={[styles.icon, { backgroundColor: colors.accent }]}>
              <Feather name="wifi" size={20} color={colors.primary} />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Fermer et arrêter le partage"
              onPress={onClose}
              style={[styles.close, { backgroundColor: colors.secondary }]}
            >
              <Feather name="x" size={19} color={colors.foreground} />
            </Pressable>
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>Partager par QR Wi-Fi</Text>
          <Text numberOfLines={2} style={[styles.filename, { color: colors.mutedForeground }]}>
            {file?.name}
          </Text>
          {session ? (
            <View style={[styles.qrFrame, { backgroundColor: '#FFFFFF' }]}>
              <QRCode value={session.url} size={224} backgroundColor="#FFFFFF" color="#14212B" />
            </View>
          ) : error ? (
            <View style={[styles.messageBox, { backgroundColor: colors.errorSurface }]}>
              <Feather name="alert-circle" size={19} color={colors.errorForeground} />
              <Text style={[styles.message, { color: colors.errorForeground }]}>{error}</Text>
            </View>
          ) : (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.primary} />
              <Text style={[styles.message, { color: colors.mutedForeground }]}>
                Préparation du partage temporaire…
              </Text>
            </View>
          )}
          <Text style={[styles.instructions, { color: colors.mutedForeground }]}>
            {session
              ? 'Scannez avec un autre téléphone connecté au même Wi-Fi. Utilisez un réseau de confiance et gardez le QR privé : toute personne qui le scanne peut télécharger le fichier. Le partage expire après 10 minutes et s’arrête en fermant cette fenêtre.'
              : 'Le partage ne nécessite pas Internet. Il sera arrêté en fermant cette fenêtre.'}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [
              styles.doneButton,
              { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Text style={[styles.doneText, { color: colors.primaryForeground }]}>
              {session || error ? 'Fermer et arrêter' : 'Annuler'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', padding: 22, backgroundColor: 'rgba(10, 15, 25, 0.55)' },
  card: { width: '100%', maxWidth: 440, alignSelf: 'center', alignItems: 'center', gap: 13, borderWidth: 1, borderRadius: 22, padding: 20 },
  header: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  icon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  close: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 19, fontWeight: '800', textAlign: 'center' },
  filename: { fontSize: 13, textAlign: 'center' },
  qrFrame: { padding: 10, borderRadius: 14, marginVertical: 3 },
  loading: { minHeight: 244, alignItems: 'center', justifyContent: 'center', gap: 12 },
  messageBox: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 13 },
  message: { flex: 1, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  instructions: { fontSize: 12, lineHeight: 18, textAlign: 'center' },
  doneButton: { minHeight: 44, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', borderRadius: 12, marginTop: 3 },
  doneText: { fontSize: 14, fontWeight: '700' },
});
