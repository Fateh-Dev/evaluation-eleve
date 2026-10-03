import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  AppHeader,
  Screen,
  SectionTitle,
  Surface,
} from '@/components/AppShell';
import { themeOptions } from '@/constants/colors';
import { useTheme } from '@/context/ThemeContext';
import { useColors } from '@/hooks/useColors';

export default function ThemeSettingsScreen() {
  const colors = useColors();
  const { theme, setTheme } = useTheme();

  return (
    <Screen>
      <AppHeader
        eyebrow="Paramètres"
        title="Palette de couleurs"
        onBack={() => router.back()}
      />
      <SectionTitle title="Choisissez votre palette" />
      <Text style={[styles.help, { color: colors.mutedForeground }]}>
        La palette choisie est appliquée immédiatement et mémorisée sur cet
        appareil.
      </Text>
      <View style={styles.themeList}>
        {themeOptions.map((option) => {
          const selected = theme === option.id;
          return (
            <Pressable
              key={option.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setTheme(option.id)}
              style={({ pressed }) => [
                styles.themeOption,
                {
                  backgroundColor: selected ? colors.accent : colors.card,
                  borderColor: selected ? colors.primary : colors.border,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <View style={styles.themeCopy}>
                <View style={styles.themeTitleRow}>
                  <Text style={[styles.themeName, { color: colors.foreground }]}>
                    {option.label}
                  </Text>
                  {selected && (
                    <View
                      style={[
                        styles.selectedBadge,
                        { backgroundColor: colors.primary },
                      ]}
                    >
                      <Feather
                        name="check"
                        size={11}
                        color={colors.primaryForeground}
                      />
                      <Text
                        style={[
                          styles.selectedText,
                          { color: colors.primaryForeground },
                        ]}
                      >
                        Choisie
                      </Text>
                    </View>
                  )}
                </View>
                <Text
                  style={[
                    styles.themeDescription,
                    { color: colors.mutedForeground },
                  ]}
                >
                  {option.description}
                </Text>
              </View>
              <View style={styles.swatches}>
                {option.swatches.map((swatch) => (
                  <View
                    key={swatch}
                    style={[
                      styles.swatch,
                      { backgroundColor: swatch, borderColor: colors.border },
                    ]}
                  />
                ))}
              </View>
            </Pressable>
          );
        })}
      </View>
      <Surface style={styles.note}>
        <Feather name="smartphone" size={17} color={colors.primary} />
        <Text style={[styles.noteText, { color: colors.mutedForeground }]}>
          Ce réglage ne modifie que l’apparence de cette application sur votre
          appareil.
        </Text>
      </Surface>
    </Screen>
  );
}

const styles = StyleSheet.create({
  help: { fontSize: 12, lineHeight: 18, marginBottom: 14 },
  themeList: { gap: 9 },
  themeOption: {
    minHeight: 74,
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  themeCopy: { flex: 1, minWidth: 0, gap: 4 },
  themeTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  themeName: { fontSize: 14, fontWeight: '800' },
  themeDescription: { fontSize: 11, lineHeight: 15 },
  selectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  selectedText: { fontSize: 9, fontWeight: '800' },
  swatches: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  swatch: { width: 20, height: 20, borderRadius: 7, borderWidth: 1 },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    marginTop: 16,
  },
  noteText: { flex: 1, fontSize: 11, lineHeight: 17 },
});
