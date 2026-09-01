// ═══════════════════════════════════════════════════════════════════════
// Dashboard config template.
//
// 1. Copy this file to config.local.js (same folder).
// 2. Build the "List Bookings" Power Automate flow — see
//    microsoft/powerautomate-setup.md, "List Bookings" section.
// 3. Copy its HTTP URL (the copy icon next to the trigger's HTTP URL
//    field, per that doc's Conventions — never read-and-retype) and
//    paste it below, in config.local.js, replacing the placeholder.
//
// config.local.js is gitignored — never paste the real URL into this
// file. This repo is public, and unlike the booking pages' Availability
// endpoints (aggregate counts only), this one returns every
// participant's name, email and cohort to anyone who has the URL.
// ═══════════════════════════════════════════════════════════════════════
window.DASHBOARD_CONFIG = {
  listBookingsUrl: 'PASTE_LIST_BOOKINGS_URL_HERE'
};
