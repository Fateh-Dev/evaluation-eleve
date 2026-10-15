import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import React, { createElement, useEffect, useState } from 'react';
import { PdfDocumentFrame } from '@/components/PdfDocumentFrame';
import type { DocumentMediaType } from '@/services/documentMedia';
import { getWebPdf, getWebPdfId, isWebPdfUri } from '@/services/webPdfStorage';

export function DocumentPreviewFrame({
  html,
  uri,
  mediaType,
}: {
  html?: string;
  uri?: string;
  mediaType: DocumentMediaType;
}) {
  const [source, setSource] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(uri && mediaType !== 'pdf' && isWebPdfUri(uri)));

  useEffect(() => {
    if (!uri || mediaType === 'pdf' || !isWebPdfUri(uri)) {
      setSource(uri);
      setLoading(false);
      setError(null);
      return;
    }
    let active = true;
    let objectUrl: string | undefined;
    setLoading(true);
    setError(null);
    void getWebPdf(getWebPdfId(uri))
      .then((file) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(file);
        setSource(objectUrl);
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Le document n’a pas pu être chargé.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [mediaType, uri]);

  if (mediaType === 'pdf') return <PdfDocumentFrame html={html} uri={uri} />;
  if (loading) {
    return (
      <View style={styles.message}>
        <ActivityIndicator />
        <Text style={styles.messageText}>Chargement du document…</Text>
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.message}>
        <Text style={styles.errorText}>Impossible d’afficher ce document : {error}</Text>
      </View>
    );
  }
  if (!source) return <View style={styles.frame} />;

  return (
    <View style={styles.frame}>
      {mediaType === 'image'
        ? createElement('img', {
            src: source,
            alt: 'Aperçu de l’image',
            style: { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' },
          })
        : createElement('video', {
            src: source,
            controls: true,
            playsInline: true,
            style: { maxWidth: '100%', maxHeight: '100%' },
          })}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' },
  message: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  messageText: { color: '#687782', fontSize: 13 },
  errorText: { color: '#991b1b', textAlign: 'center', lineHeight: 22 },
});
