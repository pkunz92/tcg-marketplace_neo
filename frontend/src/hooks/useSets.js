import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'

export function useSets(params = {}) {
  return useQuery({
    queryKey: ['sets', 'list', params],
    queryFn: () => api.get('/sets/', { params }).then((r) => r.data),
  })
}
