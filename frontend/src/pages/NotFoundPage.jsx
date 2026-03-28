import { Link } from 'react-router-dom'
import Button from '../components/ui/Button'

export default function NotFoundPage() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
      <p className="text-8xl font-display font-bold text-accent-500/20">404</p>
      <h1 className="text-2xl font-bold text-slate-100 mt-2">Page not found</h1>
      <p className="text-slate-400 mt-2 mb-6">This card has escaped from the deck.</p>
      <Link to="/"><Button>Back to Home</Button></Link>
    </div>
  )
}
