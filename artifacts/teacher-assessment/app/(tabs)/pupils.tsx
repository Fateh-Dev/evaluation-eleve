import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppHeader, Screen, SectionTitle } from '@/components/AppShell';
import { useAppData } from '@/context/AppDataContext';
import { useColors } from '@/hooks/useColors';

export default function PupilsScreen() {
  const colors = useColors();
  const data = useAppData();
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'registration'>('name');
  const pupils = useMemo(() => data.pupils.filter((pupil) => `${pupil.firstName} ${pupil.lastName} ${pupil.registrationNumber}`.toLowerCase().includes(search.toLowerCase())).sort((a, b) => sortBy === 'name' ? `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`) : a.registrationNumber.localeCompare(b.registrationNumber, undefined, { numeric: true })), [data.pupils, search, sortBy]);
  return (
    <Screen>
      <AppHeader eyebrow="Classe" title="Élèves" compact />
      <View style={[styles.search, { backgroundColor: colors.card, borderColor: colors.border }]}><Feather name="search" size={17} color={colors.mutedForeground} /><TextInput value={search} onChangeText={setSearch} placeholder="Rechercher par nom ou matricule" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground }]} /></View>
      <Pressable onPress={() => setSortBy(sortBy === 'name' ? 'registration' : 'name')} style={[styles.sortButton, { borderColor: colors.border, backgroundColor: colors.card }]}><Feather name="filter" size={15} color={colors.primary} /><Text style={[styles.sortText, { color: colors.foreground }]}>Tri : {sortBy === 'name' ? 'nom' : 'matricule'}</Text></Pressable>
      <SectionTitle title={`${pupils.length} résultat${pupils.length > 1 ? 's' : ''}`} />
      <View style={styles.list}>{pupils.map((pupil, index) => (
        <Pressable key={pupil.id} onPress={() => router.push(`/pupils/${pupil.id}`)} style={({ pressed }) => [styles.pupilRow, { borderBottomColor: colors.border, opacity: pressed ? 0.7 : 1 }]}>
          <View style={[styles.avatar, { backgroundColor: index % 2 === 0 ? colors.secondary : colors.accent }]}><Text style={[styles.avatarText, { color: colors.foreground }]}>{pupil.firstName.charAt(0)}{pupil.lastName.charAt(0)}</Text></View>
          <View style={styles.pupilCopy}><Text style={[styles.pupilName, { color: colors.foreground }]}>{pupil.firstName} {pupil.lastName}</Text><Text style={[styles.pupilMeta, { color: colors.mutedForeground }]}>N° {pupil.registrationNumber} · {data.assessment.title}</Text></View>
          <Feather name="chevron-right" size={17} color={colors.mutedForeground} />
        </Pressable>
      ))}</View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: { height: 50, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: { flex: 1, fontSize: 14 },
  sortButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, marginTop: 10 },
  sortText: { fontSize: 12, fontWeight: '700' },
  list: { paddingBottom: 20 },
  pupilRow: { minHeight: 70, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 13, fontWeight: '800' },
  pupilCopy: { flex: 1, gap: 4 },
  pupilName: { fontSize: 15, fontWeight: '700' },
  pupilMeta: { fontSize: 12 },
});
