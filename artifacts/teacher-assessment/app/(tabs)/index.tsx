import { Feather } from '@expo/vector-icons';
import { Redirect, router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { AppState, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Alert } from '@/components/AppDialog';
import { AppHeader, Button, ProgressBar, Screen, SectionTitle, Surface } from '@/components/AppShell';
import { useAppData } from '@/context/AppDataContext';
import { useColors } from '@/hooks/useColors';
import {
  calculateAbsenceScore,
  calculateContinuousTotal,
  calculateDisciplineScore,
  getContinuousEvaluationProgress,
} from '@/services/continuousEvaluation';
import {
  exportClassAttendancePdf,
  exportContinuousEvaluationPdf,
  exportSchedulePdf,
} from '@/services/exportService';
import { getScheduleOccurrencesForDate, getScheduleTimeline, WEEKDAYS } from '@/services/schedule';

export default function DashboardScreen() {
  const colors = useColors();
  const data = useAppData();
  const [now, setNow] = useState(() => new Date());
  const [classPickerVisible, setClassPickerVisible] = useState(false);
  const [exportingDailyOutput, setExportingDailyOutput] = useState<
    'absences' | 'continuous' | 'schedule' | null
  >(null);

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

  const activeYearClassIds = new Set(
    data.classes
      .filter((item) => item.academicYear === data.academicYear)
      .map((item) => item.id),
  );
  const activeYearSessions = data.scheduleSessions.filter((session) =>
    activeYearClassIds.has(session.classId),
  );
  const activeYearSessionIds = new Set(activeYearSessions.map((session) => session.id));
  const activeYearOverrides = data.scheduleOccurrenceOverrides.filter((override) =>
    override.status === 'extra'
      ? activeYearClassIds.has(override.classId)
      : Boolean(override.sourceSessionId && activeYearSessionIds.has(override.sourceSessionId)),
  );
  const { current: currentSession, next: nextSession } = getScheduleTimeline(
    activeYearSessions,
    now,
    activeYearOverrides,
  );
  const currentSessionClass = currentSession
    ? data.classes.find((item) => item.id === currentSession.classId)
    : undefined;
  const nextSessionClass = nextSession
    ? data.classes.find((item) => item.id === nextSession.classId)
    : undefined;
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const todayOccurrences = getScheduleOccurrencesForDate(
    activeYearSessions,
    activeYearOverrides,
    today,
  );

  const hasClasses = data.classes.length > 0;
  const activeClass = hasClasses ? data.activeClass : undefined;
  const activeClassPupils = activeClass
    ? data.getPupilsForClass(activeClass.id)
    : [];
  const className = activeClass?.name ?? 'Aucune classe';
  const pupilCount = activeClassPupils.length;
  const dailyClass = currentSessionClass ?? activeClass;
  const dailyClassPupils = dailyClass ? data.getPupilsForClass(dailyClass.id) : [];
  const dailyPeriod = dailyClass
    ? data.getActiveContinuousEvaluationPeriod(dailyClass.academicYear)
    : undefined;
  const dailyEvaluationProgress = dailyClass
    ? getContinuousEvaluationProgress(
        dailyClassPupils.map((pupil) => pupil.id),
        dailyClass.id,
        dailyClass.academicYear,
        data.continuousEvaluations,
        dailyPeriod?.id,
      )
    : getContinuousEvaluationProgress([], '', '', []);
  const activeEvaluationPeriod = activeClass
    ? data.getActiveContinuousEvaluationPeriod(activeClass.academicYear)
    : undefined;
  const evaluationProgress = activeClass
    ? getContinuousEvaluationProgress(
        activeClassPupils.map((pupil) => pupil.id),
        activeClass.id,
        activeClass.academicYear,
        data.continuousEvaluations,
        activeEvaluationPeriod?.id,
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
    ? data.getAttendanceRecordsForClass(activeClass.id).filter((record) =>
        !activeEvaluationPeriod ||
        (record.date >= activeEvaluationPeriod.startDate &&
          record.date <= activeEvaluationPeriod.endDate),
      )
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
  const currentAttendance = currentSession && currentSessionClass
    ? data.getAttendanceRecord(currentSessionClass.id, currentSession.id, today)
    : undefined;
  const currentSessionPupils = currentSessionClass
    ? data.getPupilsForClass(currentSessionClass.id)
    : [];
  const needsAttendance = Boolean(
    currentSessionClass && currentSessionPupils.length > 0 && !currentAttendance,
  );
  const attendanceSession = dailyClass
    ? currentSessionClass?.id === dailyClass.id
      ? currentSession
      : (() => {
          const sessions = todayOccurrences.filter((session) => session.classId === dailyClass.id);
          const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
          return sessions.find((session) => session.startTime > currentTime) ?? sessions[sessions.length - 1];
        })()
    : undefined;
  const dailyAttendance = dailyClass && attendanceSession
    ? data.getAttendanceRecord(dailyClass.id, attendanceSession.id, attendanceSession.occurrenceDate)
    : undefined;
  const needsDailyAttendance = Boolean(
    dailyClass && attendanceSession && dailyClassPupils.length > 0 && !dailyAttendance,
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
    const attendanceClass = dailyClass;
    if (!attendanceClass) return;
    if (!attendanceSession) {
      Alert.alert(
        'Aucune séance prévue',
        `Aucune séance n’est programmée aujourd’hui pour ${attendanceClass.name}. Consultez l’emploi du temps pour choisir ou ajouter une séance.`,
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Emploi du temps', onPress: () => router.push('/schedule') },
        ],
      );
      return;
    }
    router.push({
      pathname: '/classes/[classId]/attendance',
      params: {
        classId: attendanceClass.id,
        sessionId: attendanceSession.id,
        date: attendanceSession.occurrenceDate,
      },
    });
  };
  const exportDailyOutput = async (kind: 'absences' | 'continuous' | 'schedule') => {
    if ((!dailyClass && kind !== 'schedule') || exportingDailyOutput) return;
    setExportingDailyOutput(kind);
    try {
      if (kind === 'absences') {
        const reportClass = dailyClass!;
        const records = data.getAttendanceRecordsForClass(reportClass.id).filter((record) =>
          !dailyPeriod || (
            record.date >= dailyPeriod.startDate &&
            record.date <= dailyPeriod.endDate
          ),
        );
        await exportClassAttendancePdf({
          schoolName: data.school.name,
          teacherName: data.teacherName,
          className: reportClass.name,
          level: reportClass.level,
          academicYear: reportClass.academicYear,
          periodName: dailyPeriod?.name,
          periodStartDate: dailyPeriod?.startDate,
          periodEndDate: dailyPeriod?.endDate,
          pupils: dailyClassPupils.map((pupil) => {
            const counts = records.reduce(
              (totals, record) => {
                if (record.statuses[pupil.id] === 'present') totals.present += 1;
                if (record.statuses[pupil.id] === 'present' || record.statuses[pupil.id] === 'absent') {
                  totals.total += 1;
                }
                return totals;
              },
              { present: 0, total: 0 },
            );
            return {
              registrationNumber: pupil.registrationNumber,
              firstName: pupil.firstName,
              lastName: pupil.lastName,
              present: counts.present,
              absent: counts.total - counts.present,
              total: counts.total,
              absentDates: records
                .filter((record) => record.statuses[pupil.id] === 'absent')
                .sort((left, right) => left.date.localeCompare(right.date))
                .map((record) => new Date(`${record.date}T00:00:00`).toLocaleDateString('fr-FR')),
            };
          }),
        });
      } else if (kind === 'continuous') {
        const reportClass = dailyClass!;
        const periodRecords = data.getAttendanceRecordsForClass(reportClass.id).filter((record) =>
          !dailyPeriod ||
          (record.date >= dailyPeriod.startDate && record.date <= dailyPeriod.endDate),
        );
        await exportContinuousEvaluationPdf({
          schoolName: data.school.name,
          teacherName: data.teacherName,
          className: reportClass.name,
          level: reportClass.level,
          academicYear: reportClass.academicYear,
          evaluationPeriodName: dailyPeriod?.name,
          evaluationPeriodStartDate: dailyPeriod?.startDate,
          evaluationPeriodEndDate: dailyPeriod?.endDate,
          pupils: dailyClassPupils.map((pupil) => {
            const evaluation = data.getContinuousEvaluation(
              pupil.id,
              reportClass.id,
              reportClass.academicYear,
              dailyPeriod?.id,
            );
            const attendance = periodRecords.reduce(
              (totals, record) => {
                if (record.statuses[pupil.id] === 'present') totals.present += 1;
                if (record.statuses[pupil.id] === 'present' || record.statuses[pupil.id] === 'absent') {
                  totals.total += 1;
                }
                return totals;
              },
              { present: 0, total: 0 },
            );
            const events = evaluation
              ? data.getDisciplineEventsForEvaluation(evaluation.id)
              : [];
            const absenceScore = calculateAbsenceScore({
              totalSessions: attendance.total,
              presentCount: attendance.present,
              absentCount: attendance.total - attendance.present,
            }, {
              maximumScore: 5,
              penaltyPerAbsence: data.continuousEvaluationSettings.absencePenaltyPerAbsence,
            });
            const disciplineScore = calculateDisciplineScore(events.map((event) => event.penalty));
            const evaluationComplete =
              evaluation?.cahierScore !== undefined &&
              evaluation.participationScore !== undefined;
            return {
              registrationNumber: pupil.registrationNumber,
              firstName: pupil.firstName,
              lastName: pupil.lastName,
              cahierScore: evaluation?.cahierScore,
              participationScore: evaluation?.participationScore,
              absenceScore,
              disciplineScore,
              totalScore: calculateContinuousTotal({
                cahierScore: evaluation?.cahierScore ?? 0,
                participationScore: evaluation?.participationScore ?? 0,
                absenceScore,
                disciplineScore,
              }),
              evaluationComplete,
              presentSessions: attendance.present,
              absentSessions: attendance.total - attendance.present,
              attendanceSessions: attendance.total,
            };
          }),
        });
      } else {
        await exportSchedulePdf({
          teacherName: data.teacherName,
          schoolName: data.school.name,
          city: data.school.wilaya,
          academicYear: data.academicYear,
          sessions: activeYearSessions.map((session) => ({
            dayOfWeek: session.dayOfWeek,
            startTime: session.startTime,
            endTime: session.endTime,
            className: data.classes.find((item) => item.id === session.classId)?.name ?? 'Classe supprimée',
            subject: session.subject,
            room: session.room,
            notes: session.notes,
          })),
        });
      }
    } catch (error) {
      Alert.alert(
        'Impression impossible',
        error instanceof Error ? error.message : 'Le document PDF n’a pas pu être préparé.',
      );
    } finally {
      setExportingDailyOutput(null);
    }
  };

  const teacherGreeting = data.teacherName ? `Bonjour, ${data.teacherName}` : 'Bonjour, Enseignant';

  if (!data.hydrated) return null;
  if (!data.teacherName && !data.school.name && !hasClasses) {
    return <Redirect href="/onboarding" />;
  }

  if (data.interfaceMode === 'daily') {
    return (
      <Screen>
        <AppHeader eyebrow="Mode quotidien" title={teacherGreeting} />
        {activeClass ? (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Classe active : ${className}. Ouvrir les classes pour en choisir une autre.`}
              onPress={() => router.push('/classes')}
              style={[styles.activeContext, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={[styles.contextIcon, { backgroundColor: colors.accent }]}>
                <Feather name="users" size={18} color={colors.primary} />
              </View>
              <View style={styles.contextCopy}>
                <Text style={[styles.contextEyebrow, { color: colors.mutedForeground }]}>CLASSE CHOISIE · TOUCHER POUR MODIFIER</Text>
                <Text style={[styles.contextTitle, { color: colors.foreground }]}>{className}</Text>
                <Text style={[styles.contextMeta, { color: colors.mutedForeground }]}>
                  {activeClass.level} · {activeClass.academicYear} · {pupilCount} élèves
                </Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </Pressable>
            {currentSessionClass && activeClass && currentSessionClass.id !== activeClass.id ? (
              <Text style={[styles.rowSubtitle, { color: colors.mutedForeground, marginTop: 8 }]}>
                Séance en cours : {currentSessionClass.name}. Les actions rapides ciblent cette classe ; votre classe choisie reste {activeClass.name}.
              </Text>
            ) : null}
            <View style={styles.dailyPeriod}>
              <Text style={[styles.contextEyebrow, { color: colors.mutedForeground }]}>
                PÉRIODE DE {dailyClass?.name ?? className}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.periodChoices}>
                {dailyClass && data.getContinuousEvaluationPeriods(dailyClass.academicYear).map((period) => {
                  const selected = period.id === dailyPeriod?.id;
                  return (
                    <Pressable
                      key={period.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => data.setActiveContinuousEvaluationPeriod(dailyClass.academicYear, period.id)}
                      style={[styles.periodChip, {
                        backgroundColor: selected ? colors.primary : colors.card,
                        borderColor: selected ? colors.primary : colors.border,
                      }]}
                    >
                      <Text style={[styles.periodChipText, { color: selected ? colors.primaryForeground : colors.foreground }]}>
                        {period.name}
                      </Text>
                    </Pressable>
                  );
                })}
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push('/continuous')}
                  style={[styles.managePeriodsChip, { borderColor: colors.border }]}
                >
                  <Feather name="settings" size={14} color={colors.mutedForeground} />
                </Pressable>
              </ScrollView>
            </View>
            <SectionTitle title="Actions rapides" />
            <Surface style={styles.dailyCard}>
              <Pressable accessibilityRole="button" onPress={openAttendance} style={styles.dailyTask}>
                <View style={[styles.dailyTaskIcon, { backgroundColor: needsDailyAttendance ? colors.warningSurface : colors.accent }]}>
                  <Feather name="check-circle" size={19} color={needsDailyAttendance ? colors.warningForeground : colors.primary} />
                </View>
                <View style={styles.rowCopy}>
                  <Text style={[styles.rowTitle, { color: colors.foreground }]}>Faire l’appel</Text>
                  <Text style={[styles.rowSubtitle, { color: colors.mutedForeground }]}>
                    {dailyClass ? `${dailyClass.name}${attendanceSession ? ` · ${attendanceSession.startTime}–${attendanceSession.endTime}` : ''}` : 'Choisissez une classe'}
                    {dailyAttendance ? ' · déjà saisi, modifier' : ''}
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={!dailyClass}
                onPress={() => dailyClass && openClass(dailyClass.id)}
                style={[styles.dailyTask, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}
              >
                <View style={[styles.dailyTaskIcon, { backgroundColor: colors.accent }]}>
                  <Feather name="edit-3" size={18} color={colors.primary} />
                </View>
                <View style={styles.rowCopy}>
                  <Text style={[styles.rowTitle, { color: colors.foreground }]}>Évaluation continue</Text>
                  <Text style={[styles.rowSubtitle, { color: colors.mutedForeground }]}>
                    {dailyClass
                      ? dailyEvaluationProgress.incompleteCount > 0
                        ? `${dailyClass.name} · ${dailyEvaluationProgress.incompleteCount} à compléter`
                        : `${dailyClass.name} · ${dailyPeriod?.name ?? 'période active'}`
                      : 'Choisissez une classe pour accéder au suivi'}
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
              </Pressable>
            </Surface>
            <SectionTitle title="États de sortie" />
            <Surface style={styles.dailyCard}>
              <Button
                label={exportingDailyOutput === 'absences' ? 'Préparation…' : `Imprimer les absences · ${dailyPeriod?.name ?? 'année'}`}
                icon="printer"
                secondary
                compact
                disabled={Boolean(exportingDailyOutput) || !dailyClass}
                onPress={() => { void exportDailyOutput('absences'); }}
              />
              <Button
                label={exportingDailyOutput === 'continuous' ? 'Préparation…' : 'Imprimer les résultats d’évaluation continue'}
                icon="printer"
                secondary
                compact
                disabled={Boolean(exportingDailyOutput) || !dailyClass}
                onPress={() => { void exportDailyOutput('continuous'); }}
              />
              <Button
                label={exportingDailyOutput === 'schedule' ? 'Préparation…' : 'Imprimer l’emploi du temps'}
                icon="printer"
                secondary
                compact
                disabled={Boolean(exportingDailyOutput)}
                onPress={() => { void exportDailyOutput('schedule'); }}
              />
            </Surface>
            <SectionTitle title="Programme" action="Consulter" onAction={() => router.push('/schedule')} />
            <Surface style={styles.dailyCard}>
              <Text style={[styles.rowSubtitle, { color: colors.mutedForeground }]}>
                {now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </Text>
              {todayOccurrences.length ? todayOccurrences.map((session, index) => {
                const sessionClass = data.classes.find((item) => item.id === session.classId);
                if (!sessionClass) return null;
                const isCurrent = session.id === currentSession?.id && session.occurrenceDate === currentSession.occurrenceDate;
                const isNext = session.id === nextSession?.id && session.occurrenceDate === nextSession.occurrenceDate;
                const status = isCurrent ? 'EN COURS' : isNext ? 'SUIVANTE' : session.endTime <= `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}` ? 'TERMINÉE' : '';
                return (
                  <Pressable
                    key={`${session.id}-${session.occurrenceDate}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Ouvrir ${sessionClass.name}, ${session.startTime} à ${session.endTime}`}
                    onPress={() => {
                      data.setActiveClass(sessionClass.id);
                      router.push({
                        pathname: '/classes/[classId]',
                        params: {
                          classId: sessionClass.id,
                          sessionId: session.id,
                          attendanceDate: session.occurrenceDate,
                        },
                      });
                    }}
                    style={[
                      styles.dailyTask,
                      index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
                    ]}
                  >
                    <View style={[styles.dailyTaskIcon, { backgroundColor: isCurrent ? colors.successSurface : colors.accent }]}>
                      <Feather name={isCurrent ? 'clock' : 'calendar'} size={18} color={colors.primary} />
                    </View>
                    <View style={styles.rowCopy}>
                      <Text style={[styles.rowTitle, { color: colors.foreground }]}>
                        {status ? `${status} · ` : ''}{sessionClass.name}
                      </Text>
                      <Text style={[styles.rowSubtitle, { color: colors.mutedForeground }]}>
                        {session.startTime}–{session.endTime}
                        {session.subject ? ` · ${session.subject}` : ''}
                        {session.room ? ` · ${session.room}` : ''}
                      </Text>
                    </View>
                    <Feather name="arrow-right" size={18} color={colors.primary} />
                  </Pressable>
                );
              }) : (
                <Text style={[styles.rowSubtitle, { color: colors.mutedForeground }]}>Aucune séance programmée aujourd’hui.</Text>
              )}
              {nextSession && nextSessionClass && nextSession.occurrenceDate !== today ? (
                <View style={[styles.dailyTask, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
                  <View style={[styles.dailyTaskIcon, { backgroundColor: colors.accent }]}>
                    <Feather name="calendar" size={18} color={colors.primary} />
                  </View>
                  <View style={styles.rowCopy}>
                    <Text style={[styles.rowTitle, { color: colors.foreground }]}>Prochaine séance · {nextSessionClass.name}</Text>
                    <Text style={[styles.rowSubtitle, { color: colors.mutedForeground }]}>
                      {new Date(`${nextSession.occurrenceDate}T00:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} · {nextSession.startTime}–{nextSession.endTime}
                    </Text>
                  </View>
                </View>
              ) : null}
            </Surface>
          </>
        ) : (
          <Surface style={styles.dailyCard}>
            <Text style={[styles.rowTitle, { color: colors.foreground }]}>Commencez par créer une classe</Text>
            <Text style={[styles.rowSubtitle, { color: colors.mutedForeground }]}>Ajoutez une classe et ses élèves pour accéder à l’appel et au suivi.</Text>
            <Button label="Créer une classe" icon="plus" onPress={() => router.push('/classes')} />
          </Surface>
        )}
        <View style={styles.dailyFooter}>
          <Button
            label="Mode complet"
            secondary
            compact
            icon="maximize-2"
            onPress={() => data.setInterfaceMode('full')}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader eyebrow="Espace enseignant" title={teacherGreeting} />
      {hasClasses ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Classe active : ${className}. Choisir une autre classe.`}
            onPress={() => setClassPickerVisible(true)}
            style={[styles.activeContext, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <View style={[styles.contextIcon, { backgroundColor: colors.accent }]}>
              <Feather name="users" size={18} color={colors.primary} />
            </View>
            <View style={styles.contextCopy}>
              <Text style={[styles.contextEyebrow, { color: colors.mutedForeground }]}>CLASSE ACTIVE</Text>
              <Text style={[styles.contextTitle, { color: colors.foreground }]}>{className}</Text>
              <Text style={[styles.contextMeta, { color: colors.mutedForeground }]}>
                {activeClass?.level} · {activeClass?.academicYear} · {pupilCount} élèves
              </Text>
            </View>
            <Feather name="chevron-down" size={18} color={colors.mutedForeground} />
          </Pressable>
          <View style={styles.dashboardPeriods}>
            <Text style={[styles.contextEyebrow, { color: colors.mutedForeground }]}>TRIMESTRE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.periodChoices}>
              {data.getContinuousEvaluationPeriods(activeClass!.academicYear).map((period) => {
                const selected = period.id === activeEvaluationPeriod?.id;
                return (
                  <Pressable
                    key={period.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => data.setActiveContinuousEvaluationPeriod(activeClass!.academicYear, period.id)}
                    style={[
                      styles.periodChip,
                      {
                        backgroundColor: selected ? colors.primary : colors.card,
                        borderColor: selected ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text style={[
                      styles.periodChipText,
                      { color: selected ? colors.primaryForeground : colors.foreground },
                    ]}>
                      {period.name}
                    </Text>
                  </Pressable>
                );
              })}
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/continuous')}
                style={[styles.managePeriodsChip, { borderColor: colors.border }]}
              >
                <Feather name="settings" size={14} color={colors.mutedForeground} />
              </Pressable>
            </ScrollView>
          </View>
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
                    {className} · {activeEvaluationPeriod?.name ?? 'période active'} · cahier : {missingCahierCount} · participation : {missingParticipationCount}
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
                  <Text style={[styles.rowTitle, { color: colors.foreground }]}>Tout est à jour</Text>
                  <Text style={[styles.rowSubtitle, { color: colors.mutedForeground }]}>
                    {pupilCount
                      ? `Les évaluations de ${className} sont complètes pour ${activeEvaluationPeriod?.name ?? 'la période active'}.`
                      : `Ajoutez des élèves à ${className} pour commencer le suivi.`}
                  </Text>
                </View>
              </View>
            ) : null}
          </Surface>
        </>
      ) : null}
      <SectionTitle title="Emploi du temps" action="Gérer" onAction={() => router.push('/schedule')} />
      <Surface style={styles.scheduleCard}>
        <View style={styles.scheduleHeading}>
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
        </View>
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
                  attendanceDate: currentSession.occurrenceDate,
                },
              });
            }}
          />
        ) : null}
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
            <Text style={[styles.heroKicker, { color: colors.primary }]}>
              {activeClass!.academicYear} · {activeEvaluationPeriod?.name ?? 'Aucune période'}
            </Text>
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
          <View style={styles.disclosureHeader}>
            <View style={styles.disclosureCopy}>
              <Text style={[styles.disclosureTitle, { color: colors.foreground }]}>Repères de la classe</Text>
              <Text style={[styles.disclosureSummary, { color: colors.mutedForeground }]} numberOfLines={1}>
                {continuousEvaluatedCount}/{pupilCount} complètes
                {' · '}Moyenne {manualScoreAverage}/5
                {' · '}Présence {attendanceRate === null ? '—' : `${attendanceRate}%`}
              </Text>
            </View>
          </View>
          <View style={styles.indicatorGrid}>
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
          </View>
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

      <View style={styles.disclosureHeader}>
        <View style={styles.disclosureCopy}>
          <Text style={[styles.disclosureTitle, { color: colors.foreground }]}>Accès rapide</Text>
          <Text style={[styles.disclosureSummary, { color: colors.mutedForeground }]}>
            Évaluation continue · Classes & élèves
          </Text>
        </View>
      </View>
      <View style={styles.quickGrid}>
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
      </View>
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
      <Modal
        visible={classPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setClassPickerVisible(false)}
      >
        <View style={styles.pickerBackdrop}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fermer le choix de classe"
            onPress={() => setClassPickerVisible(false)}
            style={StyleSheet.absoluteFill}
          />
          <Surface style={[styles.classPicker, { backgroundColor: colors.card }]}>
            <View style={styles.pickerHeading}>
              <View>
                <Text style={[styles.pickerTitle, { color: colors.foreground }]}>Choisir une classe</Text>
                <Text style={[styles.pickerSubtitle, { color: colors.mutedForeground }]}>La classe active du tableau de bord</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Fermer"
                onPress={() => setClassPickerVisible(false)}
                hitSlop={10}
              >
                <Feather name="x" size={20} color={colors.mutedForeground} />
              </Pressable>
            </View>
            <ScrollView
              style={styles.pickerList}
              contentContainerStyle={styles.pickerRows}
              showsVerticalScrollIndicator={false}
            >
              {data.classes.map((classItem) => {
                const selected = classItem.id === data.activeClassId;
                return (
                  <Pressable
                    key={classItem.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => {
                      data.setActiveClass(classItem.id);
                      setClassPickerVisible(false);
                    }}
                    style={[
                      styles.pickerRow,
                      { borderColor: colors.border, backgroundColor: selected ? colors.accent : colors.card },
                    ]}
                  >
                    <Feather name="users" size={17} color={selected ? colors.primary : colors.mutedForeground} />
                    <View style={styles.contextCopy}>
                      <Text style={[styles.rowTitle, { color: colors.foreground }]}>{classItem.name}</Text>
                      <Text style={[styles.rowSubtitle, { color: colors.mutedForeground }]}>
                        {classItem.level} · {classItem.academicYear} · {data.getPupilsForClass(classItem.id).length} élèves
                      </Text>
                    </View>
                    {selected ? <Feather name="check" size={18} color={colors.primary} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
            <Button label="Gérer les classes" secondary compact onPress={() => {
              setClassPickerVisible(false);
              router.push('/classes');
            }} />
          </Surface>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  activeContext: { minHeight: 72, borderWidth: 1, borderRadius: 15, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 11 },
  contextIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  contextCopy: { flex: 1, minWidth: 0, gap: 2 },
  contextEyebrow: { fontSize: 9, lineHeight: 13, fontWeight: '800', letterSpacing: 1 },
  contextTitle: { fontSize: 15, fontWeight: '800' },
  contextMeta: { fontSize: 11, lineHeight: 15 },
  dashboardPeriods: { gap: 6, marginTop: 10, marginBottom: 2 },
  dailyPeriod: { gap: 6, marginTop: 14 },
  dailyCard: { gap: 10, padding: 14 },
  dailyTask: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  dailyTaskIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  dailyFooter: { marginTop: 18, marginBottom: 12 },
  periodChoices: { alignItems: 'center', gap: 7, paddingRight: 4 },
  periodChip: { minHeight: 34, borderWidth: 1, borderRadius: 999, justifyContent: 'center', paddingHorizontal: 13 },
  periodChipText: { fontSize: 11, fontWeight: '700' },
  managePeriodsChip: { width: 34, height: 34, borderWidth: 1, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  pickerBackdrop: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#00000066' },
  classPicker: { width: '100%', maxWidth: 460, alignSelf: 'center', gap: 9, maxHeight: '80%', borderRadius: 18, padding: 16 },
  pickerList: { flexShrink: 1 },
  pickerRows: { gap: 8, paddingVertical: 2 },
  pickerHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 4 },
  pickerTitle: { fontSize: 18, fontWeight: '800' },
  pickerSubtitle: { fontSize: 12, marginTop: 2 },
  pickerRow: { minHeight: 58, borderWidth: 1, borderRadius: 12, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 10 },
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
