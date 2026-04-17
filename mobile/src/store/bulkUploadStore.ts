import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GradeResult } from '../api/photos';

export type UploadStatus = 'pending' | 'uploading' | 'grading' | 'ready' | 'error';

export interface CapturedCard {
  id: string; // local uuid
  localUri: string;
  photoId?: number;
  photoUrl?: string;
  grade?: GradeResult;
  status: UploadStatus;
  error?: string;
  // listing fields (filled in review step)
  title?: string;
  price?: string;
  condition?: string;
  description?: string;
}

interface BulkUploadState {
  cards: CapturedCard[];
  addCard: (localUri: string) => string;
  updateCard: (id: string, patch: Partial<CapturedCard>) => void;
  removeCard: (id: string) => void;
  clearAll: () => void;
}

let _idCounter = 0;

export const useBulkUploadStore = create<BulkUploadState>()(
  persist(
    (set) => ({
      cards: [],

      addCard: (localUri) => {
        const id = `card-${Date.now()}-${_idCounter++}`;
        set((s) => ({
          cards: [...s.cards, { id, localUri, status: 'pending' }],
        }));
        return id;
      },

      updateCard: (id, patch) =>
        set((s) => ({
          cards: s.cards.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        })),

      removeCard: (id) =>
        set((s) => ({ cards: s.cards.filter((c) => c.id !== id) })),

      clearAll: () => set({ cards: [] }),
    }),
    {
      name: 'bulk-upload-queue',
      storage: createJSONStorage(() => AsyncStorage),
      // Don't persist localUri — it's ephemeral on device
      partialize: (state) => ({
        cards: state.cards.map(c => ({ ...c, localUri: '' })),
      }),
    }
  )
);
