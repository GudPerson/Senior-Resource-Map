// Both this build flag and the independent Worker gate must be enabled to launch.
export const GOVERNED_PILOT_UI_ENABLED = import.meta.env?.VITE_GOVERNED_PILOT_ENABLED === 'true';
