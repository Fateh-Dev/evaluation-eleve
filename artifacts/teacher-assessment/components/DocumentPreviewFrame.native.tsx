import { Image } from 'expo-image';
import { VideoView, useVideoPlayer } from 'expo-video';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { PdfDocumentFrame } from '@/components/PdfDocumentFrame';
import type { DocumentMediaType } from '@/services/documentMedia';

function VideoPreview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri);
  return (
    <VideoView
      player={player}
      style={styles.media}
      nativeControls
      contentFit="contain"
    />
  );
}

export function DocumentPreviewFrame({
  html,
  uri,
  mediaType,
}: {
  html?: string;
  uri?: string;
  mediaType: DocumentMediaType;
}) {
  if (mediaType === 'pdf') return <PdfDocumentFrame html={html} uri={uri} />;
  if (!uri) return <View style={styles.frame} />;
  if (mediaType === 'image') {
    return (
      <View style={styles.frame}>
        <Image source={{ uri }} style={styles.media} contentFit="contain" />
      </View>
    );
  }
  return (
    <View style={styles.frame}>
      <VideoPreview uri={uri} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, backgroundColor: '#ffffff' },
  media: { flex: 1, width: '100%', height: '100%' },
});
