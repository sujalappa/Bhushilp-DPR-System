import { useNavigate, useParams } from 'react-router-dom';
import AppShell from '../../components/AppShell';
import Button from '../../components/Button';
import DateShiftPicker from '../../components/DateShiftPicker';

// Step 1 of the drill-down: pick a date, pick a shift, and settle whether
// that shift ran at all (handled by the shared DateShiftPicker). Marking a
// shift non-working is scoped to exactly this (date, shift) pair — Shift I
// being rained out never affects Shift II.
export default function DateShiftPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  return (
    <AppShell title="Shift Card" backTo={`/projects/${projectId}`}>
      <DateShiftPicker projectId={projectId}>
        {(date, shift) => (
          <Button
            className="w-full"
            onClick={() => navigate(`/projects/${projectId}/shift-card/${date}/${shift}`)}
          >
            View vehicles for this shift
          </Button>
        )}
      </DateShiftPicker>
    </AppShell>
  );
}
