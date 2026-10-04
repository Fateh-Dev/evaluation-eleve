import { Feather } from '@expo/vector-icons';
import React, { createContext, PropsWithChildren, useContext, useState } from 'react';
import { Image, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';

type ScreenGuideValue = {
  show: (title: string, description: string) => void;
};

const ScreenGuideContext = createContext<ScreenGuideValue | null>(null);

export function Screen({ children, scroll = true, bottomPadding, onTouchStart }: PropsWithChildren<{ scroll?: boolean; bottomPadding?: number; onTouchStart?: () => void }>) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [guideMessage, setGuideMessage] = useState<{ title: string; description: string } | null>(null);
  const closeGuide = () => setGuideMessage(null);
  const guideContext = {
    show: (title: string, description: string) => setGuideMessage({ title, description }),
  };

  const content = (
    <ScreenGuideContext.Provider value={guideContext}>
      <View
        onTouchStart={onTouchStart}
        style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top + 18, paddingBottom: insets.bottom + (bottomPadding ?? 120) }]}
      >
        {children}
      </View>
      <Modal
        visible={guideMessage !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closeGuide}
      >
        <View style={styles.guideOverlay}>
          <Pressable accessible={false} onPress={closeGuide} style={styles.guideBackdrop} />
          <View style={[styles.guideCard, { backgroundColor: colors.card, borderColor: colors.border, paddingBottom: insets.bottom + 18 }]}>
            <View style={styles.guideCardHeader}>
              <View style={[styles.guideIcon, { backgroundColor: colors.accent }]}>
                <Feather name="help-circle" size={19} color={colors.primary} />
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Fermer le guide" onPress={closeGuide} hitSlop={10}>
                <Feather name="x" size={19} color={colors.mutedForeground} />
              </Pressable>
            </View>
            <Text style={[styles.guideTitle, { color: colors.foreground }]}>{guideMessage?.title}</Text>
            <Text style={[styles.guideDescription, { color: colors.mutedForeground }]}>{guideMessage?.description}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={closeGuide}
              style={({ pressed }) => [styles.guideNext, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}
            >
              <Text style={[styles.guideNextText, { color: colors.primaryForeground }]}>Compris</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScreenGuideContext.Provider>
  );
  if (!scroll) return content;
  return (
    <KeyboardAwareScrollViewCompat
      style={{ flex: 1, backgroundColor: colors.background }}
      bottomOffset={80}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {content}
    </KeyboardAwareScrollViewCompat>
  );
}

export function KeyboardAvoidingViewCompat({ children, style }: PropsWithChildren<{ style?: object }>) {
  return (
    <KeyboardAvoidingView
      style={style}
      behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}
    >
      {children}
    </KeyboardAvoidingView>
  );
}

export function AppHeader({ eyebrow, title, onBack, onTitleLongPress, titleActionArmed = false, compact = true }: { eyebrow?: string; title: string; onBack?: () => void; onTitleLongPress?: () => void; titleActionArmed?: boolean; compact?: boolean }) {
  const colors = useColors();
  const guide = useContext(ScreenGuideContext);
  return (
    <View style={[styles.header, compact && styles.compactHeader]}>
      <View style={styles.headerLeading}>
        <Image
          source={require('../assets/images/logo.png')}
          style={[styles.logo, compact && styles.compactLogo]}
          resizeMode="contain"
          accessible
          accessibilityLabel="Logo de l’établissement Chaibeddra"
        />
        <View style={[styles.headerText, titleActionArmed && { borderWidth: 2, borderColor: colors.destructive, backgroundColor: colors.card, borderRadius: 8, padding: 4 }]}>
          {eyebrow ? <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.eyebrow, { color: colors.primary }]}>{eyebrow.toUpperCase()}</Text> : null}
          <Text
            numberOfLines={2}
            ellipsizeMode="tail"
            onLongPress={onTitleLongPress}
            accessibilityHint={onTitleLongPress ? 'Maintenez appuyé pour afficher les actions de suppression.' : undefined}
            style={[styles.title, compact && styles.compactTitle, { color: colors.foreground }]}
          >
            {title}
          </Text>
        </View>
      </View>
      <View style={styles.headerActions}>
        {guide ? (
          <Pressable
            onPress={() => guide.show(title, getScreenDescription(title, eyebrow))}
            accessibilityRole="button"
            accessibilityLabel="Ouvrir le guide de cet écran"
            style={[styles.iconButton, { borderColor: colors.border, backgroundColor: colors.card }]}
          >
            <Feather name="help-circle" size={18} color={colors.primary} />
          </Pressable>
        ) : null}
        {onBack ? (
          <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Retour" style={[styles.iconButton, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Feather name="arrow-left" size={18} color={colors.foreground} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function Button({ label, onPress, secondary = false, compact = false, icon, disabled = false, onTouchStart }: {
  label: string; onPress: () => void; secondary?: boolean; compact?: boolean; icon?: keyof typeof Feather.glyphMap; disabled?: boolean; onTouchStart?: (event: import('react-native').GestureResponderEvent) => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={disabled ? undefined : () => onPress()}
      onTouchStart={onTouchStart}
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

export function GuideAnchor({ children, style }: PropsWithChildren<{
  id: string;
  title: string;
  description: string;
  style?: object;
}>) {
  return (
    <View style={style}>{children}</View>
  );
}

function getScreenDescription(title: string, eyebrow?: string) {
  if (eyebrow === 'Analyse') return 'Cette page présente la progression globale, les statistiques de présence et d’acquisition par objectif, les résultats détaillés, puis les décisions de remédiation. Utilisez « Modifier les décisions » pour les mettre à jour, ou « Exporter » pour créer un document.';
  if (eyebrow === 'Évaluation') return 'Cette page permet de suivre les élèves pendant l’évaluation : marquez leur présence, saisissez les résultats par objectif, puis enregistrez. Les actions en haut donnent accès aux objectifs, à l’analyse et aux exports.';
  if (eyebrow === 'Export') return 'Utilisez les boutons en haut pour créer un fichier Excel, Word ou PDF, ou partager le rapport. La grille ci-dessous permet de vérifier les informations et résultats avant de l’utiliser.';
  if (eyebrow === 'Nouvelle évaluation') return 'Sélectionnez d’abord la classe, puis la compétence. Complétez les détails de la séance, vérifiez les objectifs et créez l’évaluation pour commencer la saisie.';
  if (title === 'Mes Classes') return 'Consultez les classes organisées par année scolaire. Ouvrez une classe pour gérer ses élèves et compétences, ou créez une nouvelle classe.';
  if (title === 'Élèves') return 'Parcourez les élèves de la classe active, recherchez un nom et ouvrez une fiche pour consulter son historique.';
  if (title === 'Stockage') return 'Retrouvez les documents enregistrés localement. Importez, renommez ou supprimez un document ; les éléments supprimés se trouvent dans la corbeille.';
  if (title === 'Palette de couleurs') return 'Prévisualisez les palettes disponibles et sélectionnez le thème de l’application.';
  if (title === 'Paramétrage pédagogique') return 'Configurez chaque année scolaire, puis ses niveaux, compétences et objectifs associés.';
  if (title === 'Premiers réglages') return 'Renseignez le nom du professeur et de l’établissement, l’année scolaire, puis le nom et le niveau de la première classe.';
  if (title.startsWith('Classe')) return 'Consultez les informations de cette classe, gérez les élèves et ouvrez les évaluations associées.';
  if (eyebrow === 'Élève') return 'Consultez le profil de l’élève et son historique de résultats aux évaluations.';
  if (eyebrow === 'Espace enseignant') return 'Le tableau de bord résume la classe active, les évaluations et les objectifs à surveiller. Utilisez les accès rapides pour ouvrir les classes, les élèves et les évaluations.';
  if (eyebrow === 'Organisation pédagogique') return 'Gérez vos classes, sélectionnez l’année scolaire à afficher et ouvrez chaque classe pour suivre ses élèves.';
  if (eyebrow === 'Suivi pédagogique') return 'Consultez les compétences et évaluations de vos classes. Vous pouvez ouvrir une évaluation ou en créer une nouvelle.';
  if (eyebrow === 'Configuration') return 'Modifiez les informations du professeur et de l’établissement, le thème, la configuration pédagogique, la sécurité et les sauvegardes.';
  return `Cet écran « ${title} » regroupe les informations et les actions disponibles pour cette partie de l’application.`;
}

export function Surface({
  children,
  style,
  guideTitle,
  guideDescription,
}: PropsWithChildren<{
  style?: object;
  guideTitle?: string;
  guideDescription?: string;
}>) {
  const colors = useColors();
  const surface = (
    <View style={[styles.surface, { backgroundColor: colors.card, borderColor: colors.border }, style]}>
      {children}
    </View>
  );
  if (!guideTitle) return surface;
  return (
    <GuideAnchor
      id={`surface-${guideTitle}`}
      title={guideTitle}
      description={guideDescription ?? `Cette carte « ${guideTitle} » présente ses informations et actions principales.`}
    >
      {surface}
    </GuideAnchor>
  );
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
  compactHeader: { marginBottom: 10 },
  headerLeading: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerText: { flex: 1, minWidth: 0 },
  logo: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#FFFFFF' },
  compactLogo: { width: 40, height: 40, borderRadius: 20 },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1.6, marginBottom: 7 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: -0.5 },
  compactTitle: { fontSize: 20, lineHeight: 25 },
  iconButton: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  button: { minHeight: 48, borderRadius: 14, borderWidth: 1, paddingHorizontal: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  buttonCompact: { minHeight: 38, borderRadius: 11, paddingHorizontal: 12 },
  buttonText: { fontSize: 14, fontWeight: '700' },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, marginTop: 26 },
  sectionHeading: { fontSize: 18, fontWeight: '700', letterSpacing: -0.2 },
  sectionAction: { fontSize: 13, fontWeight: '700' },
  guideOverlay: { flex: 1, justifyContent: 'flex-end' },
  guideBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(10, 15, 25, 0.35)' },
  guideCard: { margin: 12, borderWidth: 1, borderRadius: 20, padding: 18, gap: 9, elevation: 20 },
  guideCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  guideIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  guideTitle: { fontSize: 18, fontWeight: '800' },
  guideDescription: { fontSize: 13, lineHeight: 19 },
  guideNext: { minHeight: 44, marginTop: 5, borderRadius: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  guideNextText: { fontSize: 13, fontWeight: '800' },
  surface: { borderWidth: 1, borderRadius: 18, padding: 16 },
  valueMark: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  valueMarkSmall: { width: 27, height: 27, borderRadius: 8 },
  valueMarkText: { fontSize: 18, fontWeight: '800' },
  valueMarkTextSmall: { fontSize: 15 },
  progressTrack: { height: 7, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 7, borderRadius: 4 },
});
