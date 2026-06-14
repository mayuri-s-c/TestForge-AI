import { FormEvent, useState } from 'react';
import { useAuth } from '../context/AuthContext';

export function LoginPage() {
  const { login } = useAuth();
  const [loginValue, setLoginValue] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await login(loginValue, password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-backdrop" />
      <div className="login-card">
        <div className="login-brand">
          <div className="sidebar-logo">QA</div>
          <div>
            <h1>AI Automation</h1>
            <p>Sign in to access the test intelligence dashboard</p>
          </div>
        </div>

        <form className="login-form" onSubmit={handleSubmit} autoComplete="off">
          <label className="login-field">
            <span>Email or Username</span>
            <input
              type="text"
              name="login"
              value={loginValue}
              onChange={(e) => setLoginValue(e.target.value)}
              placeholder="Enter email or username"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              required
            />
          </label>

          <label className="login-field">
            <span>Password</span>
            <input
              type="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              autoComplete="new-password"
              required
            />
          </label>

          {error && <div className="login-error">{error}</div>}

          <button type="submit" className="btn btn-primary login-submit" disabled={submitting}>
            {submitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="login-footnote">
          Sessions expire after 15 minutes of inactivity.
        </p>
      </div>
    </div>
  );
}
