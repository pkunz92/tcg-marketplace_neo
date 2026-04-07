import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useBulkUploadStore } from '../../src/store/bulkUploadStore';
import { useCardUpload } from '../../src/hooks/useCardUpload';
import { CardThumbnail } from '../../src/components/CardThumbnail';

export default function SellScreen() {
  const { cards, removeCard, clearAll } = useBulkUploadStore();
  const { uploadAndGrade } = useCardUpload();

  const openCamera = () => {
    router.push('/camera');
  };

  const pickFromLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 1,
    });
    if (!result.canceled) {
      for (const asset of result.assets) {
        uploadAndGrade(asset.uri);
      }
    }
  };

  const handleReview = () => {
    const ready = cards.filter((c) => c.status === 'ready' || c.status === 'error');
    if (ready.length === 0) {
      Alert.alert('Not ready', 'Please wait for photos to finish processing.');
      return;
    }
    router.push('/bulk-review');
  };

  const pendingCount = cards.filter(
    (c) => c.status === 'uploading' || c.status === 'grading',
  ).length;
  const readyCount = cards.filter((c) => c.status === 'ready').length;

  return (
    <View style={styles.root}>
      {/* Action buttons */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.cameraBtn} onPress={openCamera}>
          <Text style={styles.cameraBtnIcon}>📷</Text>
          <Text style={styles.cameraBtnText}>Scan Cards</Text>
          <Text style={styles.cameraBtnSub}>Camera bulk capture</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.libraryBtn} onPress={pickFromLibrary}>
          <Text style={styles.libraryBtnText}>📁  Import from Library</Text>
        </TouchableOpacity>
      </View>

      {/* Progress summary */}
      {cards.length > 0 && (
        <View style={styles.summary}>
          <Text style={styles.summaryText}>
            {cards.length} card{cards.length !== 1 ? 's' : ''} captured
            {pendingCount > 0 ? ` · ${pendingCount} processing` : ''}
            {readyCount > 0 ? ` · ${readyCount} ready` : ''}
          </Text>
          <TouchableOpacity onPress={clearAll}>
            <Text style={styles.clearText}>Clear all</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Card thumbnails */}
      <ScrollView contentContainerStyle={styles.grid}>
        {cards.map((card) => (
          <CardThumbnail
            key={card.id}
            card={card}
            onPress={() => {/* tap to edit in review */}}
            onRemove={() => removeCard(card.id)}
          />
        ))}
      </ScrollView>

      {/* Review CTA */}
      {cards.length > 0 && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.reviewBtn, pendingCount > 0 && styles.reviewBtnDisabled]}
            onPress={handleReview}
          >
            <Text style={styles.reviewBtnText}>
              {pendingCount > 0
                ? `Processing ${pendingCount}…`
                : `Review & List ${readyCount} Card${readyCount !== 1 ? 's' : ''}`}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {cards.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🃏</Text>
          <Text style={styles.emptyTitle}>Ready to sell?</Text>
          <Text style={styles.emptyBody}>
            Tap "Scan Cards" to photograph your cards. AI will grade them automatically.
          </Text>
          <Text style={styles.tipText}>
            💡 Tip: You can photograph 20+ cards in under 5 minutes with the bulk camera mode.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f0f1a' },
  actions: { padding: 16, gap: 10 },
  cameraBtn: {
    backgroundColor: '#4f46e5',
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    gap: 4,
  },
  cameraBtnIcon: { fontSize: 36 },
  cameraBtnText: { color: '#fff', fontWeight: '800', fontSize: 20 },
  cameraBtnSub: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  libraryBtn: {
    backgroundColor: '#1f2937',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#374151',
  },
  libraryBtnText: { color: '#d1d5db', fontWeight: '600', fontSize: 15 },
  summary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  summaryText: { color: '#9ca3af', fontSize: 13 },
  clearText: { color: '#ef4444', fontSize: 13 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingBottom: 100,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: 'rgba(15,15,26,0.95)',
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  reviewBtn: {
    backgroundColor: '#10b981',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  reviewBtnDisabled: { backgroundColor: '#374151' },
  reviewBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 12,
  },
  emptyIcon: { fontSize: 64 },
  emptyTitle: { color: '#f9fafb', fontWeight: '700', fontSize: 22 },
  emptyBody: { color: '#9ca3af', textAlign: 'center', fontSize: 15, lineHeight: 22 },
  tipText: {
    color: '#6b7280',
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
  },
});
