import { useQuery, useInfiniteQuery } from '@tanstack/react-query'
import api from '../lib/api'

export function useCardsList(params = {}) {
  return useQuery({
    queryKey: ['cards', 'list', params],
    queryFn: () =>
      api.get('/cards/list/', { params }).then((r) => r.data),
  })
}

export function useCardsInfinite(params = {}) {
  return useInfiniteQuery({
    queryKey: ['cards', 'infinite', params],
    queryFn: ({ pageParam = 1 }) =>
      api.get('/cards/list/', { params: { ...params, page: pageParam } }).then((r) => r.data),
    getNextPageParam: (last, pages) =>
      last.next ? pages.length + 1 : undefined,
    initialPageParam: 1,
  })
}

export function useCardDetail(apiId) {
  return useQuery({
    queryKey: ['cards', 'detail', apiId],
    queryFn: () => api.get(`/cards/${apiId}/`).then((r) => r.data),
    enabled: !!apiId,
  })
}

export function useCardStats(apiId) {
  return useQuery({
    queryKey: ['cards', 'stats', apiId],
    queryFn: () => api.get(`/cards/${apiId}/stats/`).then((r) => r.data),
    enabled: !!apiId,
  })
}
