Bookings dashboard — internal, local-only tool
================================================

What it is
----------
admin/dashboard.html is a calendar view of every booking slot (crowd
sessions S1-S9, individual EEG sessions I01-I32): how many people are
booked into each, and — click a slot — their names, emails and cohort.
For EEG participants it also shows their *other* linked session (crowd
<-> individual), since the Bookings sheet keeps both on one row.

This is not one of the deployed public sites (index.html, booking.html,
booking_eeg.html) — it's a local file you open yourself, never linked
from anywhere public. It reads live from a dedicated Power Automate
flow, "List Bookings" (see microsoft/powerautomate-setup.md, Part 6),
which returns every row of the Bookings table as JSON.

One-time setup
---------------
1. Build the "List Bookings" flow — full click-by-click steps are in
   microsoft/powerautomate-setup.md, Part 6.
2. Copy admin/config.example.js to admin/config.local.js (this file is
   gitignored — it never gets committed).
3. Paste the flow's HTTP URL into config.local.js, replacing the
   placeholder.

Using it
--------
Open admin/dashboard.html directly in a browser (double-click, or a
tool like VS Code Live Server if your browser is picky about local
file:// access). It loads live automatically on open, and "Refresh
from Power Automate" re-fetches any time after.

If the live load fails (a banner explains why — usually the URL is
wrong or the flow is turned off), download the Bookings workbook from
SharePoint as .xlsx and drag it onto the "Load a file manually" box,
or use its file picker, as a fallback. Both paths parse the same
fields the same way, so there's no difference in what you see.

Handle the List Bookings URL carefully
----------------------------------------
Unlike the public booking pages' Availability endpoints (which only
ever return aggregate counts), List Bookings returns every
participant's name, email and cohort to anyone who has the URL, no
sign-in required — same `sig=`-secured mechanism as every other flow
in this project, just a much bigger blast radius if it leaks. That's
why it lives in admin/config.local.js and not committed anywhere.

Notes
-----
- Slot capacity/schedule (S1-S9, I01-I32) is hardcoded in
  SLOTS_DEFINITION inside dashboard.html, copied from
  microsoft/powerautomate-setup.md, since List Bookings only reads the
  Bookings table, not Slots. If a booking references a slot ID not in
  that list, it still shows up (just without a capacity indicator)
  rather than being silently dropped — if the real schedule changes,
  update SLOTS_DEFINITION to match.
- "Show cancelled" reveals bookings with a Cancelled date set, struck
  through, instead of hiding them.
- FLAGGED_INDIVIDUAL_SLOTS (in dashboard.html, next to SLOTS_DEFINITION)
  lists individual EEG sessions to highlight in Dark Orange on the
  calendar and the Excel export. Those participants are also tagged
  "(EEGO)" wherever they show up in a crowd-session roster (detail
  panel, "Copy roster", and the Excel export). Edit that array to
  change which sessions are flagged.
- "Export to Excel" downloads the calendar view as a styled .xls.
- "Attendance workbook" downloads a separate .xlsx: one sheet per crowd
  session, "Attendance S1" to "Attendance S8" (S9 is left out), with every
  current signup for that session pre-filled a row at a time, EEG
  participants first. Only EEG participants get a Participant ID (001-032,
  from their individual slot, with I01/I03 swapped to 003/001) and a
  lanyard/hat number (1-4); the rest of each sheet is blank rows to fill
  in by arrival order on the day. A "Session Log" sheet has one row per
  session with the date, duration and planned N pre-filled (start/end
  time left blank to fill on the day) and its "Signed in" / "Questionnaire
  done" / "Consent done" / "Paid" cells as live formulas counting the
  matching columns on that session's attendance sheet. Cancelled bookings
  are always excluded, regardless of the "Show cancelled" toggle.
- Nothing here writes to the bookings workbook on SharePoint — the
  dashboard is read-only; both exports are generated locally in the
  browser from whatever is currently loaded.
