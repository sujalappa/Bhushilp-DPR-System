import { ChartCard, StatTile, TrendLine } from '../../../components/charts';
import { SHIFT_LABELS, buildStack, formatDayLong, formatNumber } from '../../../utils/chartHelpers';
import { EmptyRange, RankCard, StackCard } from './shared';

export default function UndergroundAnalysis({ data }) {
  const { kpis } = data;
  if (data.daily.length === 0 && data.byHeading.length === 0) return <EmptyRange />;

  const tonsStack = buildStack(data.tonsByDayLevel, data.levels);
  const progressStack = buildStack(data.progressByDayHeading, data.headings);
  const byShift = data.byShift.map((s) => ({ ...s, name: SHIFT_LABELS[s.shift] }));
  // OMS is blank on a day with no tons; the line leaves a gap there.
  const dailyTable = (key, label) => ({
    columns: [
      { key: 'date', label: 'Date', align: 'left', format: formatDayLong },
      { key, label },
    ],
    rows: data.daily,
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile label="Tons" value={formatNumber(kpis.tons)} note={`${kpis.productionDays} production days`} />
        <StatTile label="Volume (m³)" value={formatNumber(kpis.cubicMetres)} />
        <StatTile label="Tubs" value={formatNumber(kpis.tubs)} />
        <StatTile label="Manpower (man-shifts)" value={formatNumber(kpis.manpower)} />
        <StatTile label="OMS" value={formatNumber(kpis.oms)} note="(Supervisor + Mucker + Blaster) ÷ Tons" />
        <StatTile label="Development (m)" value={formatNumber(kpis.progress)} />
      </div>

      <StackCard title="Tons per day" subtitle="By level." stack={tonsStack} unit="t" />

      <RankCard
        title="Tons by level"
        rows={data.byLevel}
        dataKey="tons"
        label="Tons"
        unit="t"
        nameLabel="Level"
        extraColumns={[
          { key: 'tubs', label: 'Tubs' },
          { key: 'cubicMetres', label: 'm³' },
        ]}
      />

      <RankCard
        title="Tons by shift"
        rows={byShift}
        dataKey="tons"
        label="Tons"
        unit="t"
        nameLabel="Shift"
        extraColumns={[{ key: 'tubs', label: 'Tubs' }]}
      />

      <RankCard
        title="Tons by supervisor"
        rows={data.bySupervisor}
        dataKey="tons"
        label="Tons"
        unit="t"
        nameLabel="Supervisor"
        extraColumns={[
          { key: 'shifts', label: 'Shifts' },
          { key: 'tonsPerShift', label: 'Tons per shift' },
        ]}
      />

      {data.daily.length > 0 && (
        <>
          <ChartCard title="Manpower per day" subtitle="Man-shifts across all levels." table={dailyTable('manpower', 'Manpower')}>
            <TrendLine data={data.daily} dataKey="manpower" label="Manpower" />
          </ChartCard>

          <ChartCard title="OMS per day" subtitle="(Supervisor + Mucker + Blaster) ÷ Tons." table={dailyTable('oms', 'OMS')}>
            <TrendLine data={data.daily} dataKey="oms" label="OMS" />
          </ChartCard>
        </>
      )}

      <StackCard title="Development progress per day" subtitle="Metres driven, by heading." stack={progressStack} unit="m" />

      <RankCard
        title="Development by heading"
        subtitle="Metres driven in this date range."
        rows={data.byHeading}
        dataKey="progress"
        label="Metres"
        unit="m"
        nameLabel="Heading"
        extraColumns={[
          { key: 'tons', label: 'Tons' },
          { key: 'filling', label: 'Filling' },
        ]}
      />
    </div>
  );
}
