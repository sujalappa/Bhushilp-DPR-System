import { inputClass } from './Field';

// Native <input type="time"> renders in whatever 12h/24h format the
// device's OS locale is set to, which isn't reliable across clerks'
// phones. This always shows hour/minute/AM-PM dropdowns, and still stores
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

function to24h(hour, minute, period) {
  if (hour === '' || minute === '') return '';
  let h = Number(hour) % 12;
  if (period === 'PM') h += 12;
  return `${String(h).padStart(2, '0')}:${minute}`;
}

export default function TimePicker12h({ value, onChange }) {
  const { hour, minute, period } = to12h(value);

  const update = (patch) => {
    const next = { hour, minute, period, ...patch };
    onChange(to24h(next.hour, next.minute, next.period));
  };

  return (
    <div className="flex gap-2">
      <select
        className={inputClass('flex-1 min-w-0')}
        value={hour}
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
        className={inputClass('flex-1 min-w-0')}
        value={minute}
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
        className={inputClass('flex-1 min-w-0')}
        value={period}
        onChange={(e) => update({ period: e.target.value })}
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
}
