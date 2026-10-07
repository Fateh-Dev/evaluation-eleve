import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppHeader, Screen } from '@/components/AppShell';
import { useAppData } from '@/context/AppDataContext';
import { useColors } from '@/hooks/useColors';

const MENU_ITEMS = [
  { group: 'Aide', label: 'Guide d’utilisation', detail: 'Trouver rapidement comment réaliser une action', icon: 'help-circle' as const, route: '/user-guide' as const },
  { group: 'Organisation', label: 'Emploi du temps', detail: 'Séances de la semaine et rappels', icon: 'calendar' as const, route: '/schedule' as const },
  { group: 'Organisation', label: 'Fin d’année scolaire', detail: 'Archiver une année et préparer la suivante', icon: 'archive' as const, route: '/year-end' as const },
  { group: 'Organisation', label: 'Tous les élèves', detail: 'Rechercher parmi les élèves des classes', icon: 'user' as const, route: '/pupils-list' as const },
  { group: 'Analyse', label: 'Statistiques multicritères', detail: 'Croiser les résultats et le suivi continu', icon: 'bar-chart-2' as const, route: '/statistics' as const },
  { group: 'Analyse', label: 'Bilans trimestriels', detail: 'Imprimer le bilan d’un élève ou d’une classe', icon: 'file-text' as const, route: '/student-reports' as const },
  { group: 'Documents', label: 'Documents pédagogiques', detail: 'Consulter les documents enregistrés', icon: 'folder' as const, route: '/pdf-library' as const },
  { group: 'Paramètres', label: 'Configuration pédagogique', detail: 'Niveaux, compétences et objectifs', icon: 'sliders' as const, route: '/settings/pedagogical' as const },
  { group: 'Paramètres', label: 'Paramètres de l’application', detail: 'Profil, établissement, apparence et sauvegardes', icon: 'settings' as const, route: '/settings' as const },
];

export default function MoreScreen() {
  const colors = useColors();
  const data = useAppData();
  const [query, setQuery] = useState('');

  const filteredClasses = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return data.classes;
    return data.classes.filter((item) => item.name.toLowerCase().includes(normalized));
  }, [data.classes, query]);

  const filteredPupils = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return data.pupils;
    return data.pupils.filter((pupil) => {
      const haystack = `${pupil.firstName} ${pupil.lastName} ${pupil.registrationNumber}`.toLowerCase();
      return haystack.includes(normalized);
    });
  }, [data.pupils, query]);

  return (
    <Screen>
      <AppHeader eyebrow="Navigation" title="Plus" />
      <View style={[styles.search, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="search" size={17} color={colors.mutedForeground} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Rechercher une classe ou un élève"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.searchInput, { color: colors.foreground }]}
        />
        {query ? (
          <Pressable onPress={() => setQuery('')}>
            <Feather name="x" size={16} color={colors.mutedForeground} />
          </Pressable>
        ) : null}
      </View>

      {query ? (
        <View style={styles.searchResults}>
          {filteredClasses.length > 0 ? (
            <View style={styles.group}>
              <Text style={[styles.groupTitle, { color: colors.mutedForeground }]}>Classes</Text>
              {filteredClasses.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => router.push(`/classes/${item.id}`)}
                  style={({ pressed }) => [styles.resultRow, { borderBottomColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
                >
                  <View style={[styles.icon, { backgroundColor: colors.accent }]}>
                    <Feather name="users" size={16} color={colors.primary} />
                  </View>
                  <View style={styles.copy}>
                    <Text style={[styles.label, { color: colors.foreground }]}>{item.name}</Text>
                    <Text style={[styles.detail, { color: colors.mutedForeground }]}>{item.level}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : null}

          {filteredPupils.length > 0 ? (
            <View style={styles.group}>
              <Text style={[styles.groupTitle, { color: colors.mutedForeground }]}>Élèves</Text>
              {filteredPupils.map((pupil) => (
                <Pressable
                  key={pupil.id}
                  onPress={() => router.push(`/pupils/${pupil.id}`)}
                  style={({ pressed }) => [styles.resultRow, { borderBottomColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
                >
                  <View style={[styles.icon, { backgroundColor: colors.secondary }]}>
                    <Feather name="user" size={16} color={colors.foreground} />
                  </View>
                  <View style={styles.copy}>
                    <Text style={[styles.label, { color: colors.foreground }]}>{pupil.firstName} {pupil.lastName}</Text>
                    <Text style={[styles.detail, { color: colors.mutedForeground }]}>N° {pupil.registrationNumber}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : null}

          {!filteredClasses.length && !filteredPupils.length ? (
            <Text style={[styles.empty, { color: colors.mutedForeground }]}>Aucun résultat pour “{query}”.</Text>
          ) : null}
        </View>
      ) : (
        <View style={styles.menuGroups}>
          {['Aide', 'Organisation', 'Analyse', 'Documents', 'Paramètres'].map((group) => (
            <View key={group} style={styles.menuGroup}>
              <Text style={[styles.groupTitle, { color: colors.mutedForeground }]}>{group}</Text>
              <View style={[styles.list, { borderTopColor: colors.border }]}>
                {MENU_ITEMS.filter((item) => item.group === group).map((item) => (
                  <Pressable
                    key={item.route}
                    accessibilityRole="button"
                    onPress={() => router.push(item.route)}
                    style={({ pressed }) => [styles.row, { borderBottomColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
                  >
                    <View style={[styles.icon, { backgroundColor: colors.accent }]}>
                      <Feather name={item.icon} size={19} color={colors.primary} />
                    </View>
                    <View style={styles.copy}>
                      <Text style={[styles.label, { color: colors.foreground }]}>{item.label}</Text>
                      <Text style={[styles.detail, { color: colors.mutedForeground }]}>{item.detail}</Text>
                    </View>
                    <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  searchInput: { flex: 1, minHeight: 42, fontSize: 14 },
  searchResults: { gap: 16 },
  menuGroups: { gap: 18, paddingBottom: 18 },
  menuGroup: { gap: 5 },
  group: { gap: 6 },
  groupTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1.1, textTransform: 'uppercase', marginLeft: 4 },
  list: { borderTopWidth: 1 },
  row: { minHeight: 68, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  resultRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, paddingVertical: 8 },
  icon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0, gap: 3 },
  label: { fontSize: 14, fontWeight: '700' },
  detail: { fontSize: 11, lineHeight: 15 },
  empty: { fontSize: 13, paddingTop: 8 },
});
