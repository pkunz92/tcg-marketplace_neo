import { redirect } from 'next/navigation'

// /dashboard/listings redirects to the unified seller dashboard (Inventory tab)
export default function DashboardListingsRedirect() {
  redirect('/dashboard/seller')
}
