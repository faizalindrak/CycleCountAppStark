import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowUpRight,
  BadgeCheck,
  Calculator,
  ClipboardList,
  Layers3,
  LogOut,
  Package,
  Settings,
  Users,
} from 'lucide-react';

const Home = () => {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  const menuCards = [
    {
      title: 'Cycle Count',
      description: 'Mulai sesi penghitungan stok secara terarah.',
      icon: Calculator,
      iconClass: 'bg-blue-600 text-white shadow-blue-200',
      accentClass: 'from-blue-500 to-cyan-400',
      action: () => navigate('/sessions'),
    },
    {
      title: 'Report Status Raw Mat',
      description: 'Pantau kondisi persediaan raw material secara cepat.',
      icon: AlertTriangle,
      iconClass: 'bg-indigo-600 text-white shadow-indigo-200',
      accentClass: 'from-indigo-500 to-violet-400',
      action: () => navigate('/reportstatus'),
    },
    {
      title: 'Report Backlog',
      description: 'Catat dan pantau transaksi inventory backlog.',
      icon: ClipboardList,
      iconClass: 'bg-sky-600 text-white shadow-sky-200',
      accentClass: 'from-sky-500 to-blue-400',
      action: () => navigate('/backlog'),
    },
    {
      title: 'Material FIFO',
      description: 'Kelola stok dan lot FIFO Raw Material.',
      icon: Layers3,
      iconClass: 'bg-[#215bea] text-white shadow-blue-200',
      accentClass: 'from-[#215bea] to-blue-400',
      action: () => navigate('/material-fifo'),
    },
  ];

  if (profile?.role === 'admin') {
    menuCards.push({
      title: 'Admin Page',
      description: 'Kelola sesi, item, user, dan pengaturan aplikasi.',
      icon: Settings,
      iconClass: 'bg-slate-800 text-white shadow-slate-200',
      accentClass: 'from-slate-700 to-slate-500',
      action: () => navigate('/admin/sessions'),
    });
  }

  const displayName = user?.user_metadata?.name || user?.email || 'Pengguna';
  const roleLabel = profile?.role === 'counter' ? 'Counter' : profile?.role || 'User';

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f5f8ff] text-slate-900">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -left-32 -top-36 h-96 w-96 rounded-full bg-blue-200/45 blur-3xl" />
        <div className="absolute -bottom-48 -right-28 h-[32rem] w-[32rem] rounded-full bg-indigo-200/35 blur-3xl" />
        <Package data-testid="dashboard-watermark" className="absolute -right-24 top-24 h-[30rem] w-[30rem] rotate-12 text-blue-900/[0.035]" strokeWidth={1} />
      </div>

      <header className="relative border-b border-blue-100/80 bg-white/85 shadow-[0_8px_28px_rgba(37,99,235,0.06)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8 lg:px-10">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#215bea] text-white shadow-lg shadow-blue-200">
              <Package aria-hidden="true" className="h-6 w-6" strokeWidth={1.8} />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-black tracking-[-0.04em] text-slate-950">WMS</p>
              <p className="truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Warehouse Management System</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-blue-100 bg-blue-50/80 px-3 py-2 text-xs font-semibold text-blue-800 sm:flex">
              <BadgeCheck aria-hidden="true" className="h-4 w-4 text-blue-600" />
              <span>{roleLabel}</span>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="text-emerald-700">Aktif</span>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              aria-label="Keluar"
              className="group flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:-translate-y-0.5 hover:border-red-200 hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-4 focus:ring-blue-100"
            >
              <LogOut aria-hidden="true" className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
              <span className="hidden sm:block">Keluar</span>
            </button>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-12">
        <section className="mb-8 flex flex-col justify-between gap-6 sm:mb-10 sm:flex-row sm:items-end">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.24em] text-blue-600">Control Center</p>
            <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Dashboard</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500 sm:text-base">
              Selamat datang kembali, <span className="font-semibold text-slate-700">{displayName}</span>. Pilih menu untuk melanjutkan operasional gudang.
            </p>
          </div>
          <div className="flex w-fit items-center gap-3 rounded-2xl border border-blue-100 bg-white/75 px-4 py-3 shadow-sm">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <BadgeCheck aria-hidden="true" className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Status operasional</p>
              <p className="text-sm font-bold text-slate-800">Sistem siap digunakan</p>
            </div>
          </div>
        </section>

        <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3" aria-label="Menu dashboard">
          {menuCards.map(({ title, description, icon: Icon, iconClass, accentClass, action }) => (
            <button
              key={title}
              type="button"
              onClick={action}
              aria-label={`Buka ${title}`}
              className="group relative flex min-h-[178px] flex-col overflow-hidden rounded-3xl border border-blue-100/80 bg-white p-6 text-left shadow-[0_10px_28px_rgba(37,99,235,0.07)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_38px_rgba(37,99,235,0.16)] focus:outline-none focus:ring-4 focus:ring-blue-100"
            >
              <span className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${accentClass}`} />
              <div className="flex items-start justify-between gap-4">
                <span className={`flex h-12 w-12 items-center justify-center rounded-2xl shadow-lg transition duration-300 group-hover:scale-110 ${iconClass}`}>
                  <Icon aria-hidden="true" className="h-6 w-6" strokeWidth={1.8} />
                </span>
                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-100 text-slate-300 transition group-hover:border-blue-100 group-hover:bg-blue-50 group-hover:text-blue-600">
                  <ArrowUpRight aria-hidden="true" className="h-5 w-5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </span>
              </div>
              <div className="mt-auto pt-8">
                <h2 className="text-lg font-bold tracking-tight text-slate-900">{title}</h2>
                <p className="mt-1 text-sm leading-5 text-slate-500">{description}</p>
              </div>
            </button>
          ))}

          <article className="relative flex min-h-[178px] flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white/80 p-6 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
            <div className="flex items-start justify-between gap-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <Users aria-hidden="true" className="h-6 w-6" strokeWidth={1.8} />
              </span>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700">Terhubung</span>
            </div>
            <div className="mt-auto pt-8">
              <h2 className="text-lg font-bold tracking-tight text-slate-900">User Information</h2>
              <p className="mt-1 text-sm text-slate-500">Role: <span className="font-semibold capitalize text-slate-700">{roleLabel}</span></p>
              <p className="text-sm text-slate-500">Status: <span className="font-semibold text-emerald-600">{profile?.status || 'active'}</span></p>
            </div>
          </article>
        </section>

        <footer className="mt-10 flex flex-col gap-2 border-t border-blue-100/80 pt-5 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <span>Warehouse Management System</span>
          <span className="font-medium text-slate-500">Akses aman untuk operasional gudang dan inventaris.</span>
        </footer>
      </main>
    </div>
  );
};

export default Home;
