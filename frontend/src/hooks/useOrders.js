import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'

export function useMyOrders() {
  return useQuery({
    queryKey: ['orders', 'my'],
    queryFn: () => api.get('/orders/').then((r) => r.data),
  })
}

export function useCreateOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => api.post('/orders/', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['listings'] })
    },
  })
}
