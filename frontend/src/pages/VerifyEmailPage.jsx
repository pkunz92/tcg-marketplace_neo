import { Link, useSearchParams } from 'react-router-dom'
import { Mail, CheckCircle } from 'lucide-react'
import Button from '../components/ui/Button'

export default function VerifyEmailPage() {
  const [params] = useSearchParams()
  const verified = params.get('verified') === 'true'

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 bg-elevated border border-border rounded-full flex items-center justify-center mx-auto mb-6">
          {verified ? <CheckCircle size={28} className="text-green-400" /> : <Mail size={28} className="text-accent-400" />}
        </div>
        {verified ? (
          <>
            <h1 className="text-2xl font-bold text-slate-100 mb-2">Email Verified!</h1>
            <p className="text-slate-400 text-sm mb-6">Your account is ready. You can now sign in.</p>
            <Link to="/login"><Button>Go to Sign In</Button></Link>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-slate-100 mb-2">Check Your Email</h1>
            <p className="text-slate-400 text-sm mb-6">
              We sent a verification link to your email address. Click the link to activate your account.
            </p>
            <Link to="/login"><Button variant="secondary">Back to Sign In</Button></Link>
          </>
        )}
      </div>
    </div>
  )
}
