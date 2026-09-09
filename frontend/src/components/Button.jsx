const variants = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 disabled:bg-slate-300',
  secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50',
  accent: 'bg-accent-500 text-white hover:bg-accent-600 disabled:bg-slate-300',
  danger: 'bg-white text-red-600 border border-red-200 hover:bg-red-50',
};

export default function Button({ variant = 'primary', className = '', ...props }) {
  return (
    <button
      className={`rounded-lg px-4 py-3 text-base font-medium transition-colors disabled:cursor-not-allowed ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
