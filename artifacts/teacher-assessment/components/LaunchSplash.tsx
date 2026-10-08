import { Feather } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const loadingMessages = ['Chargement des cours…', 'Synchronisation…', 'Presque prêt…'];

const features = [
  {
    icon: 'check' as const,
    title: 'Évaluation continue',
    description: 'Notes et compétences au fil de l’année',
  },
  {
    icon: 'clock' as const,
    title: 'Suivi des absences',
    description: 'Présences et absences en un coup d’œil',
  },
  {
    icon: 'bar-chart-2' as const,
    title: 'Bilans et progrès',
    description: 'Une vue claire de la progression de chacun',
  },
];

export function LaunchSplash() {
  const [messageIndex, setMessageIndex] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const messageTimer = setInterval(() => {
      setMessageIndex((index) => (index + 1) % loadingMessages.length);
    }, 1400);
    const progressAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(progress, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ]),
    );
    progressAnimation.start();

    return () => {
      clearInterval(messageTimer);
      progressAnimation.stop();
    };
  }, [progress]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.topDecoration} />
        <View style={styles.bottomDecoration} />

        <View style={styles.brand}>
          <View style={styles.logoTile}>
            <Feather name="book-open" size={84} color="#1F2A44" />
          </View>
          <Text style={styles.title}>Chaibeddra</Text>
          <Text style={styles.tagline}>Suivre chaque élève, jour après jour.</Text>
        </View>

        <View style={styles.details}>
          <View style={styles.subjects}>
            <Text style={[styles.subject, styles.math]}>Math</Text>
            <Text style={[styles.subject, styles.sciences]}>Sciences</Text>
            <Text style={[styles.subject, styles.languages]}>Langues</Text>
          </View>

          <View style={styles.featureList}>
            {features.map((feature) => (
              <View key={feature.title} style={styles.feature}>
                <View style={styles.featureIcon}>
                  <Feather name={feature.icon} size={20} color="#FBF6EC" />
                </View>
                <View style={styles.featureCopy}>
                  <Text style={styles.featureTitle}>{feature.title}</Text>
                  <Text style={styles.featureDescription}>{feature.description}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.loading}>
          <View style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressIndicator,
                {
                  transform: [
                    {
                      translateX: progress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-58, 140],
                      }),
                    },
                  ],
                },
              ]}
            />
          </View>
          <Text style={styles.loadingText}>{loadingMessages[messageIndex]}</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FBF6EC' },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 28,
    backgroundColor: '#FBF6EC',
  },
  topDecoration: {
    position: 'absolute',
    top: -120,
    right: -120,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: '#F2A93B',
    opacity: 0.18,
  },
  bottomDecoration: {
    position: 'absolute',
    bottom: -90,
    left: -100,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: '#2F5D62',
    opacity: 0.12,
  },
  brand: { alignItems: 'center', position: 'relative', gap: 12 },
  logoTile: {
    width: 160,
    height: 146,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 26,
    marginBottom: 4,
    backgroundColor: '#F2A93B',
    shadowColor: '#1F2A44',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 7,
  },
  title: {
    color: '#1F2A44',
    fontFamily: 'Georgia',
    fontSize: 40,
    fontWeight: '700',
    letterSpacing: -0.5,
    lineHeight: 46,
  },
  tagline: {
    color: '#4A5568',
    fontSize: 16,
    lineHeight: 23,
    textAlign: 'center',
  },
  details: { width: '100%', position: 'relative', gap: 22 },
  subjects: { flexDirection: 'row', gap: 10 },
  subject: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 18,
    paddingHorizontal: 4,
    paddingVertical: 18,
    color: '#1F2A44',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  math: { backgroundColor: '#FCE6C2' },
  sciences: { backgroundColor: '#D5E8E6' },
  languages: { backgroundColor: '#F6D8C8' },
  featureList: { gap: 14 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  featureIcon: {
    width: 40,
    height: 40,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: '#1F2A44',
  },
  featureCopy: { flex: 1, gap: 2 },
  featureTitle: { color: '#1F2A44', fontSize: 15, fontWeight: '600' },
  featureDescription: { color: '#4A5568', fontSize: 13 },
  loading: { width: '100%', alignItems: 'center', gap: 14, position: 'relative' },
  progressTrack: {
    width: 140,
    height: 4,
    overflow: 'hidden',
    borderRadius: 4,
    backgroundColor: '#E7DFCF',
  },
  progressIndicator: {
    width: 58,
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#F2A93B',
  },
  loadingText: { color: '#6B7280', fontSize: 14, fontWeight: '500' },
});
