import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppHeader, Screen, Surface } from '@/components/AppShell';
import { useColors } from '@/hooks/useColors';

const REPORT_DESTINATIONS = [
  {
    title: 'Bilans trimestriels',
    detail: 'Préparer et imprimer le bilan d’un élève ou d’une classe',
    icon: 'file-text' as const,
    route: '/student-reports' as const,
  },
  {
    title: 'Statistiques',
    detail: 'Explorer les résultats et exporter les données',
    icon: 'bar-chart-2' as const,
    route: '/statistics' as const,
  },
];

export default function ReportsScreen() {
  const colors = useColors();

  return (
    <Screen>
      <AppHeader eyebrow="Résultats et exports" title="Bilans" />
      <Text style={[styles.intro, { color: colors.mutedForeground }]}>
        Consultez les résultats de vos classes et préparez les documents à partager.
      </Text>
      <View style={styles.destinations}>
        {REPORT_DESTINATIONS.map((destination) => (
          <Pressable
            key={destination.route}
            accessibilityRole="button"
            onPress={() => router.push(destination.route)}
            style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
          >
            <Surface style={styles.destination}>
              <View style={[styles.icon, { backgroundColor: colors.accent }]}>
                <Feather
                  name={destination.icon}
                  size={21}
                  color={colors.primary}
                />
              </View>
              <View style={styles.copy}>
                <Text style={[styles.title, { color: colors.foreground }]}>
                  {destination.title}
                </Text>
                <Text style={[styles.detail, { color: colors.mutedForeground }]}>
                  {destination.detail}
                </Text>
              </View>
              <Feather
                name="chevron-right"
                size={18}
                color={colors.mutedForeground}
              />
            </Surface>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { fontSize: 14, lineHeight: 20, marginBottom: 12 },
  destinations: { gap: 10 },
  destination: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, gap: 4 },
  title: { fontSize: 15, fontWeight: '700' },
  detail: { fontSize: 12, lineHeight: 17 },
});
