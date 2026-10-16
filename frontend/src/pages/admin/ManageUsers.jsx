import { useEffect, useState } from 'react';
import * as usersApi from '../../api/users';
import * as projectsApi from '../../api/projects';
import { useAuth } from '../../context/AuthContext';
import AppShell from '../../components/AppShell';
import Button from '../../components/Button';
import Field, { inputClass } from '../../components/Field';
import ErrorBanner from '../../components/ErrorBanner';
import Spinner from '../../components/Spinner';
import { formsForProjectType, PROJECT_TYPES } from '../../utils/forms';
import { ROLE_LABELS, roleOf } from '../../utils/roles';

// Only the forms that exist for that kind of project, and only ones that
// are built — no point granting access to something that isn't there.
const grantableForms = (project) => formsForProjectType(project.type).filter((f) => f.implemented);
const typeLabel = (type) => PROJECT_TYPES.find((t) => t.value === type)?.label || type;
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

const ROLE_HINTS = {
  supervisor: 'Fills in the forms you tick for them.',
  admin: 'Runs the projects you tick: all their data, work orders, rates, billing, export, analysis and supervisors.',
  superadmin: 'Full access to everything.',
};

// The superadmin manages everyone: roles, which projects each admin runs,
// and form access. An admin manages the supervisors of their own projects —
// the server only sends those, and only their access in those projects.
export default function ManageUsers() {
  const { user: me } = useAuth();
  const isSuperAdmin = roleOf(me) === 'superadmin';
  const [users, setUsers] = useState(null);
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState('');
  const [showNewUser, setShowNewUser] = useState(false);
  const [expandedUserId, setExpandedUserId] = useState(null);

  const load = () => {
    Promise.all([usersApi.listUsers(), projectsApi.listProjects()])
      .then(([userList, projectList]) => {
        setUsers(userList);
        setProjects(projectList);
      })
      .catch((err) => setError(err.message));
  };

  useEffect(load, []);

  const summary = (u) => {
    const role = roleOf(u);
    if (role === 'admin') return `Runs ${plural(u.adminProjects?.length || 0, 'project')}`;
    if (role === 'supervisor') return plural(u.assignments.length, 'project');
    return '';
  };

  return (
    <AppShell title={isSuperAdmin ? 'Manage Users' : 'Supervisors'} backTo="/projects">
      <ErrorBanner message={error} />

      {users === null ? (
        <Spinner full />
      ) : (
        <div className="space-y-2">
          {users.length === 0 && (
            <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
              No supervisors yet. Add the first one below.
            </p>
          )}
          {users.map((u) => {
            const role = roleOf(u);
            const isMe = u._id === me._id;
            return (
              <div key={u._id} className="rounded-lg border border-slate-200 bg-white">
                <button
                  className="flex w-full items-center justify-between gap-3 p-4 text-left"
                  onClick={() => setExpandedUserId(expandedUserId === u._id ? null : u._id)}
                >
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900">
                      {u.name}
                      {isMe && <span className="font-normal text-slate-400"> (you)</span>}
                    </div>
                    <div className="truncate text-sm text-slate-500">{u.email}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        role === 'supervisor' ? 'bg-slate-100 text-slate-600' : 'bg-brand-100 text-brand-700'
                      }`}
                    >
                      {ROLE_LABELS[role]}
                    </span>
                    {summary(u) && <div className="mt-1 text-xs text-slate-400">{summary(u)}</div>}
                  </div>
                </button>

                {expandedUserId === u._id && (
                  <div className="space-y-4 border-t border-slate-200 p-4">
                    {isSuperAdmin && !isMe && <RoleEditor user={u} onSaved={load} />}
                    {role === 'admin' && isSuperAdmin && <AdminProjectsEditor user={u} projects={projects} onSaved={load} />}
                    {role === 'supervisor' && <AccessEditor user={u} projects={projects} onSaved={load} />}
                    {role === 'superadmin' && <p className="text-sm text-slate-500">{ROLE_HINTS.superadmin}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6">
        {!showNewUser ? (
          <Button variant="accent" className="w-full" onClick={() => setShowNewUser(true)}>
            {isSuperAdmin ? '+ New User' : '+ New Supervisor'}
          </Button>
        ) : (
          <NewUserForm
            canPickRole={isSuperAdmin}
            projects={projects}
            onCreated={(created) => {
              setShowNewUser(false);
              setExpandedUserId(created._id);
              load();
            }}
            onCancel={() => setShowNewUser(false)}
          />
        )}
      </div>
    </AppShell>
  );
}

function RoleEditor({ user, onSaved }) {
  const [role, setRole] = useState(roleOf(user));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await usersApi.updateUser(user._id, { role });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <Field label="Role" hint={ROLE_HINTS[role]}>
        <div className="flex gap-2">
          <select className={inputClass()} value={role} onChange={(e) => setRole(e.target.value)}>
            {Object.entries(ROLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          {role !== roleOf(user) && (
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Change'}
            </Button>
          )}
        </div>
      </Field>
      <ErrorBanner message={error} />
    </div>
  );
}

// Which projects an admin runs — set by the superadmin.
function AdminProjectsEditor({ user, projects, onSaved }) {
  const [selected, setSelected] = useState(user.adminProjects || []);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const changed = JSON.stringify([...selected].sort()) !== JSON.stringify([...(user.adminProjects || [])].sort());

  const toggle = (id) => {
    setSaved(false);
    setSelected((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await usersApi.updateUser(user._id, { adminProjects: selected });
      setSaved(true);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <span className="mb-1 block text-sm font-medium text-slate-700">Projects this admin runs</span>
      <ProjectTicks projects={projects} selected={selected} onToggle={toggle} />
      <ErrorBanner message={error} />
      {saved && !changed && <p className="mt-2 text-sm text-green-700">Saved.</p>}
      {changed && (
        <Button className="mt-3" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save projects'}
        </Button>
      )}
    </div>
  );
}

function ProjectTicks({ projects, selected, onToggle }) {
  if (projects.length === 0) return <p className="text-sm text-slate-500">No projects yet.</p>;
  return (
    <div className="space-y-2">
      {projects.map((p) => (
        <label key={p._id} className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" className="h-5 w-5" checked={selected.includes(p._id)} onChange={() => onToggle(p._id)} />
          {p.name} <span className="text-slate-400">· {typeLabel(p.type)}</span>
        </label>
      ))}
    </div>
  );
}

function AccessEditor({ user, projects, onSaved }) {
  const [assignments, setAssignments] = useState(user.assignments);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const hasForm = (projectId, formSlug) =>
    assignments.some((a) => a.projectId === projectId && a.forms.includes(formSlug));

  const toggle = (projectId, formSlug) => {
    setSaved(false);
    setAssignments((prev) => {
      const existing = prev.find((a) => a.projectId === projectId);
      if (!existing) {
        return [...prev, { projectId, forms: [formSlug] }];
      }
      const nextForms = existing.forms.includes(formSlug)
        ? existing.forms.filter((f) => f !== formSlug)
        : [...existing.forms, formSlug];

      if (nextForms.length === 0) {
        return prev.filter((a) => a.projectId !== projectId);
      }
      return prev.map((a) => (a.projectId === projectId ? { ...a, forms: nextForms } : a));
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await usersApi.setAssignments(user._id, assignments);
      setEditing(false);
      setSaved(true);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <span className="mb-2 block text-sm font-medium text-slate-700">Forms this supervisor can fill in</span>
      {/* One block per project rather than a grid: different kinds of
          project have different forms, so there are no shared columns. */}
      <div className="space-y-3">
        {projects.map((p) => (
          <div key={p._id} className="rounded-lg border border-slate-100 p-3">
            <div className="mb-2 text-sm font-medium text-slate-900">
              {p.name} <span className="font-normal text-slate-400">· {typeLabel(p.type)}</span>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {grantableForms(p).map((f) => (
                <label key={f.slug} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    className="h-5 w-5 disabled:opacity-50"
                    checked={hasForm(p._id, f.slug)}
                    disabled={!editing}
                    onChange={() => toggle(p._id, f.slug)}
                  />
                  {f.label}
                </label>
              ))}
            </div>
          </div>
        ))}
        {projects.length === 0 && <p className="text-sm text-slate-500">No projects yet.</p>}
      </div>

      <ErrorBanner message={error} />
      {saved && !editing && <p className="mt-3 text-sm text-green-700">Saved.</p>}

      <div className="mt-3 flex items-center gap-3">
        {editing ? (
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save access'}
          </Button>
        ) : (
          <Button variant="secondary" onClick={() => setEditing(true)}>
            Edit
          </Button>
        )}
      </div>
    </div>
  );
}

function NewUserForm({ canPickRole, projects, onCreated, onCancel }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('supervisor');
  const [adminProjects, setAdminProjects] = useState([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const payload = { name, email, password, role };
      if (role === 'admin') payload.adminProjects = adminProjects;
      onCreated(await usersApi.createUser(payload));
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="font-semibold text-slate-900">{canPickRole ? 'New user' : 'New supervisor'}</h2>
      <Field label="Name" hint="As it should appear on entries — a supervisor's name is filled in for them on the forms.">
        <input required autoFocus className={inputClass()} value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Email">
        <input
          type="email"
          required
          className={inputClass()}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>
      <Field label="Password" hint="At least 8 characters">
        <input
          type="password"
          required
          minLength={8}
          className={inputClass()}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>
      {canPickRole && (
        <Field label="Role" hint={ROLE_HINTS[role]}>
          <select className={inputClass()} value={role} onChange={(e) => setRole(e.target.value)}>
            {Object.entries(ROLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      )}
      {role === 'admin' && (
        <div>
          <span className="mb-1 block text-sm font-medium text-slate-700">Projects this admin runs</span>
          <ProjectTicks
            projects={projects}
            selected={adminProjects}
            onToggle={(id) =>
              setAdminProjects((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]))
            }
          />
        </div>
      )}
      {role === 'supervisor' && <p className="text-sm text-slate-500">After creating, tick the forms they can fill in.</p>}
      <ErrorBanner message={error} />
      <div className="flex gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create'}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
