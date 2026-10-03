import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import React, { PropsWithChildren, createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { Button } from '@/components/AppShell';

const PIN_KEY = '@teacher-assessment/app-pin-v1';
type SecurityContextValue = {
  ready: boolean;
  hasPin: boolean;
  locked: boolean;
  setPin: (pin: string) => Promise<void>;
  removePin: () => Promise<void>;
  unlock: (pin: string) => Promise<boolean>;
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

  useEffect(() => {
    SecureStore.getItemAsync(PIN_KEY).then((stored) => {
      const configured = Boolean(stored);
      setHasPin(configured);
      setLocked(configured);
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
    setPin: async (pin) => {
      await SecureStore.setItemAsync(PIN_KEY, await hashPin(pin));
      setHasPin(true);
      setLocked(false);
    },
    removePin: async () => {
      await SecureStore.deleteItemAsync(PIN_KEY);
      setHasPin(false);
      setLocked(false);
    },
    unlock: async (pin) => {
      const saved = await SecureStore.getItemAsync(PIN_KEY);
      const valid = Boolean(saved && saved === await hashPin(pin));
      if (valid) setLocked(false);
      return valid;
    },
    lock: () => { if (hasPin) setLocked(true); },
  }), [ready, hasPin, locked]);

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
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Entrez votre code PIN pour accéder à vos données.</Text>
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
