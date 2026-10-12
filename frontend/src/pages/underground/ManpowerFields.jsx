import NumberField from '../../components/NumberField';
import MultiPickOrAdd from '../../components/MultiPickOrAdd';
import { CREW } from '../../utils/crew';

const crewByCount = Object.fromEntries(CREW.map((c) => [c.countKey, c]));

// The gang for one entry: a head count per trade and, beside each count
// except the supervisor's, who those people were. `order` is the list of
// count keys, following the column order of the sheet the form replaces
// (it differs between production and development). Names are optional.
export default function ManpowerFields({ order, fields, setField, workers, onCreateWorker }) {
  // Naming more people than the count says raises the count to match; it
  // never lowers it, since not every name need be known.
  const setNames = (trade) => (ids) => {
    setField(trade.idsKey)(ids);
    if (ids.length > (Number(fields[trade.countKey]) || 0)) setField(trade.countKey)(String(ids.length));
  };

  return (
    <div className="space-y-3">
      <span className="block text-sm font-medium text-slate-700">Manpower</span>

      {order.map((countKey) => {
        const trade = crewByCount[countKey];

        if (!trade) {
          return (
            <div key={countKey} className="w-24">
              <NumberField label="Supervisor" inputMode="numeric" min="0" value={fields[countKey]} onChange={setField(countKey)} />
            </div>
          );
        }

        return (
          <div key={countKey} className="flex items-start gap-3">
            <div className="w-24 shrink-0">
              <NumberField label={trade.label} inputMode="numeric" min="0" value={fields[countKey]} onChange={setField(countKey)} />
            </div>
            <div className="min-w-0 flex-1">
              <MultiPickOrAdd
                label={`${trade.label} names`}
                options={workers}
                value={fields[trade.idsKey]}
                onChange={setNames(trade)}
                onCreate={onCreateWorker}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
