import { Feather } from '@expo/vector-icons';
import { Redirect, router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppHeader, Button, ProgressBar, Screen, SectionTitle, Surface } from '@/components/AppShell';
import { useAppData } from '@/context/AppDataContext';
import { useColors } from '@/hooks/useColors';
import { getContinuousEvaluationProgress } from '@/services/continuousEvaluation';
import { getScheduleTimeline, WEEKDAYS } from '@/services/schedule';

export default function DashboardScreen() {
  const colors = useColors();
  const data = useAppData();
  const [now, setNow] = useState(() => new Date());
  const [scheduleExpanded, setScheduleExpanded] = useState(false);
  const [indicatorsExpanded, setIndicatorsExpanded] = useState(false);
  const [quickAccessExpanded, setQuickAccessExpanded] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setNow(new Date());
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);

  const { current: currentSession, next: nextSession } = getScheduleTimeline(data.scheduleSessions, now);
  const currentSessionClass = currentSession
    ? data.classes.find((item) => item.id === currentSession.classId)
    : undefined;
  const nextSessionClass = nextSession
    ? data.classes.find((item) => item.id === nextSession.classId)
    : undefined;

  useEffect(() => {
    if (data.hydrated && currentSessionClass) data.setActiveClass(currentSessionClass.id);
  }, [currentSession?.id, currentSessionClass?.id, data.hydrated]);

  const hasClasses = data.classes.length > 0;
  const activeClass = hasClasses ? data.activeClass : undefined;
  const activeClassPupils = activeClass
    ? data.getPupilsForClass(activeClass.id)
    : [];
  const className = activeClass?.name ?? 'Aucune classe';
  const pupilCount = activeClassPupils.length;
  const evaluationProgress = activeClass
    ? getContinuousEvaluationProgress(
        activeClassPupils.map((pupil) => pupil.id),
        activeClass.id,
        activeClass.academicYear,
        data.continuousEvaluations,
      )
    : getContinuousEvaluationProgress([], '', '', []);
  const {
    completedCount: continuousEvaluatedCount,
    incompleteCount: incompleteEvaluationCount,
    missingCahierCount,
    missingParticipationCount,
    completionPercent: continuousCompletion,
  } = evaluationProgress;
  const manualScoreAverage = evaluationProgress.averageEnteredScore === null
    ? '—'
    : evaluationProgress.averageEnteredScore.toLocaleString('fr-FR', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })
    ;
  const activeClassAttendance = activeClass
    ? data.getAttendanceRecordsForClass(activeClass.id)
    : [];
  const attendanceTotals = activeClassAttendance.reduce(
    (totals, record) => {
      for (const pupil of activeClassPupils) {
        const status = record.statuses[pupil.id];
        if (status === 'present' || status === 'absent') {
          totals.marked += 1;
          if (status === 'present') totals.present += 1;
        }
      }
      return totals;
    },
    { present: 0, marked: 0 },
  );
  const attendanceRate = attendanceTotals.marked
    ? Math.round((attendanceTotals.present / attendanceTotals.marked) * 100)
    : null;
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const currentAttendance = currentSession && currentSessionClass
    ? data.getAttendanceRecord(currentSessionClass.id, currentSession.id, today)
    : undefined;
  const currentSessionPupils = currentSessionClass
    ? data.getPupilsForClass(currentSessionClass.id)
    : [];
  const needsAttendance = Boolean(
    currentSessionClass && currentSessionPupils.length > 0 && !currentAttendance,
  );
  const openClass = (classId: string, filter?: 'incomplete') => {
    data.setActiveClass(classId);
    router.push({
      pathname: '/classes/[classId]',
      params: {
        classId,
        ...(filter ? { evaluationFilter: filter } : {}),
      },
    });
  };
  const openAttendance = () => {
    if (!currentSession || !currentSessionClass) return;
    data.setActiveClass(currentSessionClass.id);
    router.push({
      pathname: '/classes/[classId]/attendance',
      params: {
        classId: currentSessionClass.id,
        sessionId: currentSession.id,
        date: today,
      },
    });
  };

  const teacherGreeting = data.teacherName ? `Bonjour, ${data.teacherName}` : 'Bonjour, Enseignant';

  if (!data.hydrated) return null;
  if (!data.teacherName && !data.school.name && !hasClasses) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <Screen>
      <AppHeader eyebrow="Espace enseignant" title={teacherGreeting} />
      <SectionTitle title="Emploi du temps" action="Gérer" onAction={() => router.push('/schedule')} />
      <Surface style={styles.scheduleCard}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={scheduleExpanded ? 'Réduire l’emploi du temps' : 'Afficher les détails de l’emploi du temps'}
          accessibilityState={{ expanded: scheduleExpanded }}
          onPress={() => setScheduleExpanded((expanded) => !expanded)}
          style={styles.scheduleHeading}
        >
          <View style={[styles.scheduleIcon, { backgroundColor: currentSessionClass ? colors.successSurface : colors.muted }]}>
            <Feather name={currentSessionClass ? 'clock' : 'calendar'} size={18} color={currentSessionClass ? colors.successForeground : colors.mutedForeground} />
          </View>
          <View style={styles.rowCopy}>
            <Text style={[styles.scheduleLabel, { color: colors.foreground }]}>
              {currentSessionClass
                ? `Séance actuelle · ${currentSessionClass.name}`
                : 'Aucune séance actuellement'}
            </Text>
            {currentSessionClass && currentSession ? (
              <Text style={[styles.rowSubtitle, { color: colors.mutedForeground }]} numberOfLines={1}>
                {WEEKDAYS[currentSession.dayOfWeek]} · {currentSession.startTime} – {currentSession.endTime}
                {currentSession.subject ? ` · ${currentSession.subject}` : ''}
              </Text>
            ) : (
              <Text style={[styles.rowSubtitle, { color: colors.mutedForeground }]}>Aucune classe n’est sélectionnée par l’emploi du temps.</Text>
            )}
          </View>
          <Feather
            name={scheduleExpanded ? 'chevron-up' : 'chevron-down'}
            size={19}
            color={colors.mutedForeground}
          />
        </Pressable>
        {currentSessionClass && currentSession ? (
          <Button
            label="Continuer la séance"
            icon="arrow-right"
            compact
            onPress={() => {
              data.setActiveClass(currentSessionClass.id);
              router.push({
                pathname: '/classes/[classId]',
                params: {
                  classId: currentSessionClass.id,
                  sessionId: currentSession.id,
                  attendanceDate: today,
                },
              });
            }}
          />
        ) : null}
        {scheduleExpanded ? (
          <>
            <View style={[styles.nextSession, { borderTopColor: colors.border }]}>
              <Feather name="info" size={15} color={colors.mutedForeground} />
              <View style={styles.rowCopy}>
                <Text style={[styles.nextLabel, { color: colors.mutedForeground }]}>Prochaine séance</Text>
                {nextSession && nextSessionClass ? (
                  <Text style={[styles.rowSubtitle, { color: colors.foreground }]}>
                    <Text style={{ fontWeight: '700' }}>{nextSessionClass.name}</Text>
                    {' · '}{WEEKDAYS[nextSession.dayOfWeek]} · {nextSession.startTime} – {nextSession.endTime}
                    {nextSession.room ? ` · ${nextSession.room}` : ''}
                  </Text>
                ) : (
                  <Text style={[styles.rowSubtitle, { color: colors.mutedForeground }]}>Aucune autre séance programmée</Text>
                )}
              </View>
            </View>
            <Button label="Gérer l’emploi du temps" secondary compact icon="calendar" onPress={() => router.push('/schedule')} />
          </>
        ) : null}
      </Surface>

      {!hasClasses ? (
        <View style={[styles.hero, { backgroundColor: colors.hero }]}>
          <View style={styles.heroCopy}>
            <Text style={[styles.heroKicker, { color: colors.primary }]}>Démarrage</Text>
            <Text style={[styles.heroTitle, { color: colors.heroForeground }]}>
              Bienvenue dans votre espace
            </Text>
            <Text style={[styles.heroMeta, { color: colors.heroForeground }]}>
              Votre base de données est prête. Créez votre première classe pour commencer à évaluer vos compétences.
            </Text>
            <View style={{ marginTop: 6 }}>
              <Button
                label="Créer ma première classe"
                icon="plus"
                onPress={() => router.push('/classes')}
              />
            </View>
          </View>
          <View style={[styles.heroBadge, { backgroundColor: colors.accent }]}>
            <Feather name="layers" color={colors.primary} size={31} />
            <Text style={[styles.heroBadgeText, { color: colors.foreground }]}>
              Prêt pour vos classes
            </Text>
          </View>
        </View>
      ) : (
        <View style={[styles.hero, { backgroundColor: colors.hero }]}>
          <View style={styles.heroCopy}>
            <Text style={[styles.heroKicker, { color: colors.primary }]}>Année scolaire · {activeClass!.academicYear}</Text>
            <Text style={[styles.heroTitle, { color: colors.heroForeground }]}>Évaluation continue</Text>
            <Text style={[styles.heroMeta, { color: colors.heroForeground }]}>
              {className} · Notes, présences et discipline dans un seul suivi.
            </Text>
            <View style={styles.heroProgressRow}>
              <Text style={[styles.progressLabel, { color: colors.heroForeground }]}>
                {continuousEvaluatedCount}/{pupilCount} élèves avec les deux notes saisies
              </Text>
              <Text style={[styles.progressCount, { color: colors.heroForeground }]}>
                {continuousCompletion}%
              </Text>
            </View>
            <ProgressBar value={continuousCompletion} />
            <Button
              label="Évaluer la classe"
              icon="arrow-right"
              onPress={() => openClass(activeClass!.id)}
            />
          </View>
          <View style={[styles.heroBadge, { backgroundColor: colors.accent }]}>
            <Feather name="check-square" color={colors.primary} size={31} />
            <Text style={[styles.heroBadgeText, { color: colors.foreground }]}>
              {continuousEvaluatedCount}/{pupilCount} suivis
            </Text>
          </View>
        </View>
      )}

      {hasClasses ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={indicatorsExpanded ? 'Réduire les repères de la classe' : 'Afficher les repères de la classe'}
            accessibilityState={{ expanded: indicatorsExpanded }}
            onPress={() => setIndicatorsExpanded((expanded) => !expanded)}
            style={styles.disclosureHeader}
          >
            <View style={styles.disclosureCopy}>
              <Text style={[styles.disclosureTitle, { color: colors.foreground }]}>Repères de la classe</Text>
              {!indicatorsExpanded ? (
                <Text style={[styles.disclosureSummary, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {continuousEvaluatedCount}/{pupilCount} complètes
                  {' · '}Moyenne {manualScoreAverage}/5
                  {' · '}Présence {attendanceRate === null ? '—' : `${attendanceRate}%`}
                </Text>
              ) : null}
            </View>
            <Feather name={indicatorsExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.mutedForeground} />
          </Pressable>
          {indicatorsExpanded ? <View style={styles.indicatorGrid}>
            <Surface style={styles.indicatorCard}>
              <Feather name="check-circle" size={17} color={colors.primary} />
              <Text style={[styles.indicatorValue, { color: colors.foreground }]}>
                {continuousEvaluatedCount}/{pupilCount}
              </Text>
              <Text style={[styles.indicatorLabel, { color: colors.mutedForeground }]}>
                évaluations complètes
              </Text>
            </Surface>
            <Surface style={styles.indicatorCard}>
              <Feather name="bar-chart-2" size={17} color={colors.primary} />
              <Text style={[styles.indicatorValue, { color: colors.foreground }]}>
                {manualScoreAverage}<Text style={styles.indicatorUnit}>/5</Text>
              </Text>
              <Text style={[styles.indicatorLabel, { color: colors.mutedForeground }]}>
                moyenne des notes saisies
              </Text>
            </Surface>
            <Surface style={styles.indicatorCard}>
              <Feather name="user-check" size={17} color={colors.primary} />
              <Text style={[styles.indicatorValue, { color: colors.foreground }]}>
                {attendanceRate === null ? '—' : `${attendanceRate}%`}
              </Text>
              <Text style={[styles.indicatorLabel, { color: colors.mutedForeground }]}>
                présence moyenne
              </Text>
            </Surface>
          </View> : null}
        </>
      ) : null}

      {hasClasses ? (
        <>
          <SectionTitle title="À faire aujourd’hui" />
          <Surface style={styles.actionCard}>
            {needsAttendance ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Faire l’appel pour ${currentSessionClass?.name}`}
                onPress={openAttendance}
                style={styles.actionRow}
              >
                <Feather name="check-circle" size={18} color={colors.warningForeground} />
                <View style={styles.rowCopy}>
                  <Text style={[styles.rowTitle, { color: colors.foreground }]}>Appel à faire</Text>
                  <Text style={[styles.rowSubtitle, { color: colors.mutedForeground }]}>
                    {currentSessionClass?.name} · séance en cours
                  </Text>
                </View>
                <View style={[styles.actionButton, { backgroundColor: colors.accent }]}>
                  <Feather name="arrow-right" size={17} color={colors.primary} />
                </View>
              </Pressable>
            ) : null}
            {incompleteEvaluationCount > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Compléter l’évaluation de ${incompleteEvaluationCount} élève${incompleteEvaluationCount === 1 ? '' : 's'} dans ${className}`}
                onPress={() => openClass(activeClass!.id, 'incomplete')}
                style={[
                  styles.actionRow,
                  needsAttendance && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 10 },
                ]}
              >
                <Feather name="edit-3" size={18} color={colors.primary} />
                <View style={styles.rowCopy}>
                  <Text style={[styles.rowTitle, { color: colors.foreground }]}>
                    {incompleteEvaluationCount} élève{incompleteEvaluationCount === 1 ? '' : 's'} à compléter
                  </Text>
                  <Text style={[styles.rowSubtitle, { color: colors.mutedForeground }]}>
                    {className} · cahier : {missingCahierCount} · participation : {missingParticipationCount}
                  </Text>
                </View>
                <View style={[styles.actionButton, { backgroundColor: colors.accent }]}>
                  <Feather name="arrow-right" size={17} color={colors.primary} />
                </View>
              </Pressable>
            ) : null}
            {!needsAttendance && incompleteEvaluationCount === 0 ? (
              <View style={styles.actionRow}>
                <Feather name="check-circle" size={18} color={colors.successForeground} />
                <View style={styles.rowCopy}>
                  <Text style={[styles.rowTitle, { color: colors.foreground }]}>
                    Rien à compléter
                  </Text>
                  <Text style={[styles.rowSubtitle, { color: colors.mutedForeground }]}>
                    {pupilCount
                      ? `Les notes de suivi de ${className} sont complètes.`
                      : `Ajoutez des élèves à ${className} pour commencer le suivi.`}
                  </Text>
                </View>
              </View>
            ) : null}
          </Surface>
        </>
      ) : null}

      <SectionTitle
        title="Mes classes"
        action={hasClasses ? 'Voir tout' : '+ Nouvelle classe'}
        onAction={() => router.push('/classes')}
      />
      {hasClasses ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Ouvrir la classe ${className}`}
          onPress={() => openClass(activeClass!.id)}
          style={({ pressed }) => [
            styles.classRow,
            { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <View style={[styles.classIcon, { backgroundColor: colors.secondary }]}>
            <Feather name="users" size={19} color={colors.foreground} />
          </View>
          <View style={styles.rowCopy}>
            <Text style={[styles.rowTitle, { color: colors.foreground }]}>{className}</Text>
            <Text style={[styles.rowSubtitle, { color: colors.mutedForeground }]}>
              {activeClass?.level} · {pupilCount} élève{pupilCount === 1 ? '' : 's'} · {activeClass?.academicYear}
            </Text>
          </View>
          <View style={[styles.actionButton, { backgroundColor: colors.accent }]}>
            <Feather name="arrow-right" size={17} color={colors.primary} />
          </View>
        </Pressable>
      ) : (
        <Surface style={styles.emptyCard}>
          <Feather name="users" size={24} color={colors.mutedForeground} />
          <Text style={[styles.emptyCardTitle, { color: colors.foreground }]}>
            Aucune classe enregistrée
          </Text>
          <Text style={[styles.emptyCardText, { color: colors.mutedForeground }]}>
            Créez une classe (ex: 2AS LPH, 1AS ST) pour commencer votre suivi.
          </Text>
          <Button label="Ajouter une classe" compact icon="plus" onPress={() => router.push('/classes')} />
        </Surface>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={quickAccessExpanded ? 'Réduire les accès rapides' : 'Afficher les accès rapides'}
        accessibilityState={{ expanded: quickAccessExpanded }}
        onPress={() => setQuickAccessExpanded((expanded) => !expanded)}
        style={styles.disclosureHeader}
      >
        <View style={styles.disclosureCopy}>
          <Text style={[styles.disclosureTitle, { color: colors.foreground }]}>Accès rapide</Text>
          {!quickAccessExpanded ? (
            <Text style={[styles.disclosureSummary, { color: colors.mutedForeground }]}>
              Évaluation continue · Classes & élèves
            </Text>
          ) : null}
        </View>
        <Feather name={quickAccessExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.mutedForeground} />
      </Pressable>
      {quickAccessExpanded ? <View style={styles.quickGrid}>
        <Pressable
          onPress={() => router.push('/continuous')}
          style={[styles.quickCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Feather name="check-square" size={22} color={colors.primary} />
          <Text style={[styles.quickTitle, { color: colors.foreground }]}>Évaluation continue</Text>
          <Text style={[styles.quickText, { color: colors.mutedForeground }]}>
            {continuousEvaluatedCount}/{pupilCount} élèves évalués pour la classe active
          </Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/classes')}
          style={[styles.quickCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Feather name="users" size={22} color={colors.primary} />
          <Text style={[styles.quickTitle, { color: colors.foreground }]}>Classes & Élèves</Text>
          <Text style={[styles.quickText, { color: colors.mutedForeground }]}>
            {data.classes.length} classe{data.classes.length > 1 ? 's' : ''}
          </Text>
        </Pressable>
      </View> : null}
      <View style={styles.overviewFooter}>
        <Text style={[styles.overviewFooterText, { color: colors.mutedForeground }]}>
          Vue d’ensemble · {data.classes.length} classe{data.classes.length === 1 ? '' : 's'} · {data.pupils.length} élève{data.pupils.length === 1 ? '' : 's'}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/schedule')}
          style={[styles.scheduleLink, { backgroundColor: colors.secondary }]}
        >
          <Feather name="calendar" size={15} color={colors.foreground} />
          <Text style={[styles.scheduleLinkText, { color: colors.foreground }]}>Planning</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { marginTop: 12, borderRadius: 18, padding: 16, flexDirection: 'row', gap: 12, overflow: 'hidden' },
  scheduleCard: { gap: 9, padding: 12 },
  scheduleHeading: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10 },
  scheduleIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  scheduleLabel: { fontSize: 13, fontWeight: '700' },
  scheduleClass: { fontSize: 16, lineHeight: 20, fontWeight: '800', marginTop: 2 },
  nextSession: { borderTopWidth: 1, paddingTop: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  nextLabel: { fontSize: 11, fontWeight: '700', marginBottom: 3 },
  heroCopy: { flex: 1, gap: 10 },
  heroKicker: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  heroTitle: { fontSize: 21, lineHeight: 26, fontWeight: '700' },
  heroMeta: { fontSize: 12, lineHeight: 16 },
  heroProgressRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, gap: 8 },
  progressLabel: { flex: 1, fontSize: 12, fontWeight: '700' },
  progressCount: { fontSize: 12, fontWeight: '800' },
  heroBadge: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', padding: 9, gap: 4, alignSelf: 'center' },
  heroBadgeText: { textAlign: 'center', fontSize: 10, lineHeight: 12, fontWeight: '700' },
  actionCard: { gap: 5, padding: 10, marginBottom: 10 },
  actionRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4 },
  actionButton: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  disclosureHeader: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6, paddingVertical: 4 },
  disclosureCopy: { flex: 1, gap: 2 },
  disclosureTitle: { fontSize: 15, fontWeight: '800' },
  disclosureSummary: { fontSize: 11, lineHeight: 15 },
  indicatorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  indicatorCard: { flexGrow: 1, flexBasis: '30%', minWidth: 100, gap: 7, padding: 12 },
  indicatorValue: { fontSize: 20, lineHeight: 24, fontWeight: '800' },
  indicatorUnit: { fontSize: 12, fontWeight: '700' },
  indicatorLabel: { fontSize: 10, lineHeight: 14 },
  classRow: { minHeight: 60, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  classIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1, gap: 3 },
  rowTitle: { fontSize: 15, fontWeight: '700' },
  rowSubtitle: { fontSize: 12, lineHeight: 17 },
  quickGrid: { flexDirection: 'row', gap: 8, paddingBottom: 16 },
  quickCard: { flex: 1, minHeight: 94, borderWidth: 1, borderRadius: 14, padding: 12, gap: 5 },
  quickTitle: { fontSize: 13, fontWeight: '700', marginTop: 2 },
  quickText: { fontSize: 11, lineHeight: 15 },
  overviewFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingBottom: 20 },
  overviewFooterText: { fontSize: 11 },
  scheduleLink: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, borderRadius: 9 },
  scheduleLinkText: { fontSize: 11, fontWeight: '700' },
  emptyCard: { padding: 20, alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16 },
  emptyCardTitle: { fontSize: 15, fontWeight: '700', marginTop: 4 },
  emptyCardText: { fontSize: 13, textAlign: 'center', marginBottom: 6 },
});
