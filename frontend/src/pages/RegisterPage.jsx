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
  username: z.string().min(3, 'At least 3 characters'),
  email: z.string().email('Valid email required'),
  password1: z.string().min(8, 'At least 8 characters'),
  password2: z.string(),
  shipping_name: z.string().min(1, 'Required'),
  shipping_address_line1: z.string().min(1, 'Required'),
  shipping_city: z.string().min(1, 'Required'),
  shipping_postal_code: z.string().min(1, 'Required'),
  shipping_country: z.string().min(2, 'Required'),
}).refine((d) => d.password1 === d.password2, {
  message: "Passwords don't match",
  path: ['password2'],
})

export default function RegisterPage() {
  const { register: registerFn, registerPending } = useAuth()
  const navigate = useNavigate()
  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(schema) })

  async function onSubmit(data) {
    try {
      await registerFn(data)
      navigate('/verify-email')
      toast.success('Account created! Check your email.')
    } catch (err) {
      const errs = err.response?.data
      const msg = errs
        ? Object.values(errs).flat()[0]
        : 'Registration failed'
      toast.error(msg)
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <Zap size={28} className="text-accent-400" />
            <span className="font-display text-2xl font-bold text-accent-400">PokeMarket</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Create account</h1>
          <p className="text-slate-400 text-sm mt-1">Start buying and selling Pokemon cards</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="bg-surface border border-border rounded-2xl p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Username" error={errors.username?.message} {...register('username')} />
            <Input label="Email" type="email" error={errors.email?.message} {...register('email')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Password" type="password" error={errors.password1?.message} {...register('password1')} />
            <Input label="Confirm Password" type="password" error={errors.password2?.message} {...register('password2')} />
          </div>

          <div className="border-t border-border pt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Shipping Address</p>
            <div className="space-y-3">
              <Input label="Full Name" error={errors.shipping_name?.message} {...register('shipping_name')} />
              <Input label="Address" error={errors.shipping_address_line1?.message} {...register('shipping_address_line1')} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="City" error={errors.shipping_city?.message} {...register('shipping_city')} />
                <Input label="Postal Code" error={errors.shipping_postal_code?.message} {...register('shipping_postal_code')} />
              </div>
              <Input label="Country (e.g. CH)" error={errors.shipping_country?.message} {...register('shipping_country')} />
            </div>
          </div>

          <Button type="submit" className="w-full" loading={registerPending}>
            Create Account
          </Button>
        </form>

        <p className="text-center text-sm text-slate-400 mt-4">
          Already have an account?{' '}
          <Link to="/login" className="text-accent-500 hover:text-accent-400">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
