import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, Eye, EyeOff, Info, Lock, Mail, Package } from 'lucide-react';

const LoginForm = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState('counter');
  const [status, setStatus] = useState('inactive');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { signIn, signUp } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);

    try {
      if (isSignUp) {
        if (!name || !username) {
          throw new Error('Please fill in all fields');
        }

        const { data, error } = await signUp(email, password, {
          name,
          username,
          role,
          status,
        });

        if (error) throw error;

        if (data.user && !data.session) {
          setInfo('Account created successfully! Please check your email to confirm your account. Note: Your account will be inactive until an administrator activates it.');
          resetForm();
        }
      } else {
        const { error } = await signIn(email, password);
        if (error) throw error;

        // Navigate to home page after successful login
        // The navigation will happen after the auth state updates
        setTimeout(() => {
          navigate('/home');
        }, 100);
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setName('');
    setUsername('');
    setRole('counter');
    setStatus('inactive');
    setError('');
  };

  return (
    <div className="min-h-screen bg-slate-50 lg:grid lg:grid-cols-2">
      <aside className="login-grid-pattern relative hidden overflow-hidden bg-white lg:flex lg:items-center lg:justify-center">
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-blue-100/60 blur-3xl" />
        <div className="absolute -bottom-32 -right-20 h-80 w-80 rounded-full bg-indigo-100/60 blur-3xl" />
        <div className="relative mx-auto flex max-w-md flex-col items-center px-10 text-center">
          <div className="flex h-36 w-36 items-center justify-center rounded-[2rem] bg-blue-50 shadow-[0_18px_45px_rgba(37,99,235,0.12)] ring-1 ring-blue-100">
            <Package aria-hidden="true" className="h-20 w-20 text-blue-600" strokeWidth={1.5} />
          </div>
          <p className="mt-8 text-7xl font-black tracking-[-0.08em] text-slate-950">WMS</p>
          <p className="mt-3 text-xl font-semibold tracking-tight text-slate-500">Warehouse Management System</p>
          <p className="mt-4 max-w-sm text-sm leading-6 text-slate-400">Kelola inventaris dan logistik gudang Anda dengan efisien dan akurat.</p>
        </div>
      </aside>

      <main className="relative flex min-h-screen items-center overflow-hidden bg-[#215bea] px-5 py-10 text-white sm:px-10 lg:px-16">
        <div className="pointer-events-none absolute -right-32 -top-28 h-72 w-72 rounded-full bg-blue-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-36 -left-24 h-80 w-80 rounded-full bg-indigo-950/20 blur-3xl" />
        <div className="relative mx-auto w-full max-w-md">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
              <Package aria-hidden="true" className="h-6 w-6" />
            </span>
            <div>
              <p className="text-lg font-black tracking-tight">WMS</p>
              <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-blue-100">Warehouse Management</p>
            </div>
          </div>

          <div className="mb-8">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-blue-100">Warehouse Management System</p>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{isSignUp ? 'Buat Akun' : 'Selamat Datang'}</h1>
            <p className="mt-3 text-base text-blue-100 sm:text-lg">{isSignUp ? 'Daftarkan akun Anda untuk mulai bekerja.' : 'Silakan masuk ke akun Anda untuk melanjutkan.'}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate={false}>
            {isSignUp && (
              <>
                <div className="relative">
                  <label htmlFor="login-name" className="sr-only">Nama Lengkap</label>
                  <input id="login-name" type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl border border-white/25 bg-blue-700/30 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-blue-100/80 focus:border-white/70 focus:bg-blue-700/45 focus:ring-4 focus:ring-white/10" placeholder="Nama Lengkap" autoComplete="name" required />
                </div>
                <div className="relative">
                  <label htmlFor="login-username" className="sr-only">Username</label>
                  <input id="login-username" type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full rounded-xl border border-white/25 bg-blue-700/30 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-blue-100/80 focus:border-white/70 focus:bg-blue-700/45 focus:ring-4 focus:ring-white/10" placeholder="Username" autoComplete="username" required />
                </div>
              </>
            )}

            <div className="relative">
              <label htmlFor="login-email" className="sr-only">Alamat Email</label>
              <Mail aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-blue-100" strokeWidth={1.8} />
              <input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-xl border border-white/25 bg-blue-700/30 py-3.5 pl-12 pr-4 text-sm text-white outline-none transition placeholder:text-blue-100/80 focus:border-white/70 focus:bg-blue-700/45 focus:ring-4 focus:ring-white/10" placeholder="Alamat Email" autoComplete="email" required />
            </div>

            <div className="relative">
              <label htmlFor="login-password" className="sr-only">Kata Sandi</label>
              <Lock aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-blue-100" strokeWidth={1.8} />
              <input id="login-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl border border-white/25 bg-blue-700/30 py-3.5 pl-12 pr-12 text-sm text-white outline-none transition placeholder:text-blue-100/80 focus:border-white/70 focus:bg-blue-700/45 focus:ring-4 focus:ring-white/10" placeholder="Kata Sandi" autoComplete={isSignUp ? 'new-password' : 'current-password'} required minLength={6} />
              <button type="button" aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'} onClick={() => setShowPassword((visible) => !visible)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-blue-100 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/60">
                {showPassword ? <EyeOff aria-hidden="true" className="h-5 w-5" /> : <Eye aria-hidden="true" className="h-5 w-5" />}
              </button>
            </div>

            {error && (
              <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200/40 bg-red-950/20 p-3.5 text-red-50">
                <AlertCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                <div className="flex-1 text-sm leading-relaxed">{error}</div>
              </div>
            )}

            {info && (
              <div role="status" className="flex items-start gap-3 rounded-xl border border-white/25 bg-white/10 p-3.5 text-blue-50">
                <Info aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                <div className="flex-1 text-sm leading-relaxed">{info}</div>
              </div>
            )}

            <button type="submit" disabled={loading} className="group flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3.5 text-sm font-bold text-blue-700 shadow-[0_12px_28px_rgba(15,23,42,0.16)] transition hover:-translate-y-0.5 hover:bg-blue-50 focus:outline-none focus:ring-4 focus:ring-white/30 disabled:cursor-not-allowed disabled:opacity-60">
              {loading ? (
                <><span className="h-5 w-5 animate-spin rounded-full border-2 border-blue-200 border-t-blue-700" />{isSignUp ? 'Mendaftarkan...' : 'Memproses...'}</>
              ) : (
                <>{isSignUp ? 'Daftar Sekarang' : 'Masuk Sekarang'}<ArrowRight aria-hidden="true" className="h-5 w-5 transition-transform group-hover:translate-x-1" /></>
              )}
            </button>
          </form>

          <div className="mt-7 flex items-center justify-center gap-1.5 text-sm text-blue-100">
            <span>{isSignUp ? 'Sudah punya akun?' : 'Belum punya akun?'}</span>
            <button type="button" onClick={() => { setIsSignUp(!isSignUp); resetForm(); setInfo(''); }} className="font-bold text-white underline decoration-white/40 underline-offset-4 transition hover:decoration-white focus:outline-none focus:ring-2 focus:ring-white/60">
              {isSignUp ? 'Kembali ke login' : 'Buat akun baru'}
            </button>
          </div>

          <p className="mt-10 text-center text-[11px] leading-5 text-blue-100/75">Akses aman untuk operasional gudang dan inventaris perusahaan.</p>
        </div>
      </main>
    </div>
  );
};

export default LoginForm;
