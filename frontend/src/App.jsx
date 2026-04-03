import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import RootLayout from './components/layout/RootLayout'
import AuthLayout from './components/layout/AuthLayout'
import HomePage from './pages/HomePage'
import CatalogPage from './pages/CatalogPage'
import CardDetailPage from './pages/CardDetailPage'
import MarketplacePage from './pages/MarketplacePage'
import ListingDetailPage from './pages/ListingDetailPage'
import CheckoutPage from './pages/CheckoutPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import VerifyEmailPage from './pages/VerifyEmailPage'
import DashboardPage from './pages/DashboardPage'
import MyListingsPage from './pages/MyListingsPage'
import MyOrdersPage from './pages/MyOrdersPage'
import MyOffersPage from './pages/MyOffersPage'
import ProfilePage from './pages/ProfilePage'
import NotFoundPage from './pages/NotFoundPage'

const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'cards', element: <CatalogPage /> },
      { path: 'cards/:apiId', element: <CardDetailPage /> },
      { path: 'market', element: <MarketplacePage /> },
      { path: 'market/:listingId', element: <ListingDetailPage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      { path: 'verify-email', element: <VerifyEmailPage /> },
      {
        element: <AuthLayout />,
        children: [
          { path: 'dashboard', element: <DashboardPage /> },
          { path: 'dashboard/listings', element: <MyListingsPage /> },
          { path: 'dashboard/orders', element: <MyOrdersPage /> },
          { path: 'dashboard/offers', element: <MyOffersPage /> },
          { path: 'dashboard/profile', element: <ProfilePage /> },
          { path: 'checkout/:listingId', element: <CheckoutPage /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
