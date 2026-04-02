import { useForm } from 'react-hook-form'
import { useProfile, useUpdateProfile } from '../hooks/useProfile'
import PageContainer from '../components/layout/PageContainer'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import toast from 'react-hot-toast'
import { useEffect } from 'react'
import Spinner from '../components/ui/Spinner'

export default function ProfilePage() {
  const { data: profile, isLoading } = useProfile()
  const updateProfile = useUpdateProfile()
  const { register, handleSubmit, reset, formState: { errors } } = useForm()

  useEffect(() => {
    if (profile) reset(profile)
  }, [profile, reset])

  async function onSubmit(data) {
    try {
      await updateProfile.mutateAsync(data)
      toast.success('Profile updated!')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update')
    }
  }

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>

  return (
    <PageContainer>
      <h1 className="text-2xl font-bold text-slate-100 mb-6">Shipping Profile</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="bg-surface border border-border rounded-xl p-6 max-w-lg space-y-4">
        <Input label="Full Name" error={errors.shipping_name?.message} {...register('shipping_name')} />
        <Input label="Address Line 1" {...register('shipping_address_line1')} />
        <Input label="Address Line 2 (optional)" {...register('shipping_address_line2')} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="City" {...register('shipping_city')} />
          <Input label="Postal Code" {...register('shipping_postal_code')} />
        </div>
        <Input label="Country" {...register('shipping_country')} />
        <Button type="submit" loading={updateProfile.isPending}>Save Changes</Button>
      </form>
    </PageContainer>
  )
}
