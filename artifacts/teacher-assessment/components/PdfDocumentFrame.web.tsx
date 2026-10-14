import React, { createElement } from 'react';
import { StyleSheet, View } from 'react-native';

export function PdfDocumentFrame({
  html,
  uri,
}: {
  html?: string;
  uri?: string;
}) {
  return (
    <View style={styles.frame}>
      {createElement('iframe', {
        src: uri,
        srcDoc: uri ? undefined : html ?? '',
        title: 'Aperçu du document PDF',
        style: {
          width: '100%',
          height: '100%',
          border: 'none',
          backgroundColor: '#ffffff',
        },
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, backgroundColor: '#ffffff' },
});
