import { useId } from 'react';
import NumberField from '../../components/NumberField';
import { inputClass } from '../../components/Field';
import { CREW, MAX_CREW, fitNames } from '../../utils/crew';

const crewByCount = Object.fromEntries(CREW.map((c) => [c.countKey, c]));

// The gang for one entry: a head count per trade and, beside each count
// except the supervisor's, one name box per person counted. Typing 5
// drillers gives exactly 5 driller boxes. Names are optional; boxes suggest
// names already used on this project so the same person is spelled the
// same way. `order` follows the column order of the sheet the form
// replaces, which differs between production and development.
export default function ManpowerFields({ order, fields, setField, workers }) {
  const listId = useId();

  const setCount = (trade) => (value) => {
    setField(trade.countKey)(value);
    setField(trade.namesKey)(fitNames(fields[trade.namesKey], value));
  };

  const setName = (trade, index) => (e) => {
    const names = [...fields[trade.namesKey]];
    names[index] = e.target.value;
    setField(trade.namesKey)(names);
  };

  return (
    <div className="space-y-3">
      <span className="block text-sm font-medium text-slate-700">Manpower</span>

      <datalist id={listId}>
        {workers.map((w) => (
          <option key={w._id} value={w.name} />
        ))}
      </datalist>

      {order.map((countKey) => {
        const trade = crewByCount[countKey];

        if (!trade) {
          return (
            <div key={countKey} className="w-24">
              <NumberField label="Supervisor" inputMode="numeric" min="0" value={fields[countKey]} onChange={setField(countKey)} />
            </div>
          );
        }

        const names = fields[trade.namesKey];
        return (
          <div key={countKey} className="flex items-start gap-3">
            <div className="w-24 shrink-0">
              <NumberField
                label={trade.label}
                inputMode="numeric"
                min="0"
                max={MAX_CREW}
                value={fields[countKey]}
                onChange={setCount(trade)}
              />
            </div>
            <div className="min-w-0 flex-1">
              <span className="mb-1 block text-sm font-medium text-slate-700">{trade.label} names</span>
              {names.length === 0 ? (
                <p className="py-3 text-sm text-slate-400">Enter the count to add names.</p>
              ) : (
                <div className="space-y-2">
                  {names.map((name, i) => (
                    <input
                      // Boxes are positions (1st driller, 2nd…), so the index is the identity.
                      key={i}
                      aria-label={`${trade.label} ${i + 1} name`}
                      placeholder={`${trade.label} ${i + 1} name`}
                      list={listId}
                      autoComplete="off"
                      className={inputClass()}
                      value={name}
                      onChange={setName(trade, i)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
