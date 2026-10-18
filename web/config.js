// Build-time client configuration. The Android build (scripts/build-www.mjs) overwrites this with
// MAPOS_API_BASE. Empty apiBase = same origin (web served by the API server) or on-device mode (app).
window.__MAPOS_CONFIG__ = window.__MAPOS_CONFIG__ || { apiBase: '' };
