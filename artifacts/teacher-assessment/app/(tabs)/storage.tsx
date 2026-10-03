import { Feather } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppHeader, Button, Screen, SectionTitle, Surface } from '@/components/AppShell';
import { useColors } from '@/hooks/useColors';
import { useStorage } from '@/context/StorageContext';

function formatSize(size?: number) {
  if (!size) return 'Taille inconnue';
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} Ko`;
  return `${(size / (1024 * 1024)).toFixed(1)} Mo`;
}

export default function StorageScreen() {
  const colors = useColors();
  const storage = useStorage();
  const [query, setQuery] = useState('');
  const filteredFiles = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return storage.files;
    return storage.files.filter((file) => file.name.toLocaleLowerCase().includes(normalizedQuery));
  }, [query, storage.files]);

  const handleUpload = async () => {
    try {
      await storage.uploadPdf();
    } catch {
      Alert.alert('Import impossible', 'Le fichier PDF n’a pas pu être ajouté au stockage.');
    }
  };

  const handleDelete = (fileId: string, fileName: string) => {
    const file = storage.files.find((item) => item.id === fileId);
    if (!file) return;
    Alert.alert('Supprimer ce PDF ?', `« ${fileName} » sera supprimé de cet appareil.`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => { void storage.deletePdf(file); } },
    ]);
  };

  return (
    <Screen>
      <AppHeader eyebrow="Documents de l’enseignant" title="Stockage" />
      <Surface style={styles.hero}>
        <View style={[styles.heroIcon, { backgroundColor: colors.accent }]}>
          <Feather name="folder" size={25} color={colors.primary} />
        </View>
        <View style={styles.heroCopy}>
          <Text style={[styles.heroTitle, { color: colors.foreground }]}>Ma bibliothèque PDF</Text>
          <Text style={[styles.heroText, { color: colors.mutedForeground }]}>Ajoutez vos cours, fiches et documents pédagogiques pour les retrouver rapidement hors connexion.</Text>
        </View>
        <Button label="Ajouter un PDF" icon="upload" compact onPress={() => { void handleUpload(); }} />
      </Surface>

      <SectionTitle title={`Documents (${storage.files.length})`} />
      <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="search" size={18} color={colors.mutedForeground} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Rechercher un document PDF…"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.searchInput, { color: colors.foreground }]}
          returnKeyType="search"
        />
        {query ? <Pressable onPress={() => setQuery('')}><Feather name="x-circle" size={18} color={colors.mutedForeground} /></Pressable> : null}
      </View>

      {filteredFiles.length === 0 ? (
        <Surface style={styles.empty}>
          <Feather name={query ? 'search' : 'file-text'} size={34} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{query ? 'Aucun document trouvé' : 'Aucun PDF enregistré'}</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>{query ? 'Essayez un autre nom de fichier.' : 'Ajoutez votre premier PDF pour constituer votre bibliothèque pédagogique.'}</Text>
          {!query ? <Button label="Ajouter un PDF" compact icon="plus" onPress={() => { void handleUpload(); }} /> : null}
        </Surface>
      ) : (
        <View style={styles.list}>
          {filteredFiles.map((file) => (
            <Surface key={file.id} style={styles.fileCard}>
              <View style={[styles.fileIcon, { backgroundColor: colors.errorSurface }]}><Feather name="file-text" size={21} color={colors.errorForeground} /></View>
              <View style={styles.fileCopy}>
                <Text numberOfLines={2} style={[styles.fileName, { color: colors.foreground }]}>{file.name}</Text>
                <Text style={[styles.fileMeta, { color: colors.mutedForeground }]}>{formatSize(file.size)} · {new Date(file.createdAt).toLocaleDateString('fr-FR')}</Text>
              </View>
              <Pressable onPress={() => { void storage.openPdf(file); }} style={[styles.action, { backgroundColor: colors.accent }]} accessibilityRole="button" accessibilityLabel={`Ouvrir ${file.name}`}>
                <Feather name="external-link" size={17} color={colors.primary} />
              </Pressable>
              <Pressable onPress={() => handleDelete(file.id, file.name)} style={[styles.action, { backgroundColor: colors.errorSurface }]} accessibilityRole="button" accessibilityLabel={`Supprimer ${file.name}`}>
                <Feather name="trash-2" size={17} color={colors.errorForeground} />
              </Pressable>
            </Surface>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: 13, padding: 16, marginBottom: 8 },
  heroIcon: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  heroCopy: { gap: 4 },
  heroTitle: { fontSize: 18, fontWeight: '800' },
  heroText: { fontSize: 13, lineHeight: 19 },
  searchBox: { minHeight: 48, borderWidth: 1, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, marginBottom: 14 },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 10 },
  list: { gap: 10, paddingBottom: 24 },
  fileCard: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 13 },
  fileIcon: { width: 43, height: 43, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  fileCopy: { flex: 1, gap: 4 },
  fileName: { fontSize: 14, fontWeight: '700', lineHeight: 19 },
  fileMeta: { fontSize: 11 },
  action: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 34, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 17, fontWeight: '800', textAlign: 'center' },
  emptyText: { fontSize: 13, lineHeight: 19, textAlign: 'center', maxWidth: 300, marginBottom: 4 },
});
