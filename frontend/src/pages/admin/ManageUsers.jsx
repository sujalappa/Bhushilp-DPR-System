import { useEffect, useState } from 'react';
import * as usersApi from '../../api/users';
import * as projectsApi from '../../api/projects';
import AppShell from '../../components/AppShell';
import Button from '../../components/Button';
import Field, { inputClass } from '../../components/Field';
import ErrorBanner from '../../components/ErrorBanner';
import Spinner from '../../components/Spinner';
import { formsForProjectType, PROJECT_TYPES } from '../../utils/forms';

// Only the forms that exist for that kind of project, and only ones that
// are built — no point granting access to something that isn't there.
const grantableForms = (project) => formsForProjectType(project.type).filter((f) => f.implemented);
const typeLabel = (type) => PROJECT_TYPES.find((t) => t.value === type)?.label || type;

export default function ManageUsers() {
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

  return (
    <AppShell title="Manage Users" backTo="/projects">
      <ErrorBanner message={error} />

      {users === null ? (
        <Spinner full />
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <div key={u._id} className="rounded-lg border border-slate-200 bg-white">
              <button
                className="flex w-full items-center justify-between p-4 text-left"
                onClick={() => setExpandedUserId(expandedUserId === u._id ? null : u._id)}
              >
                <div>
                  <div className="font-medium text-slate-900">{u.name}</div>
                  <div className="text-sm text-slate-500">{u.email}</div>
                </div>
                {u.isSuperAdmin ? (
                  <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-medium text-brand-700">
                    Superadmin
                  </span>
                ) : (
                  <span className="text-sm text-slate-400">
                    {u.assignments.length} project{u.assignments.length === 1 ? '' : 's'}
                  </span>
                )}
              </button>

              {expandedUserId === u._id && !u.isSuperAdmin && (
                <AccessEditor user={u} projects={projects} onSaved={load} />
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-6">
        {!showNewUser ? (
          <Button variant="accent" className="w-full" onClick={() => setShowNewUser(true)}>
            + New User
          </Button>
        ) : (
          <NewUserForm
            onCreated={() => {
              setShowNewUser(false);
              load();
            }}
            onCancel={() => setShowNewUser(false)}
          />
        )}
      </div>
    </AppShell>
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
    <div className="border-t border-slate-200 p-4">
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

function NewUserForm({ onCreated, onCancel }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await usersApi.createUser({ name, email, password, isSuperAdmin });
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
      <Field label="Name">
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
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          className="h-5 w-5"
          checked={isSuperAdmin}
          onChange={(e) => setIsSuperAdmin(e.target.checked)}
        />
        Superadmin (full access to everything)
      </label>
      <ErrorBanner message={error} />
      <div className="flex gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create user'}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
