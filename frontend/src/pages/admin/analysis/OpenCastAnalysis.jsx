import { StatTile } from '../../../components/charts';
import { SERIES_COLORS, SHIFT_COLORS, SHIFT_LABELS, buildStack, formatNumber } from '../../../utils/chartHelpers';
import { EmptyRange, RankCard, StackCard } from './shared';

const PRODUCTION_SERIES = ['hardOB', 'obRehandling', 'softOB'];
const PRODUCTION_LABELS = { hardOB: 'Hard OB', obRehandling: 'OB Rehandling', softOB: 'Soft OB' };
const PRODUCTION_COLORS = { hardOB: SERIES_COLORS[0], obRehandling: SERIES_COLORS[1], softOB: SERIES_COLORS[2] };

export default function OpenCastAnalysis({ data }) {
  const { kpis } = data;
  if (data.tripsByDayShift.length === 0 && data.productionByDay.length === 0 && data.fuelByDay.length === 0) {
    return <EmptyRange />;
  }

  const tripsStack = buildStack(data.tripsByDayShift, data.shifts, { colors: SHIFT_COLORS, labels: SHIFT_LABELS });
  const productionStack = buildStack(data.productionByDay, PRODUCTION_SERIES, {
    colors: PRODUCTION_COLORS,
    labels: PRODUCTION_LABELS,
  });
  const fuelStack = buildStack(data.fuelByDay, ['litres'], { labels: { litres: 'Fuel issued' } });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile label="Trips" value={formatNumber(kpis.trips)} note={`${kpis.workingDays} working days`} />
        <StatTile
          label="Total Cum"
          value={formatNumber(kpis.totalCum)}
          note={kpis.achievementPct != null ? `${formatNumber(kpis.achievementPct)}% of target` : 'Hard OB + OB Rehandling + Soft OB'}
        />
        <StatTile label="OB Rehandling" value={formatNumber(kpis.obRehandling)} />
        <StatTile label="Soft OB" value={formatNumber(kpis.softOB)} />
        <StatTile label="Hard OB" value={formatNumber(kpis.hardOB)} />
        <StatTile label="Fuel issued (L)" value={formatNumber(kpis.fuelIssued)} />
        <StatTile label="Litres per trip" value={formatNumber(kpis.litresPerTrip)} />
      </div>

      <StackCard title="Trips per day" subtitle="By shift." stack={tripsStack} unit="trips" />

      <StackCard
        title="Production per day"
        subtitle="Hard OB, plus OB Rehandling and Soft OB from Shift Card trips."
        stack={productionStack}
      />

      <RankCard
        title="Trips by vehicle"
        rows={data.byVehicle}
        dataKey="trips"
        label="Trips"
        unit="trips"
        nameLabel="Vehicle"
        extraColumns={[{ key: 'shifts', label: 'Shift entries' }]}
      />

      <RankCard
        title="Trips by driver"
        rows={data.byDriver}
        dataKey="trips"
        label="Trips"
        unit="trips"
        nameLabel="Driver"
        extraColumns={[{ key: 'shifts', label: 'Shift entries' }]}
      />

      <StackCard title="Fuel issued per day" stack={fuelStack} unit="L" />

      <RankCard
        title="Fuel issued by vehicle"
        rows={data.fuelByVehicle}
        dataKey="litres"
        label="Litres"
        unit="L"
        nameLabel="Vehicle"
      />
    </div>
  );
}
