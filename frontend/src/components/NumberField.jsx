import Field, { inputClass } from './Field';

// Labelled numeric input. `value` stays a string ('' = blank) so an empty
// field is distinguishable from 0; callers convert on save.
export default function NumberField({ label, hint, value, onChange, inputMode = 'decimal', ...rest }) {
  return (
    <Field label={label} hint={hint}>
      <input
        type="number"
        inputMode={inputMode}
        className={inputClass()}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...rest}
      />
    </Field>
  );
}
