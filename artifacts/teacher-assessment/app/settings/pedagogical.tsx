import { router } from 'expo-router';
import React from 'react';
import { AppHeader, Screen } from '@/components/AppShell';
import PedagogicalConfigurationManager from '@/components/PedagogicalConfigurationManager';

export default function PedagogicalSettingsScreen() {
  return (
    <Screen>
      <AppHeader
        eyebrow="Paramètres"
        title="Configuration pédagogique"
        onBack={() => router.back()}
      />
      <PedagogicalConfigurationManager />
    </Screen>
  );
}
