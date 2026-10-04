import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Crypto from 'expo-crypto';
import React, { PropsWithChildren, createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { PinEntryScreen } from '@/components/PinEntryScreen';
import { RecoveryCodeDialog } from '@/components/RecoveryCodeDialog';
import { useColors } from '@/hooks/useColors';

const PIN_KEY = 'teacher-assessment-app-pin-v1';
const BIOMETRIC_KEY = 'teacher-assessment-biometric-enabled-v1';
const RECOVERY_CODE_KEY = 'teacher-assessment-pin-recovery-hash-v1';
const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;
type SecurityContextValue = {
  ready: boolean;
  hasPin: boolean;
  locked: boolean;
  biometricAvailable: boolean;
  biometricEnabled: boolean;
  setPin: (pin: string) => Promise<string>;
  removePin: () => Promise<void>;
  unlock: (pin: string) => Promise<boolean>;
  createRecoveryCode: (pin: string) => Promise<string | null>;
  recoverPin: (code: string, newPin: string) => Promise<string | null>;
  setBiometricEnabled: (enabled: boolean) => Promise<void>;
  authenticateBiometric: () => Promise<boolean>;
  lock: () => void;
};
const SecurityContext = createContext<SecurityContextValue | null>(null);

async function hashPin(pin: string) {
  // SecureStore encrypts this value at rest on supported devices.
  return pin;
}

function normalizeRecoveryCode(code: string) {
  return code.replace(/[^a-f\d]/gi, '').toUpperCase();
}

async function hashRecoveryCode(code: string) {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    normalizeRecoveryCode(code),
  );
}

function generateRecoveryCode() {
  const bytes = Crypto.getRandomBytes(12);
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
  return hex.match(/.{1,6}/g)?.join('-') ?? hex;
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
      const recoveryCode = generateRecoveryCode();
      const recoveryHash = await hashRecoveryCode(recoveryCode);
      await SecureStore.setItemAsync(RECOVERY_CODE_KEY, recoveryHash);
      try {
        await SecureStore.setItemAsync(PIN_KEY, await hashPin(pin));
      } catch (error) {
        await SecureStore.deleteItemAsync(RECOVERY_CODE_KEY);
        throw error;
      }
      setHasPin(true);
      setLocked(false);
      return recoveryCode;
    },
    removePin: async () => {
      await SecureStore.deleteItemAsync(PIN_KEY);
      await SecureStore.deleteItemAsync(BIOMETRIC_KEY);
      await SecureStore.deleteItemAsync(RECOVERY_CODE_KEY);
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
    createRecoveryCode: async (pin) => {
      const savedPin = await SecureStore.getItemAsync(PIN_KEY);
      if (!savedPin || savedPin !== await hashPin(pin)) return null;
      const recoveryCode = generateRecoveryCode();
      await SecureStore.setItemAsync(RECOVERY_CODE_KEY, await hashRecoveryCode(recoveryCode));
      return recoveryCode;
    },
    recoverPin: async (code, newPin) => {
      if (!/^\d{4}$/.test(newPin)) return null;
      const savedHash = await SecureStore.getItemAsync(RECOVERY_CODE_KEY);
      if (!savedHash || normalizeRecoveryCode(code).length !== 24) return null;
      const suppliedHash = await hashRecoveryCode(code);
      if (savedHash !== suppliedHash) return null;

      const nextRecoveryCode = generateRecoveryCode();
      const nextRecoveryHash = await hashRecoveryCode(nextRecoveryCode);
      await SecureStore.setItemAsync(RECOVERY_CODE_KEY, nextRecoveryHash);
      try {
        await SecureStore.setItemAsync(PIN_KEY, await hashPin(newPin));
      } catch (error) {
        await SecureStore.setItemAsync(RECOVERY_CODE_KEY, savedHash);
        throw error;
      }
      setHasPin(true);
      setLocked(false);
      return nextRecoveryCode;
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
  const [recoveryVisible, setRecoveryVisible] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState('');
  const [recoveryInput, setRecoveryInput] = useState('');
  const [newRecoveryPin, setNewRecoveryPin] = useState('');
  const [confirmRecoveryPin, setConfirmRecoveryPin] = useState('');
  const [recoveryError, setRecoveryError] = useState('');
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
  const finishRecovery = async () => {
    if (newRecoveryPin.length !== 4 || confirmRecoveryPin.length !== 4) {
      setRecoveryError('Saisissez et confirmez un nouveau code PIN à 4 chiffres.');
      return;
    }
    if (newRecoveryPin !== confirmRecoveryPin) {
      setRecoveryError('Les deux nouveaux codes PIN ne correspondent pas.');
      return;
    }
    try {
      const nextRecoveryCode = await security.recoverPin(recoveryInput, newRecoveryPin);
      if (!nextRecoveryCode) {
        setRecoveryError('Code de récupération invalide ou déjà utilisé.');
        return;
      }
      setRecoveryVisible(false);
      setRecoveryInput('');
      setNewRecoveryPin('');
      setConfirmRecoveryPin('');
      setRecoveryError('');
      setPin('');
      setError('');
      setRecoveryCode(nextRecoveryCode);
    } catch {
      setRecoveryError('La récupération a échoué. Vérifiez votre connexion sécurisée et réessayez.');
    }
  };

  if (!security.ready) return null;
  if (!security.hasPin || !security.locked) {
    return (
      <>
        {children}
        <RecoveryCodeDialog code={recoveryCode} onDone={() => setRecoveryCode('')} />
      </>
    );
  }
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
  return (
    <>
    <PinEntryScreen
      title="Entrez le code PIN"
      subtitle="Saisissez votre code PIN pour accéder à vos données"
      pin={pin}
      error={error}
      onDigit={handleKey}
      onBackspace={handleBackspace}
    >
        {security.biometricEnabled && security.biometricAvailable ? (
          <Pressable onPress={() => { void security.authenticateBiometric(); }} style={({ pressed }) => [styles.biometricButton, { borderColor: colors.border, backgroundColor: colors.card, opacity: pressed ? 0.7 : 1 }]}>
            <Feather name="shield" size={17} color={colors.primary} />
            <Text style={[styles.biometricText, { color: colors.primary }]}>Utiliser le visage / l’empreinte</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => {
            setRecoveryInput('');
            setNewRecoveryPin('');
            setConfirmRecoveryPin('');
            setRecoveryError('');
            setRecoveryVisible(true);
          }}
          accessibilityRole="button"
          style={({ pressed }) => [styles.recoveryButton, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Text style={[styles.recoveryLink, { color: colors.primary }]}>J’ai oublié mon code PIN</Text>
        </Pressable>
    </PinEntryScreen>
    <Modal visible={recoveryVisible} transparent animationType="fade" onRequestClose={() => setRecoveryVisible(false)}>
        <View style={styles.recoveryBackdrop}>
          <View style={[styles.recoveryPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.recoveryIcon, { backgroundColor: colors.accent }]}>
              <Feather name="key" size={21} color={colors.primary} />
            </View>
            <Text style={[styles.recoveryTitle, { color: colors.foreground }]}>Récupérer l’accès</Text>
            <Text style={[styles.recoveryDescription, { color: colors.mutedForeground }]}>
              Saisissez votre code de récupération, puis choisissez un nouveau PIN. Le code de récupération sera remplacé après utilisation.
            </Text>
            <TextInput
              value={recoveryInput}
              onChangeText={(value) => { setRecoveryInput(value.toUpperCase()); setRecoveryError(''); }}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder="XXXXXX-XXXXXX-XXXXXX-XXXXXX"
              placeholderTextColor={colors.mutedForeground}
              accessibilityLabel="Code de récupération"
              style={[styles.recoveryInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
            />
            <TextInput
              value={newRecoveryPin}
              onChangeText={(value) => { setNewRecoveryPin(value.replace(/\D/g, '').slice(0, 4)); setRecoveryError(''); }}
              keyboardType="number-pad"
              secureTextEntry
              placeholder="Nouveau PIN à 4 chiffres"
              placeholderTextColor={colors.mutedForeground}
              accessibilityLabel="Nouveau PIN à 4 chiffres"
              style={[styles.recoveryInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
            />
            <TextInput
              value={confirmRecoveryPin}
              onChangeText={(value) => { setConfirmRecoveryPin(value.replace(/\D/g, '').slice(0, 4)); setRecoveryError(''); }}
              keyboardType="number-pad"
              secureTextEntry
              placeholder="Confirmer le nouveau PIN"
              placeholderTextColor={colors.mutedForeground}
              accessibilityLabel="Confirmation du nouveau PIN"
              style={[styles.recoveryInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
            />
            {recoveryError ? <Text style={[styles.recoveryError, { color: colors.errorForeground }]}>{recoveryError}</Text> : null}
            <Pressable
              onPress={() => { void finishRecovery(); }}
              style={({ pressed }) => [styles.recoverySubmit, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}
            >
              <Text style={[styles.recoverySubmitText, { color: colors.primaryForeground }]}>Définir le nouveau PIN</Text>
            </Pressable>
            <Pressable onPress={() => setRecoveryVisible(false)} style={styles.recoveryCancel}>
              <Text style={[styles.recoveryCancelText, { color: colors.mutedForeground }]}>Annuler</Text>
            </Pressable>
          </View>
        </View>
    </Modal>
    </>
  );
}
const styles = StyleSheet.create({
  biometricButton: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, marginTop: 10 },
  biometricText: { fontSize: 13, fontWeight: '700' },
  recoveryButton: { marginTop: 13, padding: 8 },
  recoveryLink: { fontSize: 13, fontWeight: '700' },
  recoveryBackdrop: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(10, 15, 25, 0.6)', padding: 20 },
  recoveryPanel: { width: '100%', maxWidth: 440, alignSelf: 'center', borderWidth: 1, borderRadius: 22, padding: 20, gap: 12 },
  recoveryIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  recoveryTitle: { fontSize: 20, fontWeight: '800' },
  recoveryDescription: { fontSize: 13, lineHeight: 19 },
  recoveryInput: { minHeight: 46, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, fontSize: 14 },
  recoveryError: { fontSize: 12, lineHeight: 18, fontWeight: '700' },
  recoverySubmit: { minHeight: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, marginTop: 3 },
  recoverySubmitText: { fontSize: 14, fontWeight: '800' },
  recoveryCancel: { alignItems: 'center', padding: 7 },
  recoveryCancelText: { fontSize: 13, fontWeight: '700' },
});
