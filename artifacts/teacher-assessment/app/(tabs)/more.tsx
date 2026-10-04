import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppHeader, Screen } from '@/components/AppShell';
import { useColors } from '@/hooks/useColors';

const MENU_ITEMS = [
  { label: 'Élèves', detail: 'Parcourir les élèves des classes', icon: 'user' as const, route: '/pupils-list' as const },
  { label: 'Emploi du temps', detail: 'Séances de la semaine et rappels', icon: 'calendar' as const, route: '/schedule' as const },
  { label: 'Stockage', detail: 'Documents pédagogiques enregistrés', icon: 'folder' as const, route: '/pdf-library' as const },
  { label: 'Configuration', detail: 'Profil, établissement et paramètres', icon: 'settings' as const, route: '/settings' as const },
];

export default function MoreScreen() {
  const colors = useColors();

  return (
    <Screen>
      <AppHeader eyebrow="Navigation" title="Plus" />
      <View style={[styles.list, { borderTopColor: colors.border }]}>
        {MENU_ITEMS.map((item) => (
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { borderTopWidth: 1 },
  row: { minHeight: 68, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  icon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0, gap: 3 },
  label: { fontSize: 14, fontWeight: '700' },
  detail: { fontSize: 11, lineHeight: 15 },
});