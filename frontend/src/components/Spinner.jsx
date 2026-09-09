export default function Spinner({ full }) {
  const spinner = (
    <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />
  );
  if (!full) return spinner;
  return <div className="flex h-full min-h-[40vh] items-center justify-center">{spinner}</div>;
}
