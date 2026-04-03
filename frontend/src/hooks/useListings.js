import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'

export function useListings(params = {}) {
  return useQuery({
    queryKey: ['listings', 'list', params],
    queryFn: () => api.get('/listings/', { params }).then((r) => r.data),
  })
}

export function useListingsInfinite(params = {}) {
  return useInfiniteQuery({
    queryKey: ['listings', 'infinite', params],
    queryFn: ({ pageParam = 1 }) =>
      api.get('/listings/', { params: { ...params, page: pageParam } }).then((r) => r.data),
    getNextPageParam: (last, pages) =>
      last.next ? pages.length + 1 : undefined,
    initialPageParam: 1,
  })
}

export function useMyListings() {
  return useQuery({
    queryKey: ['listings', 'my'],
    queryFn: () => api.get('/listings/', { params: { my_listings: true } }).then((r) => r.data),
  })
}

export function useCreateListing() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => {
      const isFormData = data instanceof FormData
      return api.post('/listings/', data, isFormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {}).then((r) => r.data)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['listings'] })
    },
  })
}

export function useDeleteListing() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => api.delete(`/listings/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['listings'] }),
  })
}
