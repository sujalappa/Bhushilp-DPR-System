import Field, { inputClass } from './Field';

// Labelled numeric input. `value` stays a string ('' = blank) so an empty
// field is distinguishable from 0; callers convert on save.
export default function NumberField({ label, hint, value, onChange, inputMode = 'decimal', className = '', ...rest }) {
  return (
    <Field label={label} hint={hint}>
      <input
        type="number"
        inputMode={inputMode}
        className={inputClass(className)}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        // A focused number box changes its value when the mouse wheel moves
        // over it, so scrolling the page could silently alter a figure.
        // Dropping focus on wheel lets the page scroll and leaves the value.
        onWheel={(e) => e.currentTarget.blur()}
        {...rest}
      />
    </Field>
  );
}
