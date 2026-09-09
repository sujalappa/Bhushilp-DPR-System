import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AppShell({ title, backTo, children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b-2 border-accent-500 bg-gradient-to-r from-brand-900 to-brand-700 px-4 py-3 shadow-sm">
        <div className="mx-auto max-w-2xl">
          <div className="mb-1 text-xs font-medium tracking-wide text-brand-200">
            Bhushilp Mines and Minerals Pvt. Ltd.
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {backTo && (
                <button
                  onClick={() => navigate(backTo)}
                  aria-label="Back"
                  className="rounded-md p-1 text-brand-100 hover:bg-white/10"
                >
                  ←
                </button>
              )}
              <h1 className="text-lg font-semibold text-white">{title}</h1>
            </div>
            <div className="flex items-center gap-3 text-sm text-brand-100">
              {/* A dropdown, not two more `hidden sm:inline` links — those
                  would be unreachable on a phone, which is this app's
                  primary device. */}
              {user?.isSuperAdmin && (
                <div className="relative">
                  <button
                    onClick={() => setAdminMenuOpen((o) => !o)}
                    className="rounded-md border border-white/30 px-3 py-1.5 text-white hover:bg-white/10"
                  >
                    Admin ▾
                  </button>
                  {adminMenuOpen && (
                    <>
                      {/* Click-outside-to-close backdrop */}
                      <div className="fixed inset-0 z-10" onClick={() => setAdminMenuOpen(false)} />
                      <div className="absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
                        <Link
                          to="/admin/users"
                          onClick={() => setAdminMenuOpen(false)}
                          className="block px-4 py-3 text-sm text-slate-700 hover:bg-slate-50"
                        >
                          Manage Users
                        </Link>
                        <Link
                          to="/admin/export"
                          onClick={() => setAdminMenuOpen(false)}
                          className="block px-4 py-3 text-sm text-slate-700 hover:bg-slate-50"
                        >
                          Export Data
                        </Link>
                      </div>
                    </>
                  )}
                </div>
              )}
              <button
                onClick={() => logout().then(() => navigate('/login'))}
                className="rounded-md border border-white/30 px-3 py-1.5 text-white hover:bg-white/10"
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-6">{children}</main>
    </div>
  );
}
