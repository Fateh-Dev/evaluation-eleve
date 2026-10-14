import React, { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';

type PdfComponent = typeof import('react-native-pdf').default;

export function PdfDocumentFrame({
  html,
  uri,
}: {
  html?: string;
  uri?: string;
}) {
  const [error, setError] = useState<string | null>(null);

  if (!uri) {
    return (
      <WebView
        originWhitelist={['*']}
        source={{ html: html ?? '' }}
        style={styles.frame}
        javaScriptEnabled={false}
        domStorageEnabled={false}
      />
    );
  }

  let Pdf: PdfComponent;
  try {
    Pdf = require('react-native-pdf').default;
  } catch {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>
          Le lecteur PDF natif n’est pas chargé. Installez une version de
          l’application compilée avec le lecteur PDF, puis réessayez.
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Impossible d’afficher ce PDF : {error}</Text>
      </View>
    );
  }

  return (
    <Pdf
      source={{ uri, cache: false }}
      style={styles.frame}
      fitPolicy={0}
      onError={(loadError) => setError(loadError.message)}
      renderActivityIndicator={() => (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, backgroundColor: '#ffffff' },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#ffffff',
  },
  errorText: { color: '#991b1b', textAlign: 'center', lineHeight: 22 },
});
