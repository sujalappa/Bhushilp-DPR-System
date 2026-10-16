import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import OfflineBar from '../offline/OfflineBar';
import { getItems } from '../offline/outbox';
import { isManager } from '../utils/roles';

export default function AppShell({ title, backTo, children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);

  // Entries still on the phone belong to this login and are deleted with
  // it, so say so first.
  const handleLogout = async () => {
    const waiting = getItems().length;
    if (
      waiting > 0 &&
      !window.confirm(
        `${waiting} ${waiting === 1 ? "entry on this phone hasn't" : "entries on this phone haven't"} been sent yet. Logging out deletes them. Log out anyway?`
      )
    ) {
      return;
    }
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      window.alert(err.message);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Header and the offline strip stay on screen together. */}
      <div className="sticky top-0 z-10">
        <header className="border-b-2 border-accent-500 bg-gradient-to-r from-brand-900 to-brand-700 px-4 py-3 shadow-sm">
          <div className="mx-auto max-w-2xl">
            <div className="mb-1 text-xs font-medium tracking-wide text-brand-200">
              Bhushilp Mines and Minerals Pvt. Ltd.
            </div>
            {/* The title gives way (wraps) before the buttons do, so a long
                page name can't squash "Admin" and "Log out" on a phone. */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                {backTo && (
                  <button
                    onClick={() => navigate(backTo)}
                    aria-label="Back"
                    className="shrink-0 rounded-md p-1 text-brand-100 hover:bg-white/10"
                  >
                    ←
                  </button>
                )}
                <h1 className="min-w-0 break-words text-lg font-semibold leading-tight text-white">{title}</h1>
              </div>
              <div className="flex shrink-0 items-center gap-2 whitespace-nowrap text-sm text-brand-100">
                {/* A dropdown, not two more `hidden sm:inline` links — those
                    would be unreachable on a phone, which is this app's
                    primary device. */}
                {isManager(user) && (
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
                          <Link
                            to="/admin/analysis"
                            onClick={() => setAdminMenuOpen(false)}
                            className="block px-4 py-3 text-sm text-slate-700 hover:bg-slate-50"
                          >
                            Analysis
                          </Link>
                        </div>
                      </>
                    )}
                  </div>
                )}
                <button
                  onClick={handleLogout}
                  className="rounded-md border border-white/30 px-3 py-1.5 text-white hover:bg-white/10"
                >
                  Log out
                </button>
              </div>
            </div>
          </div>
        </header>
        <OfflineBar />
      </div>
      <main className="mx-auto max-w-2xl px-4 py-6">{children}</main>
    </div>
  );
}
