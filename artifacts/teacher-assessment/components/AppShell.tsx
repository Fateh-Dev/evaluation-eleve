import { Feather } from '@expo/vector-icons';
import React, { PropsWithChildren } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';

export function Screen({ children, scroll = true }: PropsWithChildren<{ scroll?: boolean }>) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const content = (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top + 18, paddingBottom: insets.bottom + 120 }]}>
      {children}
    </View>
  );
  if (!scroll) return content;
  return <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>{content}</ScrollView>;
}

export function AppHeader({ eyebrow, title, onBack }: { eyebrow?: string; title: string; onBack?: () => void }) {
  const colors = useColors();
  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        {eyebrow ? <Text style={[styles.eyebrow, { color: colors.primary }]}>{eyebrow.toUpperCase()}</Text> : null}
        <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
      </View>
      {onBack ? (
        <Pressable onPress={onBack} accessibilityRole="button" style={[styles.iconButton, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Feather name="arrow-left" size={18} color={colors.foreground} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function SyncPill({ status }: { status: 'synced' | 'pending' }) {
  const colors = useColors();
  const pending = status === 'pending';
  return (
    <View style={[styles.syncPill, { backgroundColor: pending ? colors.pendingSurface : colors.successSurface }]}>
      <View style={[styles.syncDot, { backgroundColor: pending ? colors.primary : colors.successForeground }]} />
      <Text style={[styles.syncText, { color: pending ? colors.pendingForeground : colors.successForeground }]}>
        {pending ? 'Modifications non synchronisées' : 'Synchronisé'}
      </Text>
    </View>
  );
}

export function Button({ label, onPress, secondary = false, compact = false, icon, disabled = false }: {
  label: string; onPress: () => void; secondary?: boolean; compact?: boolean; icon?: keyof typeof Feather.glyphMap; disabled?: boolean;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        {
          backgroundColor: secondary ? colors.card : colors.primary,
          borderColor: secondary ? colors.border : colors.primary,
          opacity: disabled ? 0.45 : pressed ? 0.82 : 1,
        },
      ]}
    >
      {icon ? <Feather name={icon} size={compact ? 15 : 17} color={secondary ? colors.foreground : colors.primaryForeground} /> : null}
      <Text style={[styles.buttonText, { color: secondary ? colors.foreground : colors.primaryForeground }]}>{label}</Text>
    </Pressable>
  );
}

export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const colors = useColors();
  return (
    <View style={styles.sectionTitle}>
      <Text style={[styles.sectionHeading, { color: colors.foreground }]}>{title}</Text>
      {action && onAction ? <Pressable onPress={onAction}><Text style={[styles.sectionAction, { color: colors.primary }]}>{action}</Text></Pressable> : null}
    </View>
  );
}

export function Surface({ children, style }: PropsWithChildren<{ style?: object }>) {
  const colors = useColors();
  return <View style={[styles.surface, { backgroundColor: colors.card, borderColor: colors.border }, style]}>{children}</View>;
}

export function ValueMark({ value, size = 'medium' }: { value: string; size?: 'small' | 'medium' }) {
  const colors = useColors();
  const palette = value === 'Acquired' ? { bg: colors.accent, fg: colors.successForeground } : value === 'PartiallyAcquired' ? { bg: colors.warningSurface, fg: colors.warningForeground } : value === 'NotAcquired' ? { bg: colors.errorSurface, fg: colors.errorForeground } : { bg: colors.muted, fg: colors.mutedForeground };
  const label = value === 'Acquired' ? '+' : value === 'PartiallyAcquired' ? '±' : value === 'NotAcquired' ? '-' : '·';
  return <View style={[styles.valueMark, size === 'small' && styles.valueMarkSmall, { backgroundColor: palette.bg }]}><Text style={[styles.valueMarkText, size === 'small' && styles.valueMarkTextSmall, { color: palette.fg }]}>{label}</Text></View>;
}

export function ProgressBar({ value }: { value: number }) {
  const colors = useColors();
  return <View style={[styles.progressTrack, { backgroundColor: colors.muted }]}><View style={[styles.progressFill, { width: `${Math.max(0, Math.min(100, value))}%`, backgroundColor: colors.primary }]} /></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, width: '100%', maxWidth: 1180, alignSelf: 'center', paddingHorizontal: 20 },
  scrollContent: { flexGrow: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  headerText: { flex: 1 },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1.6, marginBottom: 7 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: -0.5 },
  iconButton: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  syncPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 20 },
  syncDot: { width: 7, height: 7, borderRadius: 4 },
  syncText: { fontSize: 12, fontWeight: '600' },
  button: { minHeight: 48, borderRadius: 14, borderWidth: 1, paddingHorizontal: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  buttonCompact: { minHeight: 38, borderRadius: 11, paddingHorizontal: 12 },
  buttonText: { fontSize: 14, fontWeight: '700' },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, marginTop: 26 },
  sectionHeading: { fontSize: 18, fontWeight: '700', letterSpacing: -0.2 },
  sectionAction: { fontSize: 13, fontWeight: '700' },
  surface: { borderWidth: 1, borderRadius: 18, padding: 16 },
  valueMark: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  valueMarkSmall: { width: 27, height: 27, borderRadius: 8 },
  valueMarkText: { fontSize: 18, fontWeight: '800' },
  valueMarkTextSmall: { fontSize: 15 },
  progressTrack: { height: 7, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 7, borderRadius: 4 },
});
