import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'

export function useSets(params = {}) {
  return useQuery({
    queryKey: ['sets', 'list', params],
    queryFn: () => api.get('/sets/', { params }).then((r) => r.data),
  })
}

export function useSeries() {
  return useQuery({
    queryKey: ['series', 'list'],
    queryFn: () => api.get('/series/').then((r) => r.data),
    staleTime: 1000 * 60 * 60,
  })
}

export function useRarities(params = {}) {
  return useQuery({
    queryKey: ['rarities', params],
    queryFn: () => api.get('/rarities/', { params }).then((r) => r.data),
    staleTime: 1000 * 60 * 10,
  })
}
