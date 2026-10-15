import React from 'react';
import { Platform, StyleSheet, useColorScheme, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';

export default function TabLayout() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const isIOS = Platform.OS === 'ios';
  const isWeb = Platform.OS === 'web';

  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: false,
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginTop: 1,
        },
        tabBarItemStyle: {
          borderRadius: 14,
          marginHorizontal: 4,
          marginVertical: 6,
          overflow: 'hidden',
        },
        tabBarStyle: {
          backgroundColor: isIOS ? 'transparent' : colors.background,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          elevation: 0,
          height: isWeb ? 72 : 68,
          paddingTop: 3,
          paddingBottom: isWeb ? 5 : 3,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={100}
              tint={isDark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: colors.background },
              ]}
            />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="classes"
        options={{
          title: 'Classes',
          tabBarIcon: ({ color }) => <Feather name="users" size={21} color={color} />,
          tabBarActiveBackgroundColor: colors.accent,
        }}
      />
      <Tabs.Screen
        name="entry"
        options={{
          title: 'Saisie',
          tabBarActiveTintColor: colors.primaryForeground,
          tabBarActiveBackgroundColor: colors.primary,
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '700',
            marginTop: 1,
          },
          tabBarIcon: ({ color }) => <Feather name="edit-3" size={21} color={color} />,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: 'Accueil',
          tabBarIcon: ({ color }) =>
            <Feather name="home" size={21} color={color} />,
          tabBarActiveBackgroundColor: colors.accent,
        }}
      />
      <Tabs.Screen
        name="storage"
        options={{
          title: 'Documents',
          tabBarIcon: ({ color }) => <Feather name="file-text" size={21} color={color} />,
          tabBarActiveBackgroundColor: colors.accent,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'Plus',
          tabBarIcon: ({ color }) => <Feather name="more-horizontal" size={21} color={color} />,
          tabBarActiveBackgroundColor: colors.accent,
        }}
      />
      <Tabs.Screen
        name="continuous"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="assessments"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="pupils"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="reports"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="settings"
        options={{ href: null }}
      />
    </Tabs>
  );
}
