import { createContext, useContext } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const qc = useQueryClient()

  const { data: user, isLoading } = useQuery({
    queryKey: ['auth', 'user'],
    queryFn: () => api.get('/auth/user/').then((r) => r.data),
    retry: false,
    staleTime: 1000 * 60 * 10,
  })

  const loginMutation = useMutation({
    mutationFn: (creds) => api.post('/auth/login/', creds).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['auth'] }),
  })

  const logoutMutation = useMutation({
    mutationFn: () => api.post('/auth/logout/'),
    onSuccess: () => qc.clear(),
  })

  const registerMutation = useMutation({
    mutationFn: (data) => api.post('/auth/registration/', data).then((r) => r.data),
  })

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login: loginMutation.mutateAsync,
        logout: logoutMutation.mutateAsync,
        register: registerMutation.mutateAsync,
        loginPending: loginMutation.isPending,
        registerPending: registerMutation.isPending,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
