import { useState } from 'react';
import { supabase } from '../lib/supabase';
import './AuthModal.css';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        onClose();
      } else if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
        setMessage('Check your email for the confirmation link.');
      } else if (mode === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/callback`,
        });
        if (error) throw error;
        setMessage('Check your email for the password reset link.');
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-modal-overlay">
      <div className="auth-modal">
        <button className="close-button" onClick={onClose}>&times;</button>
        
        <div className="auth-tabs">
          <button 
            className={mode === 'login' ? 'active' : ''} 
            onClick={() => setMode('login')}
          >
            Login
          </button>
          <button 
            className={mode === 'signup' ? 'active' : ''} 
            onClick={() => setMode('signup')}
          >
            Sign Up
          </button>
          <button 
            className={mode === 'reset' ? 'active' : ''} 
            onClick={() => setMode('reset')}
          >
            Reset Password
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {mode !== 'reset' && (
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          )}

          {message && <div className="message">{message}</div>}

          <button type="submit" disabled={loading}>
            {loading ? 'Loading...' : mode === 'login' ? 'Login' : mode === 'signup' ? 'Sign Up' : 'Reset Password'}
          </button>

          <button 
            type="button" 
            className="google-button"
            onClick={async () => {
              const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                  redirectTo: `${window.location.origin}/auth/callback`,
                },
              });
              if (error) setMessage(error.message);
            }}
          >
            Continue with Google
          </button>
        </form>
      </div>
    </div>
  );
}