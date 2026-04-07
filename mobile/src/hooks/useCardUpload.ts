import { useCallback } from 'react';
import * as ImageManipulator from 'expo-image-manipulator';
import { photoApi } from '../api/photos';
import { useBulkUploadStore } from '../store/bulkUploadStore';

/**
 * Returns a function that, given a local image URI (from camera or picker),
 * compresses it, gets a pre-signed URL, uploads to S3, and triggers AI grading.
 * All state updates go into the bulkUploadStore.
 */
export function useCardUpload() {
  const { addCard, updateCard } = useBulkUploadStore();

  const uploadAndGrade = useCallback(
    async (localUri: string) => {
      const cardId = addCard(localUri);
      updateCard(cardId, { status: 'uploading' });

      try {
        // 1. Compress to JPEG ≤ 1200px wide
        const compressed = await ImageManipulator.manipulateAsync(
          localUri,
          [{ resize: { width: 1200 } }],
          { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
        );

        // 2. Get pre-signed upload URL
        const filename = `card-${Date.now()}.jpg`;
        const { data: presign } = await photoApi.presign(filename, 'image/jpeg');

        // 3. Upload compressed image to S3
        await photoApi.uploadToS3(presign.upload_url, compressed.uri, 'image/jpeg');

        updateCard(cardId, {
          photoId: presign.photo_id,
          photoUrl: presign.photo_url,
          status: 'grading',
        });

        // 4. Call AI grading service via backend
        const { data: grade } = await photoApi.analyzePhoto(presign.photo_url);

        updateCard(cardId, {
          grade,
          // Pre-fill condition from grade if confident
          condition: grade.grade && grade.confidence > 0.6 ? grade.grade : undefined,
          // Pre-fill title from card recognition
          title: grade.detectedName
            ? `${grade.detectedName}${grade.detectedSet ? ` [${grade.detectedSet}]` : ''}`
            : undefined,
          status: 'ready',
        });
      } catch (err) {
        updateCard(cardId, {
          status: 'error',
          error: err instanceof Error ? err.message : 'Upload failed',
        });
      }

      return cardId;
    },
    [addCard, updateCard],
  );

  return { uploadAndGrade };
}
