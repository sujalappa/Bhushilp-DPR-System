// Every reportable "card" this app will eventually have, matching the
// backend's assignment forms enum (backend/models/central/User.js).
// `implemented` gates whether it's a real, clickable form yet, or just a
// preview of what's coming next on the project's card picker.
export const ALL_FORMS = [
  { slug: 'shift-card', label: 'Shift Card', implemented: true },
  { slug: 'production', label: 'Daily Production', implemented: true },
  { slug: 'fuel', label: 'Daily Fuel Consumption', implemented: true },
  { slug: 'breakdown', label: 'Fleet Breakdown', implemented: false },
  { slug: 'trip-management', label: 'Trip Management', implemented: false },
  { slug: 'utilization', label: 'Equipment Utilization', implemented: false },
  { slug: 'site-monitoring', label: 'Daily Site Monitoring', implemented: false },
];
