import React from 'react';
import { WebView } from 'react-native-webview';
import { StyleSheet } from 'react-native';

export function PdfDocumentFrame({
  html,
  uri,
}: {
  html?: string;
  uri?: string;
}) {
  return (
    <WebView
      originWhitelist={['*']}
      source={uri ? { uri } : { html: html ?? '' }}
      style={styles.frame}
      javaScriptEnabled={false}
      domStorageEnabled={false}
      allowFileAccess
      allowingReadAccessToURL={uri}
    />
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, backgroundColor: '#ffffff' },
});
