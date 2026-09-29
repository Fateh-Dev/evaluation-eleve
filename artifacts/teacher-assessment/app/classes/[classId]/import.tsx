import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { useImportClassPupils } from '@workspace/api-client-react';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { AppHeader, Button, Screen, SectionTitle, Surface } from '@/components/AppShell';
import { useAppData } from '@/context/AppDataContext';
import { useColors } from '@/hooks/useColors';

type ImportRow = {
  registrationNumber: string;
  firstName: string;
  lastName: string;
};

function parseRows(value: string): ImportRow[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/[;,]/).map((part) => part.trim()))
    .filter((parts) => parts.length >= 3)
    .filter((parts, index) => !(index === 0 && /matricule|registration/i.test(parts[0])))
    .map(([registrationNumber, firstName, lastName]) => ({ registrationNumber, firstName, lastName }));
}

export default function PupilImportScreen() {
  const colors = useColors();
  const data = useAppData();
  const [text, setText] = useState('Matricule;Prénom;Nom\n25;Nadia;Khelifi\n26;Karim;Belaïd');
  const rows = useMemo(() => parseRows(text), [text]);
  const importMutation = useImportClassPupils();

  const importRows = () => {
    if (rows.length === 0) {
      Alert.alert('Import impossible', 'Ajoutez au moins une ligne valide avant de confirmer.');
      return;
    }
    importMutation.mutate(
      { classId: data.classId, data: { rows } },
      {
        onSuccess: (result) => {
          const localResult = data.addPupils(rows);
          Alert.alert('Import terminé', `${result.imported} élève(s) importé(s), ${result.skipped} doublon(s).${localResult.skipped ? ` ${localResult.skipped} déjà présent(s) localement.` : ''}`);
          router.back();
        },
        onError: () => {
          const localResult = data.addPupils(rows);
          if (localResult.imported > 0) router.back();
          Alert.alert('Import local', `${localResult.imported} élève(s) ajouté(s) localement, ${localResult.skipped} doublon(s). Ils seront synchronisés au prochain envoi.`);
        },
      },
    );
  };

  return (
    <KeyboardAwareScrollViewCompat
      bottomOffset={80}
      keyboardShouldPersistTaps="handled"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ flexGrow: 1 }}
    >
      <Screen>
        <AppHeader eyebrow={data.className} title="Importer des élèves" onBack={() => router.back()} />
        <Surface style={styles.instructions}>
          <Feather name="info" size={17} color={colors.primary} />
          <Text style={[styles.instructionsText, { color: colors.foreground }]}>
            Collez trois colonnes séparées par ; ou , : matricule, prénom, nom. La première ligne peut contenir les en-têtes.
          </Text>
        </Surface>
        <SectionTitle title="Données à importer" />
        <TextInput
          multiline
          value={text}
          onChangeText={setText}
          placeholder="Matricule;Prénom;Nom"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border }]}
          textAlignVertical="top"
        />
        <SectionTitle title={`Aperçu · ${rows.length} ligne${rows.length > 1 ? 's' : ''}`} />
        <Surface style={styles.preview}>
          {rows.slice(0, 8).map((row) => (
            <View key={`${row.registrationNumber}-${row.lastName}`} style={[styles.previewRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.registration, { color: colors.primary }]}>{row.registrationNumber}</Text>
              <Text style={[styles.name, { color: colors.foreground }]}>{row.firstName} {row.lastName}</Text>
            </View>
          ))}
          {rows.length > 8 ? <Text style={[styles.more, { color: colors.mutedForeground }]}>+ {rows.length - 8} autre(s)</Text> : null}
          {rows.length === 0 ? <Text style={[styles.more, { color: colors.mutedForeground }]}>Aucune ligne valide détectée.</Text> : null}
        </Surface>
        <View style={styles.actions}>
          <Button label={importMutation.isPending ? 'Import en cours…' : `Importer ${rows.length} élève${rows.length > 1 ? 's' : ''}`} icon="upload" onPress={importRows} />
          <Button label="Annuler" secondary onPress={() => router.back()} />
        </View>
      </Screen>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  instructions: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  instructionsText: { flex: 1, fontSize: 13, lineHeight: 19 },
  input: { minHeight: 170, borderWidth: 1, borderRadius: 14, padding: 14, fontSize: 14, lineHeight: 21 },
  preview: { paddingVertical: 4 },
  previewRow: { minHeight: 40, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  registration: { width: 48, fontSize: 12, fontWeight: '800' },
  name: { flex: 1, fontSize: 13, fontWeight: '600' },
  more: { fontSize: 12, paddingTop: 10 },
  actions: { gap: 10, marginTop: 18 },
});
