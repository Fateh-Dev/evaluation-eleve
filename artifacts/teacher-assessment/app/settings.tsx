import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppHeader, Button, Screen, SectionTitle, Surface } from '@/components/AppShell';
import { useAppData } from '@/context/AppDataContext';
import { useColors } from '@/hooks/useColors';

export default function SettingsScreen() {
  const colors = useColors();
  const data = useAppData();
  return (
    <Screen>
      <AppHeader eyebrow="Configuration" title="Paramètres" onBack={() => router.back()} />
      <SectionTitle title="Établissement" />
      <Surface style={styles.form}><View style={styles.formRow}><Feather name="home" size={17} color={colors.primary} /><View><Text style={[styles.label, { color: colors.mutedForeground }]}>NOM</Text><Text style={[styles.value, { color: colors.foreground }]}>{data.school.name}</Text></View></View><View style={styles.formRow}><Feather name="map-pin" size={17} color={colors.primary} /><View><Text style={[styles.label, { color: colors.mutedForeground }]}>WILAYA</Text><Text style={[styles.value, { color: colors.foreground }]}>{data.school.wilaya}</Text></View></View><View style={styles.formRow}><Feather name="calendar" size={17} color={colors.primary} /><View><Text style={[styles.label, { color: colors.mutedForeground }]}>ANNÉE ACTIVE</Text><Text style={[styles.value, { color: colors.foreground }]}>{data.academicYear}</Text></View></View></Surface>
      <SectionTitle title="Documents" />
      <Surface style={styles.settingRow}><View style={[styles.settingIcon, { backgroundColor: colors.accent }]}><Feather name="file-text" size={18} color={colors.primary} /></View><View style={styles.settingCopy}><Text style={[styles.value, { color: colors.foreground }]}>Format de référence</Text><Text style={[styles.help, { color: colors.mutedForeground }]}>A4 portrait · structure notation.docx</Text></View><Text style={[styles.enabled, { color: colors.successForeground }]}>Actif</Text></Surface>
      <SectionTitle title="Synchronisation" />
      <Surface style={styles.syncCard}><Text style={[styles.value, { color: colors.foreground }]}>Stockage local prêt</Text><Text style={[styles.help, { color: colors.mutedForeground }]}>Les évaluations peuvent continuer sans connexion. Les modifications seront envoyées quand le réseau reviendra.</Text><Button label="Marquer comme synchronisé" compact secondary onPress={data.markSynced} icon="refresh-cw" /></Surface>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: 19 },
  formRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  label: { fontSize: 10, letterSpacing: 1.1, fontWeight: '800', marginBottom: 4 },
  value: { fontSize: 15, fontWeight: '700' },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  settingIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  settingCopy: { flex: 1, gap: 4 },
  help: { fontSize: 12, lineHeight: 17 },
  enabled: { fontSize: 12, fontWeight: '800' },
  syncCard: { gap: 12 },
});
