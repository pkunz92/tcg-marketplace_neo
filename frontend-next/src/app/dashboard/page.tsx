import { redirect } from 'next/navigation'

// /dashboard is not directly used — redirect to the seller dashboard
export default function DashboardPage() {
  redirect('/dashboard/seller')
}
