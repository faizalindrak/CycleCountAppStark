import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowUpRight, BadgeCheck, Calendar, ChevronRight, ClipboardList, Clock, Home, LogOut, Package2, PackageCheck, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';

// Countdown Timer Component
const CountdownTimer = ({ targetTime }) => {
  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft(targetTime));

  function calculateTimeLeft(target) {
    const now = new Date();
    const targetDate = new Date(target);
    const difference = targetDate - now;

    if (difference <= 0) {
      return { expired: true, text: 'Expired' };
    }

    const hours = Math.floor(difference / (1000 * 60 * 60));
    const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((difference % (1000 * 60)) / 1000);

    const isWarning = difference < 30 * 60 * 1000; // Less than 30 minutes
    const isCritical = difference < 10 * 60 * 1000; // Less than 10 minutes

    let text = '';
    if (hours > 0) {
      text = `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      text = `${minutes}m ${seconds}s`;
    } else {
      text = `${seconds}s`;
    }

    return { expired: false, text, isWarning, isCritical, difference };
  }

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft(targetTime));
    }, 1000);

    return () => clearInterval(timer);
  }, [targetTime]);

  if (timeLeft.expired) {
    return (
      <span className="text-red-600 font-semibold">
        Session Expired
      </span>
    );
  }

  const colorClass = timeLeft.isCritical
    ? 'text-red-600 font-bold'
    : timeLeft.isWarning
    ? 'text-orange-600 font-semibold'
    : 'text-green-600';

  return (
    <span className={colorClass}>
      Closes in: {timeLeft.text}
    </span>
  );
};

const SessionSelection = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      fetchUserSessions();
    }
  }, [user]);

  const fetchUserSessions = async () => {
    try {
      setLoading(true);
      setError('');

      // Get user's profile to check their role
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;

      const today = new Date().toISOString().split('T')[0];

      let query = supabase
        .from('sessions')
        .select(`
          *,
          session_users (
            user_id
          )
        `)
        .in('status', ['active']); // Only show active sessions

      // If user is not admin, only show sessions they're assigned to
      if (profile.role !== 'admin') {
        query = query.eq('session_users.user_id', user.id);
      }

      const { data, error } = await query.order('created_date', { ascending: false });

      if (error) throw error;

      // Filter out scheduled sessions that are not for today and expired sessions
      const now = new Date();
      const validSessions = (data || []).filter(session => {
        // Hide scheduled sessions that are not for today
        if (session.status === 'scheduled' && session.scheduled_date !== today) {
          return false;
        }

        // Hide sessions that have expired (past valid_until)
        if (session.valid_until && new Date(session.valid_until) < now) {
          return false;
        }

        // Hide sessions that haven't started yet (before valid_from)
        if (session.valid_from && new Date(session.valid_from) > now) {
          return false;
        }

        // Hide recurring templates (users should only see generated sessions)
        if (session.is_recurring_template) {
          return false;
        }

        return true;
      });

      setSessions(validSessions);
    } catch (err) {
      console.error('Error fetching sessions:', err);
      setError('Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  const handleGoHome = () => {
    navigate('/home');
  };

  const displayName = user?.user_metadata?.name || user?.email || 'Operator';

  const shell = (children) => (
    <div className="relative min-h-screen overflow-hidden bg-[#f5f8ff] text-slate-900">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -left-32 -top-36 h-96 w-96 rounded-full bg-blue-200/45 blur-3xl" />
        <div className="absolute -bottom-48 -right-28 h-[32rem] w-[32rem] rounded-full bg-indigo-200/35 blur-3xl" />
        <PackageCheck className="absolute -right-24 top-20 h-[30rem] w-[30rem] rotate-12 text-blue-900/[0.035]" strokeWidth={1} />
      </div>
      <header className="relative border-b border-blue-100/80 bg-white/85 shadow-[0_8px_28px_rgba(37,99,235,0.06)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8 lg:px-10">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#215bea] text-white shadow-lg shadow-blue-200">
              <PackageCheck aria-hidden="true" className="h-6 w-6" strokeWidth={1.8} />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-black tracking-[-0.04em] text-slate-950">WMS</p>
              <p className="truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Warehouse Management System</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden max-w-[180px] truncate text-sm font-medium text-slate-500 sm:block">{displayName}</span>
            <button type="button" onClick={handleGoHome} aria-label="Kembali ke dashboard" className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-700 transition hover:-translate-y-0.5 hover:bg-blue-100 focus:outline-none focus:ring-4 focus:ring-blue-100" title="Kembali ke dashboard">
              <Home aria-hidden="true" className="h-4 w-4" />
            </button>
            <button type="button" onClick={handleSignOut} aria-label="Keluar" className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 transition hover:-translate-y-0.5 hover:border-red-200 hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-4 focus:ring-blue-100" title="Keluar">
              <LogOut aria-hidden="true" className="h-4 w-4" />
              <span className="hidden sm:block">Keluar</span>
            </button>
          </div>
        </div>
      </header>
      {children}
    </div>
  );

  if (loading) {
    return shell(
      <main className="relative mx-auto flex min-h-[70vh] max-w-7xl items-center justify-center px-5 py-10">
        <div className="flex flex-col items-center gap-4 rounded-3xl border border-blue-100 bg-white/85 px-10 py-9 text-center shadow-[0_16px_38px_rgba(37,99,235,0.08)]">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><RefreshCw className="h-7 w-7 animate-spin" /></span>
          <p className="text-sm font-semibold text-slate-600">Memuat sesi Cycle Count...</p>
        </div>
      </main>,
    );
  }

  return shell(
    <main className="relative mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-12">
      <section className="mb-8 flex flex-col justify-between gap-6 sm:mb-10 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.24em] text-blue-600">Cycle Count workspace</p>
          <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Pilih Sesi Cycle Count</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500 sm:text-base">Pilih sesi aktif untuk mulai menghitung item di area gudang Anda.</p>
        </div>
        <div className="flex w-fit items-center gap-3 rounded-2xl border border-blue-100 bg-white/80 px-4 py-3 shadow-sm">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><ClipboardList className="h-5 w-5" /></span>
          <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Sesi tersedia</p><p className="text-sm font-bold text-slate-800">{sessions.length} sesi aktif</p></div>
        </div>
      </section>

      {error && <div role="alert" className="mb-6 flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"><AlertCircle className="h-5 w-5 shrink-0" />{error}</div>}

      {sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-blue-200 bg-white/75 px-6 py-16 text-center shadow-sm">
          <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-500"><ClipboardList className="h-8 w-8" /></span>
          <h2 className="text-lg font-bold text-slate-800">Belum ada sesi aktif</h2>
          <p className="mt-1 max-w-sm text-sm text-slate-500">{error || 'Sesi Cycle Count yang aktif akan muncul di sini.'}</p>
        </div>
      ) : (
        <section className="grid gap-5 md:grid-cols-2" aria-label="Daftar sesi Cycle Count">
          {sessions.map((session) => {
            const hasTimeWindow = session.valid_from && session.valid_until;
            const now = new Date();
            const validUntil = session.valid_until ? new Date(session.valid_until) : null;
            const timeUntilClose = validUntil ? validUntil - now : null;
            const showWarning = timeUntilClose && timeUntilClose < 30 * 60 * 1000;

            return (
              <article key={session.id} className="relative overflow-hidden rounded-3xl border border-blue-100/80 bg-white shadow-[0_10px_28px_rgba(37,99,235,0.07)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_38px_rgba(37,99,235,0.16)]">
                <span className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${showWarning ? 'from-amber-400 to-orange-500' : 'from-blue-500 to-cyan-400'}`} />
                {showWarning && <div className="flex items-center gap-2 border-b border-amber-100 bg-amber-50 px-6 py-2.5 text-xs font-semibold text-amber-700"><AlertCircle className="h-4 w-4" />Sesi segera berakhir</div>}
                <button type="button" aria-label={`Buka sesi ${session.name}`} onClick={() => navigate(`/counting/${session.id}`)} className="group block w-full p-6 text-left focus:outline-none focus:ring-4 focus:ring-inset focus:ring-blue-100">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><Package2 className="h-5 w-5" /></span>
                      <div className="min-w-0"><h2 className="truncate text-lg font-bold tracking-tight text-slate-900">{session.name}</h2><p className="mt-1 text-xs font-medium uppercase tracking-wider text-slate-400">{session.type}</p></div>
                    </div>
                    <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${session.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{session.status}</span>
                  </div>
                  <div className="mt-6 flex flex-wrap gap-2 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5"><Package2 className="h-3.5 w-3.5 text-blue-500" />Items to count</span>
                    {session.scheduled_date && <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5"><Calendar className="h-3.5 w-3.5 text-blue-500" />{new Date(session.scheduled_date).toLocaleDateString()}</span>}
                    {hasTimeWindow && <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5"><Clock className="h-3.5 w-3.5 text-blue-500" />{new Date(session.valid_from).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} - {new Date(session.valid_until).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>}
                  </div>
                  {hasTimeWindow && validUntil && <div className="mt-5 flex items-center justify-between rounded-xl bg-blue-50/70 px-3 py-2 text-xs"><span className="flex items-center gap-1.5 font-semibold text-blue-700"><Clock className="h-4 w-4" />Batas waktu</span><CountdownTimer targetTime={session.valid_until} /></div>}
                  <div className="mt-5 flex items-center justify-end gap-1 text-sm font-bold text-blue-600">Mulai menghitung<ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></div>
                </button>
              </article>
            );
          })}
        </section>
      )}
    </main>,
  );
};

export default SessionSelection;
