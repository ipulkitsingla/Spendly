import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState('request_otp'); // 'request_otp', 'verify_otp', 'reset_password'
  
  // Form State
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  
  // UI State
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    if (!email) return setErr('Please enter your email');
    setErr('');
    setMsg('');
    setLoading(true);
    try {
      const res = await api.forgotPassword(email);
      setMsg(res.message || 'OTP sent successfully');
      setStep('verify_otp');
    } catch (error) {
      setErr(error.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) return setErr('Please enter a valid 6-digit OTP');
    setErr('');
    setMsg('');
    setLoading(true);
    try {
      const res = await api.verifyOtp(email, otp);
      setResetToken(res.resetToken);
      setStep('reset_password');
    } catch (error) {
      setErr(error.message || 'Invalid or expired OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) return setErr('Password must be at least 6 characters');
    setErr('');
    setMsg('');
    setLoading(true);
    try {
      await api.resetPassword(resetToken, newPassword);
      alert('Password reset successfully! Please log in.');
      navigate('/login');
    } catch (error) {
      setErr(error.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen animate-fade-in">
      <div className="auth-card">
        <h1 className="auth-title">Reset Password</h1>
        
        {step === 'request_otp' && (
          <>
            <p className="auth-subtitle">Enter your email to receive a 6-digit verification code.</p>
            <form onSubmit={handleRequestOtp}>
              <div className="form-group">
                <label className="label" htmlFor="email">Email address</label>
                <input
                  id="email"
                  type="email"
                  className="input"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              {err && <p className="error-text" role="alert">{err}</p>}
              <button type="submit" className="btn btn-primary btn-block" disabled={loading} style={{ marginTop: '24px' }}>
                {loading ? 'Sending...' : 'Send OTP'}
              </button>
            </form>
          </>
        )}

        {step === 'verify_otp' && (
          <>
            <p className="auth-subtitle">We've sent a 6-digit code to <strong>{email}</strong>.</p>
            <form onSubmit={handleVerifyOtp}>
              <div className="form-group">
                <label className="label" htmlFor="otp">Verification Code</label>
                <input
                  id="otp"
                  type="text"
                  className="input"
                  placeholder="123456"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                  autoFocus
                  required
                  style={{ letterSpacing: '0.5em', textAlign: 'center', fontSize: '1.2rem', fontWeight: 'bold' }}
                />
              </div>
              {err && <p className="error-text" role="alert">{err}</p>}
              {msg && <p className="success-text" style={{ color: 'var(--income)', fontSize: '0.875rem' }}>{msg}</p>}
              <button type="submit" className="btn btn-primary btn-block" disabled={loading} style={{ marginTop: '24px' }}>
                {loading ? 'Verifying...' : 'Verify Code'}
              </button>
            </form>
          </>
        )}

        {step === 'reset_password' && (
          <>
            <p className="auth-subtitle">Code verified! Create a new password.</p>
            <form onSubmit={handleResetPassword}>
              <div className="form-group">
                <label className="label" htmlFor="newPassword">New Password</label>
                <input
                  id="newPassword"
                  type="password"
                  className="input"
                  placeholder="At least 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              {err && <p className="error-text" role="alert">{err}</p>}
              <button type="submit" className="btn btn-primary btn-block" disabled={loading} style={{ marginTop: '24px' }}>
                {loading ? 'Saving...' : 'Reset Password'}
              </button>
            </form>
          </>
        )}

        <div className="auth-footer" style={{ marginTop: '32px' }}>
          <p>Remember your password? <Link to="/login" className="auth-link">Log in</Link></p>
        </div>
      </div>
    </div>
  );
}
