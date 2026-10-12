import { useState } from 'react';
import { inputClass } from './Field';

// Native <input type="time"> renders in whatever 12h/24h format the
// device's OS locale is set to, which isn't reliable across clerks'
// phones. This always shows hour/minute/AM-PM dropdowns, and still reports
// the same "HH:mm" 24-hour string the backend expects.
const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

function to12h(value) {
  if (!value) return { hour: '', minute: '', period: 'AM' };
  const [h, m] = value.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  let hour = h % 12;
  if (hour === 0) hour = 12;
  return { hour: String(hour), minute: String(m).padStart(2, '0'), period };
}

function to24h({ hour, minute, period }) {
  if (hour === '' || minute === '') return '';
  let h = Number(hour) % 12;
  if (period === 'PM') h += 12;
  return `${String(h).padStart(2, '0')}:${minute}`;
}

export default function TimePicker12h({ value, onChange }) {
  // The dropdowns keep their own state: `value` is '' until both hour and
  // minute are chosen, so it can't represent a half-picked time on its own.
  const [parts, setParts] = useState(() => to12h(value));
  const [lastValue, setLastValue] = useState(value);

  // The parent changed the value itself (e.g. cleared the form after a
  // save) rather than echoing back what was just picked here.
  if (value !== lastValue) {
    setLastValue(value);
    if (value !== to24h(parts)) setParts(to12h(value));
  }

  const update = (patch) => {
    const next = { ...parts, ...patch };
    setParts(next);
    onChange(to24h(next));
  };

  return (
    <div className="flex gap-2">
      <select
        aria-label="Hour"
        className={inputClass('flex-1 min-w-0')}
        value={parts.hour}
        onChange={(e) => update({ hour: e.target.value })}
      >
        <option value="" disabled>
          HH
        </option>
        {HOURS.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <select
        aria-label="Minute"
        className={inputClass('flex-1 min-w-0')}
        value={parts.minute}
        onChange={(e) => update({ minute: e.target.value })}
      >
        <option value="" disabled>
          MM
        </option>
        {MINUTES.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
      <select
        aria-label="AM or PM"
        className={inputClass('flex-1 min-w-0')}
        value={parts.period}
        onChange={(e) => update({ period: e.target.value })}
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
}
