// Consistent label + input wrapper used across every form in the app.
export default function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export function inputClass(extra = '') {
  return `w-full rounded-lg border border-slate-300 px-3 py-3 text-base focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 ${extra}`;
}
