import { apiClient } from './client';

export interface CreateListingPayload {
  card_id?: string;
  title: string;
  price: string;
  condition: string;
  description?: string;
  photo_ids?: number[];
}

export interface Listing {
  id: number;
  title: string;
  price: string;
  condition: string;
  description: string;
  photos: { id: number; url: string }[];
  seller: { username: string };
  created_at: string;
  card?: { name: string; set_name: string; image_url: string };
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
