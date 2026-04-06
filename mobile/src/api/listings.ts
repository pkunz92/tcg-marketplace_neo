import { apiClient } from './client';

export interface CreateListingPayload {
  card_master?: string;
  card_name: string;
  price_chf: string;
  condition: string;
  description?: string;
  photo_ids?: number[];
}

// Field names match CardListingSerializer in backend/api/serializers.py
export interface Listing {
  id: number;
  card_name: string;
  price_chf: string;
  condition: string;
  description: string;
  is_available: boolean;
  seller_username: string;
  seller_photo_url: string | null;
  card_image_url: string | null;
  set_name: string | null;
  created_at: string;
  is_graded: string;
  quantity: number;
}

export interface BulkListingItem {
  photo_id: number;
  title: string;
  price: string;
  condition: string;
  description?: string;
}

export const listingsApi = {
  list: (params?: { search?: string; condition?: string; page?: number }) =>
    apiClient.get<{ results: Listing[]; count: number }>('/listings/', { params }),

  detail: (id: number) => apiClient.get<Listing>(`/listings/${id}/`),

  create: (data: CreateListingPayload) =>
    apiClient.post<Listing>('/listings/', data),

  bulkCreate: (items: BulkListingItem[]) =>
    apiClient.post('/listings/bulk/', { listings: items }),

  myListings: () =>
    apiClient.get<{ results: Listing[] }>('/listings/', {
      params: { my_listings: true },
    }),
};
