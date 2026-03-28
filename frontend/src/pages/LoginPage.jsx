import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import toast from 'react-hot-toast'
import { Zap } from 'lucide-react'

const schema = z.object({
  username: z.string().min(1, 'Required'),
  password: z.string().min(1, 'Required'),
})

export default function LoginPage() {
  const { login, loginPending } = useAuth()
  const navigate = useNavigate()
  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(schema) })

  async function onSubmit(data) {
    try {
      await login(data)
      navigate('/dashboard')
      toast.success('Welcome back!')
    } catch (err) {
      toast.error(err.response?.data?.non_field_errors?.[0] || 'Invalid credentials')
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <Zap size={28} className="text-accent-400" />
            <span className="font-display text-2xl font-bold text-accent-400">PokeMarket</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Welcome back</h1>
          <p className="text-slate-400 text-sm mt-1">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="bg-surface border border-border rounded-2xl p-6 space-y-4">
          <Input
            label="Username"
            placeholder="your_username"
            error={errors.username?.message}
            {...register('username')}
          />
          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            error={errors.password?.message}
            {...register('password')}
          />
          <Button type="submit" className="w-full" loading={loginPending}>
            Sign In
          </Button>
        </form>

        <p className="text-center text-sm text-slate-400 mt-4">
          No account?{' '}
          <Link to="/register" className="text-accent-500 hover:text-accent-400">Create one</Link>
        </p>
      </div>
    </div>
  )
}
