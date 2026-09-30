import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppHeader, Button, Screen, SectionTitle, Surface } from '@/components/AppShell';
import { useAppData } from '@/context/AppDataContext';
import { useColors } from '@/hooks/useColors';

export default function ClassDetailScreen() {
  const colors = useColors();
  const data = useAppData();
  const params = useLocalSearchParams<{ classId: string }>();

  const currentClassId = params.classId || data.activeClassId;
  const currentClass = useMemo(() => {
    return data.classes.find((c) => c.id === currentClassId) ?? data.activeClass;
  }, [data.classes, currentClassId, data.activeClass]);

  const classPupils = useMemo(() => {
    return data.getPupilsForClass(currentClass.id);
  }, [data.pupils, currentClass.id]);

  const classAssessments = useMemo(() => {
    return data.getAssessmentsForClass(currentClass.id);
  }, [data.assessments, currentClass.id]);

  const [activeTab, setActiveTab] = useState<'competencies' | 'pupils'>('competencies');

  return (
    <Screen>
      <AppHeader
        eyebrow={`${currentClass.level} · ${currentClass.academicYear}`}
        title={currentClass.name}
        onBack={() => router.back()}
      />

      {/* Class Overview Card */}
      <Surface style={styles.classInfo}>
        <View style={styles.infoCol}>
          <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>NIVEAU</Text>
          <Text style={[styles.infoValue, { color: colors.foreground }]}>{currentClass.level}</Text>
        </View>
        <View style={styles.infoCol}>
          <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>ÉLÈVES</Text>
          <Text style={[styles.infoValue, { color: colors.foreground }]}>{classPupils.length}</Text>
        </View>
        <View style={styles.infoCol}>
          <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>COMPÉTENCES</Text>
          <Text style={[styles.infoValue, { color: colors.primary }]}>{classAssessments.length}</Text>
        </View>
      </Surface>

      {/* Tabs Switcher: Compétences vs Élèves */}
      <View style={styles.tabBar}>
        <Pressable
          onPress={() => setActiveTab('competencies')}
          style={[
            styles.tabItem,
            {
              backgroundColor: activeTab === 'competencies' ? colors.primary : colors.card,
              borderColor: activeTab === 'competencies' ? colors.primary : colors.border,
            },
          ]}
        >
          <Feather
            name="award"
            size={16}
            color={activeTab === 'competencies' ? colors.primaryForeground : colors.foreground}
          />
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'competencies' ? colors.primaryForeground : colors.foreground },
            ]}
          >
            Compétences ({classAssessments.length})
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setActiveTab('pupils')}
          style={[
            styles.tabItem,
            {
              backgroundColor: activeTab === 'pupils' ? colors.primary : colors.card,
              borderColor: activeTab === 'pupils' ? colors.primary : colors.border,
            },
          ]}
        >
          <Feather
            name="users"
            size={16}
            color={activeTab === 'pupils' ? colors.primaryForeground : colors.foreground}
          />
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'pupils' ? colors.primaryForeground : colors.foreground },
            ]}
          >
            Élèves ({classPupils.length})
          </Text>
        </Pressable>
      </View>

      {/* TAB 1: COMPETENCIES / ASSESSMENTS */}
      {activeTab === 'competencies' && (
        <View style={styles.tabContent}>
          <SectionTitle
            title="Compétences de la classe"
            action="+ Ajouter"
            onAction={() => router.push(`/assessments/new?classId=${currentClass.id}`)}
          />

          <View style={styles.assessmentList}>
            {classAssessments.map((item) => {
              const objList = data.getObjectivesForAssessment(item.id);
              const stats = data.getStatisticsForAssessment(item.id);
              const evaluatedTotal = stats.reduce((sum, s) => sum + s.evaluated, 0);
              const totalPossible = Math.max(classPupils.length * objList.length, 1);
              const progressPercent = Math.round((evaluatedTotal / totalPossible) * 100);

              return (
                <Surface key={item.id} style={styles.assessmentCard}>
                  <View style={styles.assessmentCardHeader}>
                    <View style={styles.headerLeft}>
                      <View style={[styles.competencyBadge, { backgroundColor: colors.accent }]}>
                        <Text style={[styles.competencyBadgeText, { color: colors.accentForeground }]}>
                          {item.competency}
                        </Text>
                      </View>
                      <Text style={[styles.assessmentTitle, { color: colors.foreground }]}>
                        {item.title}
                      </Text>
                    </View>
                    <Text style={[styles.progressNumber, { color: colors.primary }]}>
                      {progressPercent}%
                    </Text>
                  </View>

                  <View style={styles.metaRow}>
                    <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                      {objList.length} objectifs
                    </Text>
                    <Text style={[styles.metaDot, { color: colors.mutedForeground }]}>•</Text>
                    <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                      {item.support || 'Support standard'}
                    </Text>
                    <Text style={[styles.metaDot, { color: colors.mutedForeground }]}>•</Text>
                    <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                      {item.date}
                    </Text>
                  </View>

                  <View style={styles.cardActions}>
                    <Button
                      label="Évaluer"
                      icon="check-square"
                      compact
                      onPress={() => {
                        data.setActiveAssessment(item.id);
                        router.push(`/assessments/${item.id}`);
                      }}
                    />
                    <Button
                      label="Exporter"
                      icon="file-text"
                      compact
                      secondary
                      onPress={() => {
                        data.setActiveAssessment(item.id);
                        router.push(`/assessments/${item.id}/document`);
                      }}
                    />
                  </View>
                </Surface>
              );
            })}
          </View>

          <Button
            label="Ajouter une compétence pour cette classe"
            icon="plus"
            secondary
            onPress={() => router.push(`/assessments/new?classId=${currentClass.id}`)}
          />
        </View>
      )}

      {/* TAB 2: PUPILS */}
      {activeTab === 'pupils' && (
        <View style={styles.tabContent}>
          <SectionTitle
            title="Élèves de la classe"
            action="Importer"
            onAction={() => router.push(`/classes/${currentClass.id}/import`)}
          />

          <View style={styles.pupilList}>
            {classPupils.map((pupil, index) => (
              <Pressable
                key={pupil.id}
                onPress={() => router.push(`/pupils/${pupil.id}`)}
                style={[styles.pupilRow, { borderBottomColor: colors.border }]}
              >
                <View
                  style={[
                    styles.avatar,
                    { backgroundColor: index % 2 ? colors.accent : colors.secondary },
                  ]}
                >
                  <Text style={[styles.avatarText, { color: colors.foreground }]}>
                    {pupil.lastName.charAt(0)}
                    {pupil.firstName.charAt(0)}
                  </Text>
                </View>
                <View style={styles.pupilCopy}>
                  <Text style={[styles.pupilName, { color: colors.foreground }]}>
                    {pupil.lastName} {pupil.firstName}
                  </Text>
                  <Text style={[styles.pupilMeta, { color: colors.mutedForeground }]}>
                    N° {pupil.registrationNumber}
                  </Text>
                </View>
                <Feather name="chevron-right" size={17} color={colors.mutedForeground} />
              </Pressable>
            ))}
          </View>

          <View style={styles.pupilActions}>
            <Button
              label="Importer des élèves (CSV/Texte)"
              icon="upload"
              secondary
              onPress={() => router.push(`/classes/${currentClass.id}/import`)}
            />
          </View>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  classInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 14,
    marginBottom: 16,
  },
  infoCol: {
    alignItems: 'center',
    gap: 4,
  },
  infoLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  infoValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  tabBar: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  tabItem: {
    flex: 1,
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
  },
  tabContent: {
    gap: 12,
    paddingBottom: 30,
  },
  assessmentList: {
    gap: 12,
  },
  assessmentCard: {
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  assessmentCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  headerLeft: {
    flex: 1,
    gap: 6,
  },
  competencyBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  competencyBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  assessmentTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  progressNumber: {
    fontSize: 18,
    fontWeight: '800',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  metaText: {
    fontSize: 11.5,
  },
  metaDot: {
    fontSize: 11.5,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  pupilList: {
    borderRadius: 14,
  },
  pupilRow: {
    minHeight: 56,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  pupilCopy: {
    flex: 1,
    gap: 2,
  },
  pupilName: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  pupilMeta: {
    fontSize: 11.5,
  },
  pupilActions: {
    marginTop: 10,
  },
});