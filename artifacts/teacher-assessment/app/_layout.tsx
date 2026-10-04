import React, { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AppDialogHost } from '@/components/AppDialog';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { AppDataProvider } from '@/context/AppDataContext';
import { ReminderProvider } from '@/context/ReminderContext';
import { AppLockGate, SecurityProvider } from '@/context/SecurityContext';
import { StorageProvider } from '@/context/StorageContext';
import { ThemeProvider } from '@/context/ThemeContext';

// Prevent the splash screen from auto-hiding before asset loading is complete.
void SplashScreen.preventAutoHideAsync().catch(() => undefined);

function RootLayoutNav() {
  return (
    <>
      <Stack screenOptions={{ headerShown: false, headerBackTitle: 'Back' }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      <AppDialogHost />
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const [startupTimedOut, setStartupTimedOut] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setStartupTimedOut(true);
      SplashScreen.hideAsync().catch(() => undefined);
    }, 3000);

    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => undefined);
    }

    return () => clearTimeout(timeout);
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError && !startupTimedOut) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <ThemeProvider>
          <SecurityProvider>
            <AppLockGate>
              <AppDataProvider>
                <ReminderProvider>
                  <StorageProvider>
                    <GestureHandlerRootView style={{ flex: 1 }}>
                      <KeyboardProvider>
                        <RootLayoutNav />
                      </KeyboardProvider>
                    </GestureHandlerRootView>
                  </StorageProvider>
                </ReminderProvider>
              </AppDataProvider>
            </AppLockGate>
          </SecurityProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
