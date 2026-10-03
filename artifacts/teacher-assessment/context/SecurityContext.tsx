import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import React, { PropsWithChildren, createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

const PIN_KEY = 'teacher-assessment-app-pin-v1';
const BIOMETRIC_KEY = 'teacher-assessment-biometric-enabled-v1';
const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;
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
  // SecureStore encrypts this value at rest on supported devices.
  return pin;
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

  const inactiveSinceRef = useRef<number | null>(null);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const clearInactivityTimer = () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    };
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (!hasPin) return;
      if (nextState === 'active') {
        const inactiveSince = inactiveSinceRef.current;
        clearInactivityTimer();
        inactiveSinceRef.current = null;
        if (inactiveSince !== null && Date.now() - inactiveSince >= INACTIVITY_TIMEOUT_MS) {
          setLocked(true);
        }
        return;
      }
      if (inactiveSinceRef.current === null) {
        inactiveSinceRef.current = Date.now();
        clearInactivityTimer();
        inactivityTimerRef.current = setTimeout(() => setLocked(true), INACTIVITY_TIMEOUT_MS);
      }
    });
    return () => {
      subscription.remove();
      clearInactivityTimer();
    };
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
  const handleUnlock = async (value: string) => {
    if (value.length !== 4) return;
    if (await security.unlock(value)) {
      setPin('');
      setError('');
    } else {
      setPin('');
      setError('Code PIN incorrect.');
    }
  };
  const handleKey = (key: string) => {
    if (pin.length >= 4) return;
    const nextPin = `${pin}${key}`;
    setPin(nextPin);
    setError('');
    if (nextPin.length === 4) void handleUnlock(nextPin);
  };
  const handleBackspace = () => {
    setPin((current) => current.slice(0, -1));
    setError('');
  };
  const keypadRows = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']];
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.lockScreen}>
        <View style={[styles.icon, { backgroundColor: colors.accent }]}>
          <Feather name="key" size={42} color={colors.primary} />
        </View>
        <Text style={[styles.title, { color: colors.foreground }]}>Entrez le code PIN</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Saisissez votre code PIN pour accéder à vos données</Text>
        <View style={styles.pinDots} accessibilityLabel={`${pin.length} chiffres saisis sur 4`}>
          {[0, 1, 2, 3].map((index) => (
            <View key={index} style={[styles.pinDot, { backgroundColor: index < pin.length ? colors.primary : colors.muted, borderColor: index < pin.length ? colors.primary : colors.border }]}>
              {index < pin.length ? <View style={[styles.pinDotInner, { backgroundColor: colors.primaryForeground }]} /> : null}
            </View>
          ))}
        </View>
        {error ? <Text style={[styles.error, { color: colors.errorForeground }]}>{error}</Text> : <Text style={[styles.hint, { color: colors.mutedForeground }]}>Code de 4 chiffres</Text>}
        {security.biometricEnabled && security.biometricAvailable ? (
          <Pressable onPress={() => { void security.authenticateBiometric(); }} style={({ pressed }) => [styles.biometricButton, { borderColor: colors.border, backgroundColor: colors.card, opacity: pressed ? 0.7 : 1 }]}>
            <Feather name="shield" size={17} color={colors.primary} />
            <Text style={[styles.biometricText, { color: colors.primary }]}>Utiliser le visage / l’empreinte</Text>
          </Pressable>
        ) : null}
        <View style={styles.keypad}>
          {keypadRows.flat().map((key) => (
            <Pressable key={key} onPress={() => handleKey(key)} style={({ pressed }) => [styles.key, { backgroundColor: colors.muted, opacity: pressed ? 0.65 : 1 }]} accessibilityRole="button" accessibilityLabel={`Chiffre ${key}`}>
              <Text style={[styles.keyText, { color: colors.foreground }]}>{key}</Text>
            </Pressable>
          ))}
          <View style={styles.keySpacer} />
          <Pressable onPress={() => handleKey('0')} style={({ pressed }) => [styles.key, { backgroundColor: colors.muted, opacity: pressed ? 0.65 : 1 }]} accessibilityRole="button" accessibilityLabel="Chiffre 0">
            <Text style={[styles.keyText, { color: colors.foreground }]}>0</Text>
          </Pressable>
          <Pressable onPress={handleBackspace} style={({ pressed }) => [styles.key, { backgroundColor: colors.muted, opacity: pressed ? 0.65 : 1 }]} accessibilityRole="button" accessibilityLabel="Effacer">
            <Feather name="delete" size={22} color={colors.foreground} />
          </Pressable>
        </View>
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
  biometricButton: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, marginTop: 10 },
  biometricText: { fontSize: 13, fontWeight: '700' },
  error: { fontSize: 13, fontWeight: '700', minHeight: 18 },
  hint: { fontSize: 12, minHeight: 18 },
});
