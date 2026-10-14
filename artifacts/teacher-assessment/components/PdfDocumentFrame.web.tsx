import { Feather } from '@expo/vector-icons';
import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy, type RenderTask } from 'pdfjs-dist';
import React, { createElement, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { getWebPdf, getWebPdfId, isWebPdfUri } from '@/services/webPdfStorage';

let pdfWorker: Worker | null = null;

function getPdfWorker(): Worker {
  if (!pdfWorker) {
    pdfWorker = new Worker(new URL('./pdf.worker.ts', import.meta.url), { type: 'module' });
  }
  return pdfWorker;
}

export function PdfDocumentFrame({
  html,
  uri,
}: {
  html?: string;
  uri?: string;
}) {
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [containerWidth, setContainerWidth] = useState(0);
  const [loading, setLoading] = useState(Boolean(uri && isWebPdfUri(uri)));
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!uri || !isWebPdfUri(uri)) {
      setLoading(false);
      return;
    }

    let active = true;
    let loadingTask: ReturnType<typeof getDocument> | null = null;
    setLoading(true);
    setError(null);
    setDocument(null);
    setPageNumber(1);

    void getWebPdf(getWebPdfId(uri))
      .then(async (file) => {
        if (!active) return;
        const data = new Uint8Array(await file.arrayBuffer());
        if (!active) return;
        GlobalWorkerOptions.workerPort = getPdfWorker();
        loadingTask = getDocument({ data });
        return loadingTask.promise;
      })
      .then((pdf) => {
        if (active && pdf) setDocument(pdf);
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : 'Le PDF n’a pas pu être chargé.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      void loadingTask?.destroy();
    };
  }, [uri]);

  useEffect(() => {
    if (!isWebPdfUri(uri ?? '')) return;
    const container = containerRef.current;
    if (!container) return;

    const updateWidth = () => setContainerWidth(container.clientWidth);
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(container);
    return () => observer.disconnect();
  }, [uri, document]);

  useEffect(() => {
    if (!document || !containerWidth || !canvasRef.current) return;

    let active = true;
    let renderTask: RenderTask | null = null;
    void document.getPage(pageNumber)
      .then((page) => {
        if (!active || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Le navigateur ne peut pas afficher cette page PDF.');

        const baseViewport = page.getViewport({ scale: 1 });
        const scale = Math.min((containerWidth - 24) / baseViewport.width, 2);
        const viewport = page.getViewport({ scale: Math.max(scale, 0.1) });
        const outputScale = window.devicePixelRatio || 1;
        canvas.width = Math.ceil(viewport.width * outputScale);
        canvas.height = Math.ceil(viewport.height * outputScale);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        renderTask = page.render({
          canvas,
          canvasContext: context,
          viewport,
          transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0],
        });
        return renderTask.promise;
      })
      .catch((renderError: unknown) => {
        if (active) {
          setError(renderError instanceof Error ? renderError.message : 'Cette page PDF n’a pas pu être affichée.');
        }
      });

    return () => {
      active = false;
      renderTask?.cancel();
    };
  }, [document, pageNumber, containerWidth]);

  if (uri && isWebPdfUri(uri)) {
    return (
      <View style={styles.frame}>
        {loading ? (
          <View style={styles.message}>
            <ActivityIndicator />
            <Text style={styles.statusText}>Chargement du PDF…</Text>
          </View>
        ) : error ? (
          <View style={styles.message}>
            <Text style={styles.errorText}>Impossible d’afficher ce PDF : {error}</Text>
          </View>
        ) : document ? (
          <>
            <View style={styles.toolbar}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Page précédente"
                disabled={pageNumber <= 1}
                onPress={() => setPageNumber((current) => Math.max(1, current - 1))}
                style={[styles.pageButton, pageNumber <= 1 && styles.disabledButton]}
              >
                <Feather name="chevron-left" size={18} color="#34454f" />
              </Pressable>
              <Text style={styles.pageLabel}>
                Page {pageNumber} sur {document.numPages}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Page suivante"
                disabled={pageNumber >= document.numPages}
                onPress={() => setPageNumber((current) => Math.min(document.numPages, current + 1))}
                style={[styles.pageButton, pageNumber >= document.numPages && styles.disabledButton]}
              >
                <Feather name="chevron-right" size={18} color="#34454f" />
              </Pressable>
            </View>
            <View style={styles.pageViewport}>
              {createElement('div', {
                ref: containerRef,
                style: {
                  height: '100%',
                  overflowY: 'auto',
                  padding: 12,
                  backgroundColor: '#e8edf0',
                  boxSizing: 'border-box',
                },
              }, createElement('canvas', {
                ref: canvasRef,
                'aria-label': `Page ${pageNumber} du document PDF`,
                style: {
                  display: 'block',
                  margin: '0 auto',
                  maxWidth: '100%',
                  backgroundColor: '#ffffff',
                  boxShadow: '0 2px 8px rgba(20, 35, 45, 0.18)',
                },
              }))}
            </View>
          </>
        ) : null}
      </View>
    );
  }

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
  message: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  statusText: { color: '#687782', fontSize: 13 },
  errorText: { color: '#991b1b', textAlign: 'center', lineHeight: 22 },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingVertical: 8,
    backgroundColor: '#f5f7f8',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#d6dee2',
  },
  pageButton: { width: 34, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' },
  disabledButton: { opacity: 0.4 },
  pageLabel: { minWidth: 92, textAlign: 'center', fontSize: 12, fontWeight: '600', color: '#34454f' },
  pageViewport: { flex: 1, minHeight: 0 },
});
