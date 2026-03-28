import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'

export function useDbStats() {
  return useQuery({
    queryKey: ['stats', 'db'],
    queryFn: () => api.get('/stats/').then((r) => r.data),
    staleTime: 1000 * 60 * 60,
  })
}
