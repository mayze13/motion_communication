# Minds in Motion — Power Automate & Hosting Setup

## Overview

Three pages, three data destinations, seven flows:

| Page | Purpose | Writes to | Flows |
| --- | --- | --- | --- |
| `index.html` | Register interest (live, public, Netlify site 1) | `Signups` table | Signup Receiver, Export New Signups, Mark Batch as Mailed |
| `booking.html` | Book a crowd session, 1 visit, £30 (Netlify site 2) | `Bookings` table | Booking Availability, Booking Confirm |
| `booking_eeg.html` | Book EEG sessions, 2 visits, £60, 32 places only (Netlify site 3) | `Bookings` table | EEG Availability, EEG Confirm |

Two workbooks, both on SharePoint, same document library:

- **`minds_in_motion_signups.xlsx`** — one table, `Signups`.
- **`minds_in_motion_bookings.xlsx`** — two tables, `Slots` and `Bookings`, shared by both booking pages.

`apps-script/Code.gs` and the Google Sheets approach it describes are legacy and not wired to anything live — ignore them.

---

## Conventions

Read this once — every flow below relies on all of it and won't re-explain it.

- **Trigger:** every HTTP-triggered flow needs **Method: POST** and **Who can trigger the flow? → Anyone**. The default, "Any user in my tenant," demands a UCL sign-in token, which public pages don't have — every request would 401. The long `sig=` parameter already in the URL is what authorises the call instead.
- **Copying the URL:** always use the **copy icon** next to the HTTP URL field, never read-and-retype — it's truncated on screen and the hidden part carries the signature. It only appears after the first save. Older Power Automate labels this box "HTTP POST URL"; same thing, only ever one URL per trigger.
- **Rename every action you'll reference by name.** Power Automate stores a display name's spaces as underscores internally (`Filter array` → `Filter_array`), which is the single most common cause of "invalid reference" errors. Rename on creation (**⋯** → **Rename**) to something with no spaces and skip the guesswork entirely.
- **Filter array, always in advanced mode.** Click **Edit in advanced mode** under the condition boxes rather than using them — basic mode only offers column names when the array still carries a schema, which stops being true after the array has already passed through one Filter array once, and typing a column name into the boxes by hand compares it as a literal string and silently matches nothing.
- **`item()` inside a Filter array means the row being filtered — never a row from an enclosing loop.** To compare against "the slot the outer loop is currently on," capture it first with a **Compose** action (e.g. `CurrentSlotId` → `item()?['Slot ID']`), then reference `outputs('CurrentSlotId')` inside the Filter array. This is also why `outputs('ComposeName')` is used instead of `items('Apply_to_each')`: the latter depends on the loop's exact internal name, which breaks the moment the loop is renamed or duplicated.
- **Blank Excel cells:** use `@empty(item()?['ColumnName'])`, never `equals(..., '')`. An untouched cell can come back as an empty string or as null depending on the row, and only `empty()` catches both. The Excel connector's own Filter Query field doesn't reliably match blanks either, which is why blank-detection always happens via a Filter array instead.
- **Type expressions, don't paste them.** Pasted text — especially copied out of a rendered document — can carry invisible characters or smart quotes that Power Automate rejects as an invalid expression with no useful error location.
- **String literals inside expressions need quotes.** `'Crowd'` is a valid expression; bare `Crowd` is not, and the flow refuses to save with "contains invalid expression(s)." If a field should be genuinely empty (e.g. `Cancelled`), leave it completely untouched — opening its Expression tab and clicking OK with nothing typed saves an empty expression, which throws the same error.
- **`item()` is only valid where there's a real per-item context.** That's a genuine Apply-to-each loop, or a **Select** action's own Map (Select is specifically designed for this — switch its Map to key/value mode, key = the target field name typed literally, value = an expression like `item()?['Email']`). It is **not** valid in **Create CSV table**'s Custom column values — that action isn't a loop, and using `item()` there fails at save with an "InvalidTemplate" error. If you need to shape data before a CSV, run it through **Select** first and leave Create CSV table's Columns on **Automatic**.
- **Compose before Response or Send-an-email, for any computed value.** Typing a raw function expression directly into a rich-text field (an email Body, a Response Body's JSON editor) can get silently mangled as you type or as the surrounding text is edited. Compute it first in a plain **Compose** action, then insert that Compose's **Outputs** into the rich-text field via the ordinary dynamic-content picker — never by typing an expression into the rich-text field itself.
- **Concurrency Control must stay off on any flow that has a Response action.** Power Automate's Response actions require a still-open connection back to the caller; Concurrency Control works by queuing runs, and a queued run can't answer anyone. Turning it on refuses to save with `InvalidConcurrencyConfiguration`. **It also cannot be switched off again once set** — the flow must be rebuilt, or exported → the concurrency block manually stripped from the JSON → re-imported. This trades away protection against two people booking the very last seat in the same instant; see each Confirm flow's write step for why that's an acceptable trade here, and the airtight alternative if you ever want to close it.
- **`.ics` calendar attachments** need real CRLF line endings, which can't be typed into a Power Automate field directly. Build the template with `~` between lines, then wrap the whole thing in `replace(..., '~', decodeUriComponent('%0D%0A'))`. Avoid commas inside `SUMMARY`/`LOCATION`/`DESCRIPTION` (iCalendar treats them as separators and they'd need escaping as `\,`). Multiple `VEVENT` blocks in one file need **different `UID`s each**, or calendar apps treat the second as an edit to the first and only one event shows up.
- **Testing any HTTP-triggered flow directly:** the **Test** button only arms the flow to wait for a real request — open the flow, **Test → Manually → Test**, then send it one from a terminal:
  ```bash
  curl -sS -X POST '<HTTP URL>' -H 'Content-Type: application/json' -d '{"...":"..."}'
  ```
  `401` means the trigger is still set to "Any user in my tenant." A bare `202 Accepted` means the branch that ran has no Response action on it. A ~2-minute timeout means an action failed earlier and the Response was never reached — check **28 day run history** on the flow for exactly which one.

---

## Part 1 — Interest signups (`index.html`)

### Workbook — `minds_in_motion_signups.xlsx`, table `Signups`

| Server Timestamp | First Name | Last Name | Sex | Age | Email | Institution | Client Timestamp | Exported Date | Mailed Date |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

Create it: type the headers into Row 1, select the header row plus a few blank rows below, **Insert → Table**, tick "My table has headers," then right-click → **Table → Table Name** → `Signups`. `Exported Date`/`Mailed Date` are added in Part 2 — leave them out for now, blank always means "not done yet" once they exist.

### Flow — Signup Receiver

**Instant cloud flow** → trigger **When an HTTP request is received** → name **Minds in Motion Signup Receiver**.

1. Configure the trigger per Conventions. Request Body JSON Schema:
   ```json
   {
     "type": "object",
     "properties": {
       "firstName": {"type": "string"}, "lastName": {"type": "string"},
       "sex": {"type": "string"}, "age": {"type": "number"},
       "email": {"type": "string"}, "institution": {"type": "string"},
       "timestamp": {"type": "string"}
     }
   }
   ```
2. **Excel Online (Business) → List rows present in a table** — File `minds_in_motion_signups.xlsx`, Table `Signups`. Expand **Show advanced options**, and in **Filter Query** build it by typing and clicking (this field only works reliably when built this way, not pasted): type `Email eq '`, click **Add dynamic content** → under the trigger heading click **email** (inserts a blue chip), then type a closing `'`. Result: `Email eq '` *email chip* `'`.
3. **Condition** — left value: **Add dynamic content** → this action's **value** output; operator **is not empty**; right blank. True when that email already has a row.
4. **If yes → Response**: `409`, headers `Access-Control-Allow-Origin: *` and `Content-Type: application/json`, body `{"error":"email_duplicate"}`.
5. **If no → Add a row into a table** (same file/table). Map: Server Timestamp = expression `utcNow()`; First Name/Last Name/Sex/Age/Email/Institution/Client Timestamp = dynamic content `firstName`/`lastName`/`sex`/`age`/`email`/`institution`/`timestamp`.
6. Still inside **If no → Response**: `200`, same headers, body `{"result":"success"}`.
7. Save. Copy the trigger's HTTP URL.

### Connect and test

In `index.html`, set `const POWER_AUTOMATE_URL = '<the URL>';`. Submit the form once — a row should appear in Excel within seconds. Submit the same email again — you should see the duplicate message and no second row.

---

## Part 2 — Export & mail tracking

Once signups arrive, you'll periodically want everyone's un-exported email addresses to paste into Mailchimp/Gmail (body: `email/outreach-template.html`), and a way to know afterwards who's been exported and mailed. Two extra `Signups` columns plus two manually-triggered flows do this; **the mass send itself stays external** — these flows only compile the list and stamp the columns.

### Workbook

Add columns **`Exported Date`** and **`Mailed Date`** to `Signups` (type the header into the cell right after the last column; the table auto-extends). Leave blank for all rows, including new signups.

### Flow — Export New Signups

**Instant cloud flow**, trigger **Manually trigger a flow**.

1. **List rows present in a table** → `Signups`, no filter (list everything; blank-detection happens next, per Conventions).
2. **Filter array**, renamed `FilterUnexported` — from the List-rows `value`, advanced mode: `@empty(item()?['Exported Date'])`.
3. **Condition** — `length(body('FilterUnexported'))` **is greater than** `0`. Nothing new → flow ends, safe to run any time.
4. Inside **If yes**, four actions as siblings, then a loop:
   - **Compose**, renamed `NewSignupCount` → expression `length(body('FilterUnexported'))`. (Per Conventions: computed here, not typed into the email body directly.)
   - **Select**, renamed `SelectEmailFields` — From: `FilterUnexported`'s output. Switch Map to key/value mode: Key `Email` → Value expression `item()?['Email']`; Key `First Name` → Value expression `item()?['First Name']`.
   - **Create CSV table** — From: `SelectEmailFields`'s output, Columns: **Automatic** (per Conventions — Select already narrowed the columns, so Automatic now produces exactly Email + First Name).
   - **Send an email (V2)** to yourself. Subject e.g. `Minds in Motion — new signups to export`. Body: insert `NewSignupCount`'s **Outputs** via the dynamic-content picker for the count. **Attachment Name:** literal plain text `new-signups.csv` (typing a token here instead is why extensions come out wrong). **Attachment Content:** `Create CSV table`'s **Output** specifically.
   - **Apply to each** — input: `FilterUnexported`'s **Body**. Inside: **Update a row** (`Signups`) — Key Column `Email` (plain text; safe since the receiver flow guarantees uniqueness), Key Value: dynamic content **Email** if offered, else expression `item()?['Email']`; **Exported Date** = expression `utcNow()`.
   - On the **Apply to each** step, **⋯ → Configure run after** → tick **is successful** on the Send-email step only. Rows are only stamped exported if the email actually went out — if it fails, nothing is marked and a re-run picks the same rows up again.
5. Save.

### Flow — Mark Batch as Mailed

Run once you've actually sent the campaign externally using the exported list.

1. **List rows present in a table** → `Signups`, no filter.
2. **Filter array**, renamed `FilterUnmailed` — advanced mode: `@and(not(empty(item()?['Exported Date'])), empty(item()?['Mailed Date']))`.
3. **Apply to each** → `FilterUnmailed`'s Body → **Update a row**: Key Column `Email`, Key Value as above; **Mailed Date** = expression `utcNow()`.
4. Optional: **Send an email (V2)** to yourself confirming the count.
5. Save.

Only ever touches exported-but-not-mailed rows, so it's safe to re-run or skip a cycle.

### The cycle

Run **Export New Signups** → paste the CSV's addresses into Mailchimp/Gmail using `email/outreach-template.html` → send → run **Mark Batch as Mailed**. Repeat as new signups trickle in.

---

## Part 3 — Crowd booking (`booking.html`)

One visit, up to 2 hours, £30, no equipment. The page walks: study info → 8-question eligibility gate (client-side only, nothing sent until it passes) → slot picker → BFI-2 + demographics questionnaire → confirm.

### Workbook — `minds_in_motion_bookings.xlsx`

**`Slots`** — every column that exists on this table, including the ones only the EEG funnel (Part 4) uses:

| Slot ID | Session Type | Date | Time | Label | Capacity | Cohort | EEG Per Cohort | Start UTC | End UTC |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| S1 | Crowd | 2026-09-15 | 10:00 | Tue 15 Sept, 10:00 | 40 | | 2 | 20260915T090000Z | 20260915T110000Z |
| S2 | Crowd | 2026-09-15 | 14:00 | Tue 15 Sept, 14:00 | 40 | | 2 | 20260915T130000Z | 20260915T150000Z |
| S3 | Crowd | 2026-09-15 | 16:00 | Tue 15 Sept, 16:00 | 40 | | 2 | 20260915T150000Z | 20260915T170000Z |
| S4 | Crowd | 2026-09-16 | 10:00 | Wed 16 Sept, 10:00 | 40 | | 2 | 20260916T090000Z | 20260916T110000Z |
| S5 | Crowd | 2026-09-16 | 14:00 | Wed 16 Sept, 14:00 | 40 | | 2 | 20260916T130000Z | 20260916T150000Z |
| S6 | Crowd | 2026-09-16 | 16:00 | Wed 16 Sept, 16:00 | 40 | | 2 | 20260916T150000Z | 20260916T170000Z |
| S7 | Crowd | 2026-09-17 | 10:00 | Thu 17 Sept, 10:00 | 40 | | 2 | 20260917T090000Z | 20260917T110000Z |
| S8 | Crowd | 2026-09-17 | 14:00 | Thu 17 Sept, 14:00 | 40 | | 2 | 20260917T130000Z | 20260917T150000Z |
| S9 | Crowd | 2026-09-17 | 16:00 | Thu 17 Sept, 16:00 | 40 | | 0 | 20260917T150000Z | 20260917T170000Z |

- **`Label`** is exactly what the page shows, split on the comma to group by day — keep the `Day DD Mon, HH:MM` format.
- **`Capacity` 40 against a real target of ~30** absorbs no-shows. Change it any time by editing the cell; no flow or code change needed.
- **`Cohort`/`EEG Per Cohort`** — blank/`2` (`0` for S9) here; only meaningful once Part 4 is built. `EEG Per Cohort` is *per cohort*: `2` = 2 C1 places **and** 2 C2 places on that session.
- **`Start UTC`/`End UTC`** — `YYYYMMDDTHHMMSSZ`, used only for the confirmation-email `.ics`. September is British Summer Time, one hour ahead of UTC — 10:00 London is `T090000Z`. Stored as data rather than computed in-flow, since timezone arithmetic in expressions is fiddly and fails silently; these were generated from the rules and checked, not typed by hand.

**`Bookings`** — one row per confirmed booking, never partial:

| Booking ID | Server Timestamp | Session Type | Slot ID | Slot Label | First Name | Last Name | Email | Client Timestamp | Questionnaire Version | Answers JSON | Registered Interest | Cancelled | Cohort | Individual Slot ID | Individual Slot Label |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

Leave every row blank; the flows fill them in. Notes:
- **`Session Type`** is the track: `Crowd` or `EEG`. **`Slot ID`/`Slot Label` always mean the crowd session**, for both tracks — that's what lets the crowd Availability flow work unchanged once EEG exists.
- **`Answers JSON`** — the whole questionnaire as one JSON string. Deliberately opaque: changing the questions is then a one-line edit in the page's `QUESTIONS` array, never a schema or flow change.
- **`Questionnaire Version`** — which question set that row answered; see Reference below.
- **`Registered Interest`** — `Yes`/`No`, whether the email also exists in `Signups`. Never blocks anyone; just a flag.
- **`Cancelled`** — blank = active. To free a place, type a date here; never delete the row, or you lose the answers.
- **`Cohort`/`Individual Slot ID`/`Individual Slot Label`** — EEG-only (Part 4). Crowd bookings get `Cohort = 'C30'` and leave the other two blank.

### Flow — Booking Availability

Read-only, safe to call from the public page — returns only aggregate counts. Trigger per Conventions, schema `{"type":"object","properties":{"email":{"type":"string"}}}`.

1. **List rows** → `Slots`, renamed `ListSlots`. **List rows** → `Bookings`, renamed `ListBookings`.
2. **Filter array** `FilterCrowdSlots` — `@equals(item()?['Session Type'], 'Crowd')`.
3. **Filter array** `FilterActiveBookings` — `@empty(item()?['Cancelled'])`.
4. **Initialize variable** `SlotAvailability` (Array, `[]`) — top level, before any loop.
5. **Apply to each** over `FilterCrowdSlots`:
   1. **Compose** `CurrentSlotId` → `item()?['Slot ID']`.
   2. **Filter array** `FilterBySlot` — from `FilterActiveBookings`: `@equals(item()?['Slot ID'], outputs('CurrentSlotId'))`.
   3. **Compose** `SlotObject` (JSON editor): `slotId`/`label` = `item()?['Slot ID']`/`item()?['Label']`; `capacity` = `int(item()?['Capacity'])`; `booked` = `length(body('FilterBySlot'))`; `full` = `greaterOrEquals(length(body('FilterBySlot')), int(item()?['Capacity']))`.
   4. **Append to array variable** `SlotAvailability` ← `SlotObject` output.
6. **Filter array** `FilterEmailMatch` — from `FilterActiveBookings`: `@equals(toLower(coalesce(item()?['Email'], '')), toLower(coalesce(triggerBody()?['email'], '_none_')))`. (`coalesce(..., '_none_')` covers first page-load, when `email` is empty — without it `toLower(null)` throws and the grid never loads.)
7. **Compose** `AvailabilityResponseBody`: `result` = `success`; `slots` = the `SlotAvailability` variable; `alreadyBooked` = `greater(length(body('FilterEmailMatch')), 0)`.
8. **Response** `200`, headers `Access-Control-Allow-Origin: *` + `Content-Type: application/json`, body = `AvailabilityResponseBody` output.

Leave Concurrency Control off (nothing to protect on a read).

### Flow — Booking Confirm

Trigger schema:
```json
{"type":"object","properties":{
  "slotId":{"type":"string"}, "firstName":{"type":"string"}, "lastName":{"type":"string"},
  "email":{"type":"string"}, "answers":{"type":"object"},
  "questionnaireVersion":{"type":"string"}, "timestamp":{"type":"string"}
}}
```
Leave Concurrency Control off (Conventions).

1. **List rows** → `Slots` (`ListSlots`), `Bookings` (`ListBookings`).
2. **Filter array** `FilterSlotMeta` — `@and(equals(item()?['Slot ID'], triggerBody()?['slotId']), equals(item()?['Session Type'], 'Crowd'))`.
3. **Filter array** `FilterActiveForSlot` — `@and(equals(item()?['Slot ID'], triggerBody()?['slotId']), empty(item()?['Cancelled']))`. Its length is the live headcount for that slot.
4. **Filter array** `FilterActiveForEmail` — `@and(equals(toLower(coalesce(item()?['Email'],'')), toLower(coalesce(triggerBody()?['email'],'_none_'))), empty(item()?['Cancelled']))`.
5. **Condition** `SlotInvalidOrFull` — `or(equals(length(body('FilterSlotMeta')), 0), greaterOrEquals(length(body('FilterActiveForSlot')), int(first(body('FilterSlotMeta'))?['Capacity'])))` equals `true`.
   - **Yes → Response** `409`, `{"error":"slot_full"}`.
   - **No →** nested **Condition** `EmailAlreadyBooked` — `length(body('FilterActiveForEmail'))` **is greater than** `0`.
     - **Yes → Response** `409`, `{"error":"booking_duplicate"}`.
     - **No →** the write branch:
       1. **List rows** → the `Signups` table in `minds_in_motion_signups.xlsx` (**ListSignups**), then **Filter array** `FilterSignupMatch` — `@equals(toLower(coalesce(item()?['Email'],'')), toLower(coalesce(triggerBody()?['email'],'_none_')))`.
       2. **Compose** `AnswersJsonString` → `string(triggerBody()?['answers'])`.
       3. **Add a row into a table** → `Bookings`, every value an expression (Conventions):

          | Column | Expression |
          | --- | --- |
          | Booking ID | `guid()` |
          | Server Timestamp | `utcNow()` |
          | Session Type | `'Crowd'` |
          | Cohort | `'C30'` |
          | Slot ID | `triggerBody()?['slotId']` |
          | Slot Label | `first(body('FilterSlotMeta'))?['Label']` |
          | First Name / Last Name / Email / Client Timestamp / Questionnaire Version | `triggerBody()?['firstName']` / `['lastName']` / `['email']` / `['timestamp']` / `['questionnaireVersion']` |
          | Answers JSON | `outputs('AnswersJsonString')` |
          | Registered Interest | `if(greater(length(body('FilterSignupMatch')), 0), 'Yes', 'No')` |
          | Cancelled, Individual Slot ID, Individual Slot Label | leave completely untouched |
       4. **Response** `200`: `result` (plain text) `success`; `slotId` = `triggerBody()?['slotId']`; `label` = `first(body('FilterSlotMeta'))?['Label']`.
6. Save.

**The race window this leaves open:** two people confirming the same slot's last seat within about a second of each other could both pass step 3's check before either has written a row. Given the slot is already overbooked to 40 against a real target of 30, an occasional 41st booking is inside the no-show margin already budgeted for — accepted rather than fixed, because fixing it (Concurrency Control) isn't available on a flow with Response actions (Conventions). If you want it airtight anyway: generate the Booking ID in a `Compose` (`NewBookingId` → `guid()`) instead of inline, write the row, then re-list `Bookings`, filter to rows for that slot with a smaller Booking ID (`less(item()?['Booking ID'], outputs('NewBookingId'))`), and if that count is already at capacity, `Delete a row` (yourself) and return `slot_full` instead of the success response — `booking.html` already handles `slot_full` at this stage, so no page change is needed.

### Confirmation email with a calendar invite

After the `200` Response, still inside the same innermost **If no**:

1. **Compose** `IcsText`:
   ```
   replace(concat('BEGIN:VCALENDAR~VERSION:2.0~PRODID:-//UCL//Minds in Motion//EN~CALSCALE:GREGORIAN~METHOD:PUBLISH~BEGIN:VEVENT~UID:', triggerBody()?['email'], '-', triggerBody()?['slotId'], '@ucl.ac.uk~DTSTAMP:', formatDateTime(utcNow(), 'yyyyMMddTHHmmss'), 'Z~DTSTART:', first(body('FilterSlotMeta'))?['Start UTC'], '~DTEND:', first(body('FilterSlotMeta'))?['End UTC'], '~SUMMARY:Minds in Motion - UCL PEARL~LOCATION:UCL PEARL Dagenham London~DESCRIPTION:Your session for the Minds in Motion study. Please arrive 10 minutes early.~END:VEVENT~END:VCALENDAR'), '~', decodeUriComponent('%0D%0A'))
   ```
2. **Send an email (V2)** — To: `triggerBody()?['email']`; Subject e.g. `Your Minds in Motion session is booked`; Body: session details using `first(body('FilterSlotMeta'))?['Label']`, travel info, `[PLACEHOLDER: study email address]`; **Attachment Name** plain text `minds-in-motion.ics`; **Attachment Content** `base64(outputs('IcsText'))`.

Placed after the Response so a mail problem never delays the participant's confirmation or the row being written — worst case, the email is missing and gets resent. Verify by booking a test slot and opening the `.ics` in both Google Calendar and Outlook — it must show **10:00–12:00 London** for S1, not 09:00 or 11:00.

### Connect and host

```js
const AVAILABILITY_URL = 'PASTE_YOUR_BOOKING_AVAILABILITY_URL_HERE';
const CONFIRM_URL      = 'PASTE_YOUR_BOOKING_CONFIRM_URL_HERE';
```
in `booking.html`. Hosting is a separate Netlify site — see Part 5. `booking.html` is deliberately not linked from `index.html`; the only way in is the link in `email/outreach-template.html`'s `[WEBSITE_URL]` placeholder.

### Test

1. Load the page — 9 slots, grouped by day, all "Available."
2. Book one through to confirmation. Check the `Bookings` row, and that reloading availability now shows that slot's count up by one.
3. Book again with the same email — stopped at the first step, before the questionnaire.
4. Temporarily set one slot's Capacity to `1`, fill it, then try to book it again — told it just filled, sent back to pick another time, **answers still intact**, no second row written. Restore Capacity to `40`.
5. Fill in half the questionnaire and refresh — answers restore.

---

## Part 4 — EEG booking (`booking_eeg.html`)

**32 places exactly.** Two visits: an individual session (90 min) and a crowd session (shared with Part 3's S1–S8), £60 paid after the second. 13-question eligibility gate (Part 3's set, minus general vision/hearing, plus contact-lenses-not-glasses, hair/scalp, no head covering, scalp condition, adhesive allergy).

**Cohorts**, by which period the *individual* session falls in:
- **C1** — individual 9–14 Sept, then the crowd session
- **C2** — crowd session first, then individual 18–23 Sept

**Why the numbers land on exactly 32:** 9–14 Sept has 4 working days (Wed 9, Thu 10, Fri 11, Mon 14); 18–23 Sept has 4 (Fri 18, Mon 21, Tue 22, Wed 23). 4 slots/day × 4 days × 2 periods = 32 individual places. On the crowd side, S1–S8 × 2 C1 + 2 C2 = 32. Both sides are 16 C1 + 16 C2, and every booking consumes exactly one place on each side, so they can't drift apart. **S9 takes no EEG participants** — that's what makes the crowd side land on exactly 32, expressed purely as `EEG Per Cohort = 0` on S9, never as flow logic.

### Workbook — 32 more `Slots` rows

`Session Type = Individual`, `Capacity = 1` for all. Already in `minds_in_motion_bookings.xlsx` — generated from the rules above and checked programmatically rather than typed by hand, since a single wrong `Start UTC` silently emails someone the wrong hour.

| Slot ID | Cohort | Date | Time | Label | Start UTC | End UTC |
| --- | --- | --- | --- | --- | --- | --- |
| I01 | C1 | 2026-09-09 | 09:30 | Wednesday 9 Sept, 09:30 | 20260909T083000Z | 20260909T100000Z |
| I02 | C1 | 2026-09-09 | 11:00 | Wednesday 9 Sept, 11:00 | 20260909T100000Z | 20260909T113000Z |
| I03 | C1 | 2026-09-09 | 13:30 | Wednesday 9 Sept, 13:30 | 20260909T123000Z | 20260909T140000Z |
| I04 | C1 | 2026-09-09 | 15:00 | Wednesday 9 Sept, 15:00 | 20260909T140000Z | 20260909T153000Z |
| I05 | C1 | 2026-09-10 | 09:30 | Thursday 10 Sept, 09:30 | 20260910T083000Z | 20260910T100000Z |
| I06 | C1 | 2026-09-10 | 11:00 | Thursday 10 Sept, 11:00 | 20260910T100000Z | 20260910T113000Z |
| I07 | C1 | 2026-09-10 | 13:30 | Thursday 10 Sept, 13:30 | 20260910T123000Z | 20260910T140000Z |
| I08 | C1 | 2026-09-10 | 15:00 | Thursday 10 Sept, 15:00 | 20260910T140000Z | 20260910T153000Z |
| I09 | C1 | 2026-09-11 | 09:30 | Friday 11 Sept, 09:30 | 20260911T083000Z | 20260911T100000Z |
| I10 | C1 | 2026-09-11 | 11:00 | Friday 11 Sept, 11:00 | 20260911T100000Z | 20260911T113000Z |
| I11 | C1 | 2026-09-11 | 13:30 | Friday 11 Sept, 13:30 | 20260911T123000Z | 20260911T140000Z |
| I12 | C1 | 2026-09-11 | 15:00 | Friday 11 Sept, 15:00 | 20260911T140000Z | 20260911T153000Z |
| I13 | C1 | 2026-09-14 | 09:30 | Monday 14 Sept, 09:30 | 20260914T083000Z | 20260914T100000Z |
| I14 | C1 | 2026-09-14 | 11:00 | Monday 14 Sept, 11:00 | 20260914T100000Z | 20260914T113000Z |
| I15 | C1 | 2026-09-14 | 13:30 | Monday 14 Sept, 13:30 | 20260914T123000Z | 20260914T140000Z |
| I16 | C1 | 2026-09-14 | 15:00 | Monday 14 Sept, 15:00 | 20260914T140000Z | 20260914T153000Z |
| I17 | C2 | 2026-09-18 | 09:30 | Friday 18 Sept, 09:30 | 20260918T083000Z | 20260918T100000Z |
| I18 | C2 | 2026-09-18 | 11:00 | Friday 18 Sept, 11:00 | 20260918T100000Z | 20260918T113000Z |
| I19 | C2 | 2026-09-18 | 13:30 | Friday 18 Sept, 13:30 | 20260918T123000Z | 20260918T140000Z |
| I20 | C2 | 2026-09-18 | 15:00 | Friday 18 Sept, 15:00 | 20260918T140000Z | 20260918T153000Z |
| I21 | C2 | 2026-09-21 | 09:30 | Monday 21 Sept, 09:30 | 20260921T083000Z | 20260921T100000Z |
| I22 | C2 | 2026-09-21 | 11:00 | Monday 21 Sept, 11:00 | 20260921T100000Z | 20260921T113000Z |
| I23 | C2 | 2026-09-21 | 13:30 | Monday 21 Sept, 13:30 | 20260921T123000Z | 20260921T140000Z |
| I24 | C2 | 2026-09-21 | 15:00 | Monday 21 Sept, 15:00 | 20260921T140000Z | 20260921T153000Z |
| I25 | C2 | 2026-09-22 | 09:30 | Tuesday 22 Sept, 09:30 | 20260922T083000Z | 20260922T100000Z |
| I26 | C2 | 2026-09-22 | 11:00 | Tuesday 22 Sept, 11:00 | 20260922T100000Z | 20260922T113000Z |
| I27 | C2 | 2026-09-22 | 13:30 | Tuesday 22 Sept, 13:30 | 20260922T123000Z | 20260922T140000Z |
| I28 | C2 | 2026-09-22 | 15:00 | Tuesday 22 Sept, 15:00 | 20260922T140000Z | 20260922T153000Z |
| I29 | C2 | 2026-09-23 | 09:30 | Wednesday 23 Sept, 09:30 | 20260923T083000Z | 20260923T100000Z |
| I30 | C2 | 2026-09-23 | 11:00 | Wednesday 23 Sept, 11:00 | 20260923T100000Z | 20260923T113000Z |
| I31 | C2 | 2026-09-23 | 13:30 | Wednesday 23 Sept, 13:30 | 20260923T123000Z | 20260923T140000Z |
| I32 | C2 | 2026-09-23 | 15:00 | Wednesday 23 Sept, 15:00 | 20260923T140000Z | 20260923T153000Z |

Crowd `Slots` rows and every `Bookings` column already exist from Part 3 — nothing more to add there. EEG bookings get `Session Type = 'EEG'`, a real `Cohort` (`C1`/`C2`), and both `Individual Slot ID`/`Individual Slot Label` filled in.

### Booking Availability / Booking Confirm (Part 3) — unaffected

Booking Availability already filters `Slots` to `Session Type = Crowd` and counts every non-cancelled booking against each Slot ID — EEG bookings carry the crowd `Slot ID` too, so they're already counted, correctly coming *out of* the 40 rather than adding to it. Booking Confirm needs nothing extra either; `Cohort = 'C30'` was already folded into Part 3's mapping table above.

### Flow — EEG Availability

Same shape as Booking Availability, trigger per Conventions, same schema.

1. **List rows** → `Slots` (`ListSlots`), `Bookings` (`ListBookings`).
2. **Filter array** `FilterActive` — `@empty(item()?['Cancelled'])`.
3. **Filter array** `FilterIndSlots` — `@equals(item()?['Session Type'], 'Individual')`.
4. **Filter array** `FilterEEGCrowdSlots` — `@and(equals(item()?['Session Type'], 'Crowd'), greater(int(item()?['EEG Per Cohort']), 0))` (this is what leaves S9 out, without naming it).
5. **Initialize variable** `IndAvail` and `CrowdAvail` (both Array, `[]`), top level.
6. **Apply to each** over `FilterIndSlots`:
   1. **Compose** `CurId` → `item()?['Slot ID']`.
   2. **Filter array** `TakenInd` — from `FilterActive`: `@and(equals(item()?['Individual Slot ID'], outputs('CurId')), empty(item()?['Cancelled']))`.
   3. **Compose** `IndObj` — `slotId`/`cohort`/`label` from `item()?[...]`; `full` = `greaterOrEquals(length(body('TakenInd')), 1)`.
   4. **Append to array variable** `IndAvail` ← `IndObj`.
7. **Apply to each** over `FilterEEGCrowdSlots`:
   1. **Compose** `CurCrowdId` → `item()?['Slot ID']`.
   2. **Filter array** `AllInSlot` — `@and(equals(item()?['Slot ID'], outputs('CurCrowdId')), empty(item()?['Cancelled']))`.
   3. **Filter array** `EEGC1` — `@and(equals(item()?['Slot ID'], outputs('CurCrowdId')), equals(item()?['Session Type'],'EEG'), equals(item()?['Cohort'],'C1'), empty(item()?['Cancelled']))`. **Filter array** `EEGC2` — same with `'C2'`.
   4. **Compose** `CrowdObj` — `slotId`/`label` from `item()?[...]`; `capacity` = `int(item()?['Capacity'])`; `booked` = `length(body('AllInSlot'))`; `eegC1`/`eegC2` = `length(body('EEGC1'))`/`length(body('EEGC2'))`; `eegPerCohort` = `int(item()?['EEG Per Cohort'])`.
   5. **Append to array variable** `CrowdAvail` ← `CrowdObj`.
8. **Filter array** `EmailMatch` — from `FilterActive`: `@equals(toLower(coalesce(item()?['Email'], '')), toLower(coalesce(triggerBody()?['email'], '_none_')))`.
9. **Compose** `EEGResponseBody` — `result` = `success`; `individual` = `IndAvail`; `crowd` = `CrowdAvail`; `alreadyBooked` = `greater(length(body('EmailMatch')), 0)`.
10. **Response** `200`, usual headers, body = `EEGResponseBody`.

### Flow — EEG Confirm

Schema adds `individualSlotId`:
```json
{"type":"object","properties":{
  "slotId":{"type":"string"}, "individualSlotId":{"type":"string"},
  "firstName":{"type":"string"}, "lastName":{"type":"string"}, "email":{"type":"string"},
  "answers":{"type":"object"}, "questionnaireVersion":{"type":"string"}, "timestamp":{"type":"string"}
}}
```
Leave Concurrency Control off.

1. **List rows** → `Slots` (`ListSlots`), `Bookings` (`ListBookings`).
2. **Filter array** `IndMeta` — `@and(equals(item()?['Slot ID'], triggerBody()?['individualSlotId']), equals(item()?['Session Type'],'Individual'))`.
3. **Filter array** `CrowdMeta` — `@and(equals(item()?['Slot ID'], triggerBody()?['slotId']), equals(item()?['Session Type'],'Crowd'))`.
4. **Compose** `Cohort` → `first(body('IndMeta'))?['Cohort']`. Never sent by the browser — derived from whichever individual session they took, so it can't be tampered with.
5. **Filter array** `IndTaken` — `@and(equals(item()?['Individual Slot ID'], triggerBody()?['individualSlotId']), empty(item()?['Cancelled']))`.
6. **Filter array** `CrowdAll` — `@and(equals(item()?['Slot ID'], triggerBody()?['slotId']), empty(item()?['Cancelled']))`.
7. **Filter array** `CrowdCohort` — `@and(equals(item()?['Slot ID'], triggerBody()?['slotId']), equals(item()?['Session Type'],'EEG'), equals(item()?['Cohort'], outputs('Cohort')), empty(item()?['Cancelled']))`.
8. **Filter array** `EmailTaken` — `@and(equals(toLower(coalesce(item()?['Email'],'')), toLower(coalesce(triggerBody()?['email'],'_none_'))), empty(item()?['Cancelled']))`.
9. **List rows** → the `Signups` table in `minds_in_motion_signups.xlsx` (**ListSignups**), then **Filter array** `FilterSignupMatch` — `@equals(toLower(coalesce(item()?['Email'],'')), toLower(coalesce(triggerBody()?['email'],'_none_')))`. (Same purpose as in Booking Confirm — flags `Registered Interest`, blocks nobody.)

Four checks, each its own **Condition** returning `409` with a distinct body, nested in order (each "No" branch contains the next):

| Condition (left value **is equal to** `true`) | Response body |
| --- | --- |
| `or(equals(length(body('IndMeta')),0), greaterOrEquals(length(body('IndTaken')),1))` | `{"error":"individual_taken"}` |
| `or(equals(length(body('CrowdMeta')),0), greaterOrEquals(length(body('CrowdAll')), int(first(body('CrowdMeta'))?['Capacity'])))` | `{"error":"slot_full"}` |
| `greaterOrEquals(length(body('CrowdCohort')), int(first(body('CrowdMeta'))?['EEG Per Cohort']))` | `{"error":"cohort_full"}` |
| `greater(length(body('EmailTaken')),0)` | `{"error":"booking_duplicate"}` |

In the innermost "all clear" branch: **Compose** `AnswersJsonString` → `string(triggerBody()?['answers'])`, then **Add a row into a table** → `Bookings`:

| Column | Expression |
| --- | --- |
| Booking ID | `guid()` |
| Server Timestamp | `utcNow()` |
| Session Type | `'EEG'` |
| Cohort | `outputs('Cohort')` |
| Slot ID | `triggerBody()?['slotId']` |
| Slot Label | `first(body('CrowdMeta'))?['Label']` |
| Individual Slot ID | `triggerBody()?['individualSlotId']` |
| Individual Slot Label | `first(body('IndMeta'))?['Label']` |
| First Name / Last Name / Email / Client Timestamp / Questionnaire Version | `triggerBody()?['firstName']` / `['lastName']` / `['email']` / `['timestamp']` / `['questionnaireVersion']` |
| Answers JSON | `outputs('AnswersJsonString')` |
| Registered Interest | `if(greater(length(body('FilterSignupMatch')), 0), 'Yes', 'No')` |
| Cancelled | leave completely untouched |

Then **Response** `200`: `result` (plain text) `success`; `slotId` = `triggerBody()?['slotId']`; `label` = `first(body('CrowdMeta'))?['Label']`; `individualLabel` = `first(body('IndMeta'))?['Label']`; `cohort` = `outputs('Cohort')`.

### Confirmation email — one file, two events

After the Response: **Compose** `IcsText` with two `VEVENT` blocks, **different UIDs** (`-ind` / `-grp`, per Conventions):

```
replace(concat('BEGIN:VCALENDAR~VERSION:2.0~PRODID:-//UCL//Minds in Motion//EN~CALSCALE:GREGORIAN~METHOD:PUBLISH~BEGIN:VEVENT~UID:', triggerBody()?['email'], '-ind@ucl.ac.uk~DTSTAMP:', formatDateTime(utcNow(),'yyyyMMddTHHmmss'), 'Z~DTSTART:', first(body('IndMeta'))?['Start UTC'], '~DTEND:', first(body('IndMeta'))?['End UTC'], '~SUMMARY:Minds in Motion - individual session~LOCATION:UCL PEARL Dagenham London~END:VEVENT~BEGIN:VEVENT~UID:', triggerBody()?['email'], '-grp@ucl.ac.uk~DTSTAMP:', formatDateTime(utcNow(),'yyyyMMddTHHmmss'), 'Z~DTSTART:', first(body('CrowdMeta'))?['Start UTC'], '~DTEND:', first(body('CrowdMeta'))?['End UTC'], '~SUMMARY:Minds in Motion - group session~LOCATION:UCL PEARL Dagenham London~END:VEVENT~END:VCALENDAR'), '~', decodeUriComponent('%0D%0A'))
```

**Send an email (V2)** as in Part 3, Attachment Content `base64(outputs('IcsText'))`.

### Connect and host

```js
const AVAILABILITY_URL = 'PASTE_YOUR_EEG_AVAILABILITY_URL_HERE';
const CONFIRM_URL      = 'PASTE_YOUR_EEG_CONFIRM_URL_HERE';
```
in `booking_eeg.html`, plus fill `[PLACEHOLDER: study email address]` and `[PLACEHOLDER: crowd booking URL]` (the note pointing ineligible people at the crowd-only page). Host as a third Netlify site — Part 5. Put the address into `email/outreach-template.html`'s `[EEG_WEBSITE_URL]` placeholder.

### Test

1. Call EEG Availability with `{"email":""}` — 32 entries under `individual` (16 C1, 16 C2), 8 under `crowd` (**S9 must not appear**).
2. Book one place end to end. Check the `Bookings` row: `Session Type = EEG`, correct `Cohort`, both slot IDs and labels filled.
3. Re-check availability — that individual slot is `full:true`, its crowd session's `eegC1`/`eegC2` is up by one.
4. Fill one crowd session's two C1 places, try a third C1 — greyed out on the page, `cohort_full` if called directly. A C2 participant can still book it.
5. Open the `.ics` — two events, correct London times.
6. Book with an email that already has a booking of either kind — `booking_duplicate`.

---

## Part 5 — Hosting

`index.html` is already live on Netlify site 1, deployed straight from this repo, and **must not change** — no build command, publish directory root. `booking.html` and `booking_eeg.html` each get their **own** Netlify site pointed at the same GitHub repo, using a build command to stage that one file as the site's root. No files are added to the repo; nothing is duplicated.

For each of the two booking pages:

1. Netlify → **Add new site → Import an existing project** → GitHub → the same repo.
2. **Branch:** `main`. **Base directory:** empty. **Publish directory:** `dist`. **Build command:**
   ```
   mkdir -p dist && cp <file>.html dist/index.html && cp -r assets dist/assets && printf 'User-agent: *\nDisallow: /\n' > dist/robots.txt
   ```
   — `<file>` is `booking` or `booking_eeg`. This stages that page as the homepage, brings its one referenced asset (the UCL logo), and writes a `robots.txt` disallowing crawling — belt and braces alongside the page's own `noindex` meta tag, since these pages are meant to be reached only via the emailed link.
3. Deploy, then **Site configuration → Site details → Change site name** to something readable but not guessable (avoid `minds-in-motion-booking`-type names if you want it to stay effectively unlisted).
4. Put the resulting `https://<name>.netlify.app/` address into the matching placeholder in `email/outreach-template.html` (`[WEBSITE_URL]` or `[EEG_WEBSITE_URL]`).
5. Confirm site 1 (the landing page) still loads unchanged and its build settings are still empty/root — a second site can't affect it, but costs nothing to check.

**Loose end:** because site 1 publishes the whole repo, `booking.html`/`booking_eeg.html` are *also* reachable at `<landing-site>/booking.html` etc. — same page, same flows, just not the address you advertise. To close that off, add a repo-root file called `_redirects` (no extension) containing one line per page:
```
/booking.html       /   301
/booking_eeg.html    /   301
```
This affects **only site 1** — Netlify reads `_redirects` from the directory a site publishes, and the booking sites publish `dist`, which never contains this file. Optional; skip it if the duplicate addresses don't matter to you.

---

## Reference

### What lands in `Answers JSON`

Both booking pages share one instrument, version `v1-bfi2`, **71 keys** per row:

| Keys | What |
| --- | --- |
| `screeningPassed` | Always `true`. The individual eligibility answers are **never stored** — psychiatric history and pregnancy are special-category data under GDPR, and since only eligible people ever reach submit, every stored value would be identical anyway. This flag just records that the gate ran. |
| `d_sex`, `d_age`, `d_handedness`, `d_education`, `d_sector`, `d_language` | Demographics |
| `bfi1` … `bfi60` | Big Five Inventory-2, stored as the chosen label text (map to 1–5 via `BFI_SCALE`'s order when scoring: `Disagree strongly` = 1 … `Agree strongly` = 5). The domain/facet scoring key and the required copyright line (© 2015 Oliver P. John and Christopher J. Soto) are a comment directly above `BFI_ITEMS` in the page source. |
| `c_read`, `c_voluntary`, `c_data`, `c_agree` | Consent, stored as `true` |

~3 KB per row — well inside Excel's ~32,000-character cell limit.

### Changing the questionnaire

Everything lives in `DEMOGRAPHIC_QUESTIONS`, `BFI_ITEMS` and `CONSENT_QUESTIONS` (→ `QUESTIONS`) in each page's `<script>`. Each entry: `id`, `section`, `type` (`single`/`multi`/`text`/`textarea`/`number`/`consent`), `label`, `options` where relevant, `required`; `number` types can add `min`/`max` for range-checking. **Bump `QUESTIONNAIRE_VERSION`** whenever you do — this discards any in-progress session on the old set (rather than half-restoring it) and keeps every stored row tagged with what it answered.

Pages are built **one section at a time** via `SECTION_PAGE_SIZE` (demographics 6/page, BFI-2 10/page, consent all on one page; anything unlisted falls back to `DEFAULT_PAGE_SIZE`), so a section never spans two pages. Nothing else — progress bar, validation, storage, the step machine — needs touching.

### Changing the eligibility criteria

`booking.html`'s `SCREENING` (8 questions) and `booking_eeg.html`'s (13) are **drafts** and must be checked against the actual UCL REC approval before going live. Each is grouped so the eligible answer is uniform within a group (`expect: 'Yes'` or `'No'` per group) — Continue stays disabled until every answer matches. Someone who fails sees a neutral message naming no specific question, shown only once every question is answered (showing it earlier would point at the deciding one). Nothing about a failed attempt is ever transmitted.

### Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `401` on any flow | Trigger's "Who can trigger" is still "Any user in my tenant" | Set to **Anyone** |
| Flow won't save: `InvalidConcurrencyConfiguration` | Concurrency Control switched on with Response actions present | Switch off — see Conventions |
| Flow won't save: "contains invalid expression(s)" | An unquoted string literal, or an Expression box opened and left blank | Quote string literals (`'Crowd'`); leave truly-blank fields untouched, don't open-and-clear them |
| "Invalid reference" to an action | Typed the action's name with a space | Rename the action to have no space, or reference it with the underscore form |
| A Filter array always returns everything or nothing | Used basic mode, or typed a column name as plain text | Use **Edit in advanced mode**; see Conventions for the `item()` rules |
| Attachment has the wrong extension or garbled content | Attachment Name was a token instead of typed text, or Attachment Content points at the wrong action's output | Type the filename literally; point Content at the actual CSV/ICS-producing action |
| Signup/Booking form shows "Something went wrong" | Wrong or truncated endpoint URL pasted into the page | Re-copy via the copy icon, never by reading the field |
| Duplicate email not caught | Filter Query syntax error (signup flow), or a Filter array condition typo (booking flows) | Rebuild the Filter Query by typing+clicking; re-check the advanced-mode expression |
| A cancelled person still holds a place | `Cancelled` cell has a stray space, not truly blank | Clear the cell with Delete, not a keystroke |
| All slots show Full when they're not | `Capacity` (or `EEG Per Cohort`) is empty or stored as text | Every such cell must be a plain number |
| `Registered Interest` always `No` | `ListSignups` points at the wrong file/table | Must read the `Signups` table in `minds_in_motion_signups.xlsx` |
| Two bookings landed in a slot with room for one | Two confirms within the same instant — the accepted race window | See Part 3's write-step note; not a bug |
| EEG booking accepted for a 3rd person in one cohort on one session | `cohort_full` check missing or comparing the wrong cohort | Re-check `CrowdCohort`'s expression matches `outputs('Cohort')`, not a literal |
| `.ics` only shows one of two EEG events | Both `VEVENT`s used the same `UID` | Give them different suffixes (`-ind` / `-grp`) |
| Netlify site 2/3 shows the wrong page | Publish directory isn't `dist`, or the build command's `cp` target is wrong | Check the deploy log; confirm Publish directory is exactly `dist` |
| Changes to a booking page don't appear live | Netlify only rebuilds on push | Commit and push; check the site's Deploys tab |
