import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, getLandingPath } from '../context/AuthContext';
import Button from '../components/Button';
import Field, { inputClass } from '../components/Field';
import ErrorBanner from '../components/ErrorBanner';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const user = await login(email.trim(), password);
      navigate(getLandingPath(user), { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-900 via-brand-800 to-brand-700 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent-500 text-2xl shadow-lg">
            ⛏️
          </div>
          <h1 className="text-2xl font-bold text-white">Bhushilp Mines and Minerals Pvt. Ltd.</h1>
          <p className="mt-2 text-sm text-brand-200">Daily Reporting — sign in to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border-t-4 border-accent-500 bg-white p-6 shadow-xl">
          <Field label="Email">
            <input
              type="email"
              required
              autoFocus
              className={inputClass()}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label="Password">
            <input
              type="password"
              required
              className={inputClass()}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <ErrorBanner message={error} />
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  );
}
