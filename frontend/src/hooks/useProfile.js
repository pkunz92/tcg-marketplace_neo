import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'

export function useProfile() {
  return useQuery({
    queryKey: ['user', 'profile'],
    queryFn: () => api.get('/user/profile/').then((r) => r.data),
  })
}

export function useUpdateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => api.patch('/user/profile/', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user', 'profile'] }),
  })
}
