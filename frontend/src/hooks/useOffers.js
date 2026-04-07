import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'

export function useMyOffers() {
  return useQuery({
    queryKey: ['offers', 'my'],
    queryFn: () => api.get('/offers/').then((r) => r.data),
  })
}

export function useListingOffers(listingId) {
  return useQuery({
    queryKey: ['offers', 'listing', listingId],
    queryFn: () => api.get('/offers/', { params: { listing: listingId } }).then((r) => r.data),
    enabled: !!listingId,
  })
}

export function useCreateOffer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => api.post('/offers/', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['offers'] })
    },
  })
}

export function useAcceptOffer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => api.post(`/offers/${id}/accept/`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['offers'] })
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['listings'] })
    },
  })
}

export function useDeclineOffer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => api.post(`/offers/${id}/decline/`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['offers'] })
    },
  })
}

export function useCounterOffer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, counter_price_chf }) =>
      api.post(`/offers/${id}/counter/`, { counter_price_chf }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['offers'] })
    },
  })
}
