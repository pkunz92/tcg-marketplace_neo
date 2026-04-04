import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Vibration,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useCardUpload } from '../src/hooks/useCardUpload';
import { useBulkUploadStore } from '../src/store/bulkUploadStore';
import { CardThumbnail } from '../src/components/CardThumbnail';

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const { uploadAndGrade } = useCardUpload();
  const { cards } = useBulkUploadStore();

  const captureCard = useCallback(async () => {
    if (isCapturing || !cameraRef.current) return;
    setIsCapturing(true);
    Vibration.vibrate(50); // haptic feedback

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.92,
        skipProcessing: false,
      });
      if (photo?.uri) {
        uploadAndGrade(photo.uri);
      }
    } catch {
      Alert.alert('Error', 'Failed to capture photo. Try again.');
    } finally {
      setIsCapturing(false);
    }
  }, [isCapturing, uploadAndGrade]);

  const handleDone = () => {
    router.back();
  };

  if (!permission) {
    return <View style={styles.root} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionTitle}>Camera Access Required</Text>
        <Text style={styles.permissionBody}>
          TCG Marketplace needs camera access to photograph your cards for grading.
        </Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const capturedCount = cards.length;

  return (
    <View style={styles.root}>
      {/* Camera viewfinder */}
      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="back"
          ratio="4:3"
        >
          {/* Card outline guide */}
          <View style={styles.cardGuide}>
            <View style={styles.cornerTL} />
            <View style={styles.cornerTR} />
            <View style={styles.cornerBL} />
            <View style={styles.cornerBR} />
          </View>
          <Text style={styles.guideText}>Center the card within the frame</Text>
        </CameraView>
      </View>

      {/* Capture button */}
      <View style={styles.captureRow}>
        <Text style={styles.countBadge}>
          {capturedCount} captured
        </Text>
        <TouchableOpacity
          style={[styles.captureBtn, isCapturing && styles.captureBtnActive]}
          onPress={captureCard}
          activeOpacity={0.7}
        >
          <View style={styles.captureInner} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.doneBtn} onPress={handleDone}>
          <Text style={styles.doneBtnText}>Done</Text>
        </TouchableOpacity>
      </View>

      {/* Recent captures strip */}
      {cards.length > 0 && (
        <ScrollView
          horizontal
          style={styles.strip}
          contentContainerStyle={styles.stripContent}
          showsHorizontalScrollIndicator={false}
        >
          {[...cards].reverse().map((card) => (
            <CardThumbnail key={card.id} card={card} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const CORNER_SIZE = 22;
const CORNER_THICKNESS = 3;
const CORNER_COLOR = '#4f46e5';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  cameraContainer: { flex: 1 },
  camera: { flex: 1 },
  cardGuide: {
    position: 'absolute',
    top: '15%',
    left: '8%',
    right: '8%',
    bottom: '15%',
  },
  cornerTL: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderTopWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderColor: CORNER_COLOR,
    borderRadius: 2,
  },
  cornerTR: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderTopWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderColor: CORNER_COLOR,
    borderRadius: 2,
  },
  cornerBL: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderBottomWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderColor: CORNER_COLOR,
    borderRadius: 2,
  },
  cornerBR: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderBottomWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderColor: CORNER_COLOR,
    borderRadius: 2,
  },
  guideText: {
    position: 'absolute',
    bottom: -28,
    left: 0,
    right: 0,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  captureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    paddingVertical: 20,
    backgroundColor: '#000',
  },
  countBadge: {
    color: '#9ca3af',
    fontSize: 13,
    width: 80,
  },
  captureBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureBtnActive: { borderColor: '#4f46e5' },
  captureInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
  },
  doneBtn: {
    width: 80,
    alignItems: 'flex-end',
  },
  doneBtnText: {
    color: '#4f46e5',
    fontWeight: '700',
    fontSize: 16,
  },
  strip: {
    height: 120,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  stripContent: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 8,
    flexDirection: 'row',
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: '#0f0f1a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 16,
  },
  permissionTitle: { color: '#f9fafb', fontWeight: '700', fontSize: 22, textAlign: 'center' },
  permissionBody: { color: '#9ca3af', textAlign: 'center', fontSize: 15, lineHeight: 22 },
  permBtn: {
    backgroundColor: '#4f46e5',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  permBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
