// Every reportable "card" this app has or will have, matching the backend's
// assignment forms enum (backend/models/central/User.js).
// `projectTypes` says which kind of project a form belongs to — an
// underground mine reports different things from an open-cast one.
// `implemented` gates whether it's a real, clickable form yet, or just a
// preview of what's coming next on the project's card picker.
const OPEN_CAST = ['mining', 'exploration'];
const UNDERGROUND = ['underground'];

export const ALL_FORMS = [
  { slug: 'shift-card', label: 'Shift Card', projectTypes: OPEN_CAST, implemented: true },
  { slug: 'production', label: 'Daily Production', projectTypes: OPEN_CAST, implemented: true },
  { slug: 'fuel', label: 'Daily Fuel Consumption', projectTypes: OPEN_CAST, implemented: true },
  { slug: 'breakdown', label: 'Fleet Breakdown', projectTypes: OPEN_CAST, implemented: false },
  { slug: 'trip-management', label: 'Trip Management', projectTypes: OPEN_CAST, implemented: false },
  { slug: 'utilization', label: 'Equipment Utilization', projectTypes: OPEN_CAST, implemented: true },
  { slug: 'site-monitoring', label: 'Daily Site Monitoring', projectTypes: OPEN_CAST, implemented: false },
  { slug: 'ug-production', label: 'Level Production', projectTypes: UNDERGROUND, implemented: true },
  { slug: 'ug-development', label: 'Development', projectTypes: UNDERGROUND, implemented: true },
];

export const formsForProjectType = (type) => ALL_FORMS.filter((f) => f.projectTypes.includes(type));

export const PROJECT_TYPES = [
  { value: 'mining', label: 'Open Cast' },
  { value: 'underground', label: 'Underground' },
  { value: 'exploration', label: 'Exploration' },
];
