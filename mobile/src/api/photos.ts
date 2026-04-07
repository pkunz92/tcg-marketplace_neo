import { apiClient } from './client';

export interface PresignResponse {
  upload_url: string;
  photo_url: string;
  photo_id: number;
}

export interface GradeResult {
  grade: string | null;
  confidence: number;
  detectedSet: string | null;
  detectedName: string | null;
  detectedRarity: string | null;
  message?: string | null;
}

export const photoApi = {
  /**
   * Get a pre-signed S3 URL for direct browser/mobile upload.
   */
  presign: (filename: string, contentType: string) =>
    apiClient.post<PresignResponse>('/photos/presign', {
      filename,
      content_type: contentType,
    }),

  /**
   * Upload the image bytes directly to the pre-signed S3 URL.
   */
  uploadToS3: async (uploadUrl: string, uri: string, contentType: string) => {
    const response = await fetch(uri);
    const blob = await response.blob();
    return fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: blob,
    });
  },

  /**
   * Trigger AI grading for a photo that's already stored.
   */
  analyzePhoto: (photoUrl: string) =>
    apiClient.post<GradeResult>('/listings/analyze-photo/', { photo_url: photoUrl }),

  deletePhoto: (photoId: number) => apiClient.delete(`/photos/${photoId}/`),
};
