import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppHeader, Screen, SectionTitle, Surface } from '@/components/AppShell';
import { useAppData } from '@/context/AppDataContext';
import { useColors } from '@/hooks/useColors';

type EntryAction = {
  title: string;
  detail: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  onPress: () => void;
};

function getLocalDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export default function EntryScreen() {
  const colors = useColors();
  const data = useAppData();
  const selectedClass = useMemo(
    () => data.classes.find((item) => item.id === data.activeClassId),
    [data.activeClassId, data.classes],
  );

  const actions: EntryAction[] = selectedClass
    ? [
        {
          title: 'Faire l’appel',
          detail: 'Noter les présences de la classe',
          icon: 'check-circle',
          onPress: () =>
            router.push({
              pathname: '/classes/[classId]/attendance',
              params: { classId: selectedClass.id, date: getLocalDate() },
            }),
        },
        {
          title: 'Saisir le suivi continu',
          detail: 'Renseigner le cahier et la participation',
          icon: 'edit-3',
          onPress: () => router.push(`/classes/${selectedClass.id}`),
        },
        {
          title: 'Créer une évaluation',
          detail: 'Préparer une évaluation de compétence',
          icon: 'plus-circle',
          onPress: () =>
            router.push({
              pathname: '/assessments/new',
              params: { classId: selectedClass.id },
            }),
        },
        {
          title: 'Évaluation diagnostique',
          detail: 'Choisir une séance diagnostique à évaluer',
          icon: 'search',
          onPress: () =>
            router.push({
              pathname: '/assessments/pick-diagnostic-session',
              params: { classId: selectedClass.id },
            }),
        },
      ]
    : [];

  return (
    <Screen>
      <AppHeader eyebrow="Vos tâches courantes" title="Saisie" />

      {data.classes.length ? (
        <>
          <SectionTitle title="Choisir une classe" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.classChoices}
          >
            {data.classes.map((item) => {
              const selected = item.id === selectedClass?.id;
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => data.setActiveClass(item.id)}
                  style={[
                    styles.classChoice,
                    {
                      backgroundColor: selected ? colors.primary : colors.card,
                      borderColor: selected ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.classChoiceName,
                      {
                        color: selected
                          ? colors.primaryForeground
                          : colors.foreground,
                      },
                    ]}
                  >
                    {item.name}
                  </Text>
                  <Text
                    style={[
                      styles.classChoiceDetail,
                      {
                        color: selected
                          ? colors.primaryForeground
                          : colors.mutedForeground,
                      },
                    ]}
                  >
                    {item.level}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {selectedClass ? (
            <>
              <Text style={[styles.context, { color: colors.mutedForeground }]}>
                Actions pour {selectedClass.name}
              </Text>
              <View style={styles.actions}>
                {actions.map((action) => (
                  <Pressable
                    key={action.title}
                    accessibilityRole="button"
                    onPress={action.onPress}
                    style={({ pressed }) => [
                      styles.actionRow,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                        opacity: pressed ? 0.75 : 1,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.actionIcon,
                        { backgroundColor: colors.accent },
                      ]}
                    >
                      <Feather
                        name={action.icon}
                        size={20}
                        color={colors.primary}
                      />
                    </View>
                    <View style={styles.actionCopy}>
                      <Text
                        style={[styles.actionTitle, { color: colors.foreground }]}
                      >
                        {action.title}
                      </Text>
                      <Text
                        style={[
                          styles.actionDetail,
                          { color: colors.mutedForeground },
                        ]}
                      >
                        {action.detail}
                      </Text>
                    </View>
                    <Feather
                      name="chevron-right"
                      size={18}
                      color={colors.mutedForeground}
                    />
                  </Pressable>
                ))}
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/continuous')}
                style={styles.secondaryLink}
              >
                <Feather name="calendar" size={16} color={colors.primary} />
                <Text style={[styles.secondaryText, { color: colors.primary }]}>
                  Périodes et tests de niveau initial
                </Text>
                <Feather name="chevron-right" size={16} color={colors.primary} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/assessments')}
                style={styles.secondaryLink}
              >
                <Feather name="clipboard" size={16} color={colors.primary} />
                <Text style={[styles.secondaryText, { color: colors.primary }]}>
                  Voir les évaluations créées
                </Text>
                <Feather name="chevron-right" size={16} color={colors.primary} />
              </Pressable>
            </>
          ) : null}
        </>
      ) : (
        <Surface style={styles.empty}>
          <View style={[styles.actionIcon, { backgroundColor: colors.accent }]}>
            <Feather name="users" size={20} color={colors.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            Commencez par créer une classe
          </Text>
          <Text style={[styles.emptyDetail, { color: colors.mutedForeground }]}>
            Vous pourrez ensuite faire l’appel et saisir les évaluations depuis cet écran.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/classes')}
            style={[styles.createClass, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.createClassText, { color: colors.primaryForeground }]}>
              Créer une classe
            </Text>
          </Pressable>
        </Surface>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  classChoices: { gap: 8, paddingBottom: 4 },
  classChoice: {
    height: 58,
    minWidth: 112,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  classChoiceName: { fontSize: 14, fontWeight: '700' },
  classChoiceDetail: { fontSize: 12, marginTop: 3 },
  context: { fontSize: 13, marginTop: 10, marginBottom: 8 },
  actions: { gap: 9 },
  actionRow: {
    minHeight: 72,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCopy: { flex: 1, gap: 3 },
  actionTitle: { fontSize: 15, fontWeight: '700' },
  actionDetail: { fontSize: 12 },
  secondaryLink: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 5,
  },
  secondaryText: { flex: 1, fontSize: 13, fontWeight: '600' },
  empty: { alignItems: 'center', gap: 12, padding: 22 },
  emptyTitle: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  emptyDetail: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
  createClass: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: 12 },
  createClassText: { fontSize: 14, fontWeight: '700' },
});
