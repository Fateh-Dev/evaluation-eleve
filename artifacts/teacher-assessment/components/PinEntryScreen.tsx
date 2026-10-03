import { Feather } from '@expo/vector-icons';
import React, { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

type PinEntryScreenProps = {
  title: string;
  subtitle: string;
  pin: string;
  error?: string;
  hint?: string;
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  children?: ReactNode;
  footer?: ReactNode;
};

export function PinEntryScreen({
  title,
  subtitle,
  pin,
  error,
  hint = 'Code de 4 chiffres',
  onDigit,
  onBackspace,
  children,
  footer,
}: PinEntryScreenProps) {
  const colors = useColors();
  const keypadRows = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.lockScreen}>
        <View style={[styles.icon, { backgroundColor: colors.accent }]}>
          <Feather name="key" size={42} color={colors.primary} />
        </View>
        <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{subtitle}</Text>
        <View style={styles.pinDots} accessibilityLabel={`${pin.length} chiffres saisis sur 4`}>
          {[0, 1, 2, 3].map((index) => (
            <View
              key={index}
              style={[
                styles.pinDot,
                {
                  backgroundColor: index < pin.length ? colors.primary : colors.muted,
                  borderColor: index < pin.length ? colors.primary : colors.border,
                },
              ]}
            >
              {index < pin.length ? <View style={[styles.pinDotInner, { backgroundColor: colors.primaryForeground }]} /> : null}
            </View>
          ))}
        </View>
        {error
          ? <Text style={[styles.error, { color: colors.errorForeground }]}>{error}</Text>
          : <Text style={[styles.hint, { color: colors.mutedForeground }]}>{hint}</Text>}
        {children}
        <View style={styles.keypad}>
          {keypadRows.flat().map((key) => (
            <Pressable
              key={key}
              onPress={() => onDigit(key)}
              style={({ pressed }) => [styles.key, { backgroundColor: colors.muted, opacity: pressed ? 0.65 : 1 }]}
              accessibilityRole="button"
              accessibilityLabel={`Chiffre ${key}`}
            >
              <Text style={[styles.keyText, { color: colors.foreground }]}>{key}</Text>
            </Pressable>
          ))}
          <View style={styles.keySpacer} />
          <Pressable
            onPress={() => onDigit('0')}
            style={({ pressed }) => [styles.key, { backgroundColor: colors.muted, opacity: pressed ? 0.65 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel="Chiffre 0"
          >
            <Text style={[styles.keyText, { color: colors.foreground }]}>0</Text>
          </Pressable>
          <Pressable
            onPress={onBackspace}
            style={({ pressed }) => [styles.key, { backgroundColor: colors.muted, opacity: pressed ? 0.65 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel="Effacer"
          >
            <Feather name="delete" size={22} color={colors.foreground} />
          </Pressable>
        </View>
        {footer}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  lockScreen: { width: '100%', maxWidth: 420, alignItems: 'center', paddingVertical: 18 },
  icon: { width: 94, height: 94, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: 22 },
  title: { fontSize: 25, fontWeight: '800', textAlign: 'center', letterSpacing: -0.4 },
  subtitle: { maxWidth: 290, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 8 },
  pinDots: { flexDirection: 'row', gap: 11, marginTop: 25, marginBottom: 10 },
  pinDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  pinDotInner: { width: 7, height: 7, borderRadius: 4 },
  keypad: { width: 270, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 16, marginTop: 22 },
  key: { width: 70, height: 70, borderRadius: 35, alignItems: 'center', justifyContent: 'center' },
  keySpacer: { width: 70, height: 70 },
  keyText: { fontSize: 23, fontWeight: '600' },
  error: { fontSize: 13, fontWeight: '700', minHeight: 18, marginTop: 2 },
  hint: { fontSize: 12, minHeight: 18, marginTop: 2 },
});
