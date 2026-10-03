import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import React, { PropsWithChildren, createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { Button } from '@/components/AppShell';

const PIN_KEY = '@teacher-assessment/app-pin-v1';
const BIOMETRIC_KEY = '@teacher-assessment/biometric-enabled-v1';
type SecurityContextValue = {
  ready: boolean;
  hasPin: boolean;
  locked: boolean;
  biometricAvailable: boolean;
  biometricEnabled: boolean;
  setPin: (pin: string) => Promise<void>;
  removePin: () => Promise<void>;
  unlock: (pin: string) => Promise<boolean>;
  setBiometricEnabled: (enabled: boolean) => Promise<void>;
  authenticateBiometric: () => Promise<boolean>;
  lock: () => void;
};
const SecurityContext = createContext<SecurityContextValue | null>(null);

async function hashPin(pin: string) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, pin);
}

export function SecurityProvider({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const [locked, setLocked] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabledState] = useState(false);

  useEffect(() => {
    Promise.all([
      SecureStore.getItemAsync(PIN_KEY),
      SecureStore.getItemAsync(BIOMETRIC_KEY),
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]).then(([storedPin, storedBiometric, hasHardware, isEnrolled]) => {
      const configured = Boolean(storedPin);
      setHasPin(configured);
      setLocked(configured);
      setBiometricAvailable(Boolean(hasHardware && isEnrolled));
      setBiometricEnabledState(Boolean(configured && storedBiometric === 'true' && hasHardware && isEnrolled));
      setReady(true);
    }).catch(() => setReady(true));
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active' && hasPin) setLocked(true);
    });
    return () => subscription.remove();
  }, [hasPin]);

  const value = useMemo<SecurityContextValue>(() => ({
    ready,
    hasPin,
    locked,
    biometricAvailable,
    biometricEnabled,
    setPin: async (pin) => {
      await SecureStore.setItemAsync(PIN_KEY, await hashPin(pin));
      setHasPin(true);
      setLocked(false);
    },
    removePin: async () => {
      await SecureStore.deleteItemAsync(PIN_KEY);
      await SecureStore.deleteItemAsync(BIOMETRIC_KEY);
      setHasPin(false);
      setBiometricEnabledState(false);
      setLocked(false);
    },
    unlock: async (pin) => {
      const saved = await SecureStore.getItemAsync(PIN_KEY);
      const valid = Boolean(saved && saved === await hashPin(pin));
      if (valid) setLocked(false);
      return valid;
    },
    setBiometricEnabled: async (enabled) => {
      await SecureStore.setItemAsync(BIOMETRIC_KEY, enabled ? 'true' : 'false');
      setBiometricEnabledState(enabled);
    },
    authenticateBiometric: async () => {
      if (!biometricAvailable) return false;
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Déverrouiller Évaluation Élève',
        cancelLabel: 'Utiliser le code PIN',
        disableDeviceFallback: true,
      });
      if (result.success) setLocked(false);
      return result.success;
    },
    lock: () => { if (hasPin) setLocked(true); },
  }), [ready, hasPin, locked, biometricAvailable, biometricEnabled]);

  return <SecurityContext.Provider value={value}>{children}</SecurityContext.Provider>;
}

export function useSecurity() {
  const context = useContext(SecurityContext);
  if (!context) throw new Error('useSecurity must be used within SecurityProvider');
  return context;
}

export function AppLockGate({ children }: PropsWithChildren) {
  const security = useSecurity();
  const colors = useColors();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [biometricAttempted, setBiometricAttempted] = useState(false);

  useEffect(() => {
    if (!security.ready || !security.locked) {
      setBiometricAttempted(false);
      return;
    }
    if (security.biometricEnabled && security.biometricAvailable && !biometricAttempted) {
      setBiometricAttempted(true);
      void security.authenticateBiometric();
    }
  }, [security.ready, security.locked, security.biometricEnabled, security.biometricAvailable, biometricAttempted]);

  if (!security.ready) return null;
  if (!security.hasPin || !security.locked) return <>{children}</>;

  const handleUnlock = async () => {
    if (await security.unlock(pin)) {
      setPin('');
      setError('');
    } else {
      setPin('');
      setError('Code PIN incorrect.');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.icon, { backgroundColor: colors.accent }]}>
          <Feather name="lock" size={27} color={colors.primary} />
        </View>
        <Text style={[styles.title, { color: colors.foreground }]}>Application verrouillée</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{security.biometricEnabled && security.biometricAvailable ? 'Utilisez votre visage ou votre empreinte, ou saisissez votre code PIN.' : 'Entrez votre code PIN pour accéder à vos données.'}</Text>
        <TextInput
          value={pin}
          onChangeText={(value) => { setPin(value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
          placeholder="Code PIN"
          placeholderTextColor={colors.mutedForeground}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={6}
          autoFocus
          onSubmitEditing={handleUnlock}
          style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
        />
        {error ? <Text style={[styles.error, { color: colors.errorForeground }]}>{error}</Text> : null}
        <Button label="Déverrouiller" icon="unlock" onPress={handleUnlock} disabled={pin.length < 4} />
        <Pressable onPress={() => setPin('')}><Text style={[styles.hint, { color: colors.mutedForeground }]}>Code de 4 à 6 chiffres</Text></Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 420, borderWidth: 1, borderRadius: 24, padding: 24, alignItems: 'center', gap: 14 },
  icon: { width: 64, height: 64, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '800', textAlign: 'center' },
  subtitle: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
  input: { width: '100%', borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, fontSize: 22, textAlign: 'center', letterSpacing: 8 },
  error: { fontSize: 13, fontWeight: '700' },
  hint: { fontSize: 12 },
});
