import React from 'react';
import {
  View,
  Image,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { CapturedCard } from '../store/bulkUploadStore';
import { GradeBadge } from './GradeBadge';

interface Props {
  card: CapturedCard;
  onPress?: () => void;
  onRemove?: () => void;
}

export function CardThumbnail({ card, onPress, onRemove }: Props) {
  const isProcessing = card.status === 'uploading' || card.status === 'grading';

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.8}>
      <Image source={{ uri: card.localUri }} style={styles.image} resizeMode="cover" />

      {isProcessing && (
        <View style={styles.overlay}>
          <ActivityIndicator color="#fff" />
          <Text style={styles.overlayText}>
            {card.status === 'uploading' ? 'Uploading…' : 'Grading…'}
          </Text>
        </View>
      )}

      {card.status === 'error' && (
        <View style={[styles.overlay, styles.errorOverlay]}>
          <Text style={styles.overlayText}>Error</Text>
        </View>
      )}

      {card.status === 'ready' && card.grade && (
        <View style={styles.gradePill}>
          <GradeBadge grade={card.grade.grade} small />
        </View>
      )}

      {onRemove && (
        <TouchableOpacity style={styles.removeBtn} onPress={onRemove} hitSlop={8}>
          <Text style={styles.removeText}>✕</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 100,
    height: 140,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#1f2937',
    margin: 4,
  },
  image: { width: '100%', height: '100%' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  errorOverlay: { backgroundColor: 'rgba(220,38,38,0.6)' },
  overlayText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  gradePill: {
    position: 'absolute',
    bottom: 4,
    left: 4,
  },
  removeBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeText: { color: '#fff', fontSize: 12, lineHeight: 14 },
});
