# Minds in Motion — Microsoft Integration Setup

This replaces the Google Apps Script approach. Participant data submitted on the website
is sent to a **Power Automate** flow, which checks for a duplicate email, then writes a
new row into an **Excel table hosted on SharePoint** (UCL servers).

---

## Before you start

**Licensing check:** The "When an HTTP request is received" trigger in Power Automate
requires a **premium connector**. Most UCL Microsoft 365 accounts include this, but
confirm with UCL IT before proceeding if you are unsure.

Sign in to [make.powerautomate.com](https://make.powerautomate.com) using your UCL
Microsoft account (your UCL email ending in @ucl.ac.uk) to check access.

---

## Step 1 — Create the Excel file on SharePoint

1. Open the existing SharePoint Excel file (minds_in_motion_signups.xlsx) or create a
   new one in your UCL OneDrive / SharePoint document library.
2. In the first sheet (Sheet1), type these column headers in Row 1, one per cell:| A                | B          | C         | D   | E   | F     | G           | H                |
   | ---------------- | ---------- | --------- | --- | --- | ----- | ----------- | ---------------- |
   | Server Timestamp | First Name | Last Name | Sex | Age | Email | Institution | Client Timestamp |
3. Select cells A1 through H1 (the headers), then select a few rows below as well
   (e.g. A1:H10).
4. Click **Insert** in the Excel ribbon, then **Table**. Make sure "My table has
   headers" is checked. Click **OK**.
5. Right-click the table and choose **Table > Table Name**. Name it: **Signups**
6. Save the file.

---

## Step 2 — Create the Power Automate flow

1. Go to [make.powerautomate.com](https://make.powerautomate.com).
2. Click **+ Create** in the left sidebar.
3. Choose **Instant cloud flow**.
4. Name it: **Minds in Motion Signup Receiver**
5. For the trigger, choose: **When an HTTP request is received**
6. Click **Create**.

> **Note — the trigger step says "manual":** This is normal. Power Automate uses "manual"
> as its internal type name for HTTP-triggered flows. To confirm you have the right trigger,
> click the trigger step in the flow editor — you should see an **HTTP POST URL** field.
> If you see that URL, everything is correct. If you instead see a form with labelled
> input boxes and no URL, you accidentally chose "Manually trigger a flow"; delete the
> flow and start again from Step 2.

---

## Step 3 — Configure the HTTP trigger

In the flow editor, click the trigger step ("When an HTTP request is received").

Set **Method** to: **POST**

Paste the following into the **Request Body JSON Schema** box:

```json
{
  "type": "object",
  "properties": {
    "firstName":   { "type": "string" },
    "lastName":    { "type": "string" },
    "sex":         { "type": "string" },
    "age":         { "type": "number" },
    "email":       { "type": "string" },
    "institution": { "type": "string" },
    "timestamp":   { "type": "string" }
  }
}
```

Click **Save** (top right). After saving, the **HTTP POST URL** field at the top of
the trigger will populate. **Copy this URL** — you will need it in Step 9.

---

## Step 4 — Check for duplicate email

1. Click **+ New step**.
2. Search for: **Excel Online (Business)**
3. Choose the action: **List rows present in a table**
4. Configure it:

   - **Location:** SharePoint
   - **Document Library:** the library where the Excel file is saved
   - **File:** navigate to and select **minds_in_motion_signups.xlsx**
   - **Table:** select **Signups**
5. Expand **Show advanced options**.
6. In the **Filter Query** field, do the following — **do not paste; build it by typing and clicking**:

   1. Click inside the Filter Query field.
   2. Type exactly (keyboard apostrophe/single-quote key for the `'`):
      `Email eq '`
   3. Without leaving the field, click **Add dynamic content** (the lightning-bolt icon
      that appears next to the field, or the blue "Add dynamic content" link below).
   4. Under the "When an HTTP request is received" heading, click **email**.
      Power Automate inserts it as a blue chip in the field.
   5. Immediately after the chip, type a single closing quote:
      `'`

   The field should now read:  `Email eq '` **email** `'`  (where **email** is a blue chip).

   This returns only rows where the Email column matches the submitted address.

---

## Step 5 — Add a Condition (branch on duplicate)

1. Click **+ New step**.
2. Search for: **Condition** (under Control).
3. In the condition builder, click the left-hand value box.
4. Click **Add dynamic content** (the lightning bolt / blue link).
5. Under the "List rows present in a table" heading, click **value**.
   (This is the array of matching rows returned by Step 4.)
6. Set the operator to: **is not empty**
7. Leave the right-hand value blank — it is not needed for this operator.

This condition is true when at least one row with that email already exists.

---

## Step 6 — If yes (duplicate): return error response

Inside the **If yes** branch:

1. Click **Add an action**.
2. Search for: **Request** and choose: **Response**
3. Configure it:
   - **Status Code:** `409`
   - **Headers:** click **+ Add new header**
     - Name: `Access-Control-Allow-Origin` / Value: `*`
   - Add another header:
     - Name: `Content-Type` / Value: `application/json`
   - **Body:**
     ```json
     {"error":"email_duplicate"}
     ```

---

## Step 7 — If no (new email): add row

Inside the **If no** branch:

1. Click **Add an action**.
2. Search for: **Excel Online (Business)**
3. Choose: **Add a row into a table**
4. Configure it:

   - **Location:** SharePoint
   - **Document Library:** the same library
   - **File:** **minds_in_motion_signups.xlsx**
   - **Table:** **Signups**
5. Map the columns using the dynamic content picker:

   | Excel column     | Value                           |
   | ---------------- | ------------------------------- |
   | Server Timestamp | Expression:`utcNow()`         |
   | First Name       | Dynamic content:`firstName`   |
   | Last Name        | Dynamic content:`lastName`    |
   | Sex              | Dynamic content:`sex`         |
   | Age              | Dynamic content:`age`         |
   | Email            | Dynamic content:`email`       |
   | Institution      | Dynamic content:`institution` |
   | Client Timestamp | Dynamic content:`timestamp`   |

   For **Server Timestamp**: click the field, click **Expression**, type `utcNow()`, click **OK**.

---

## Step 8 — If no (new email): return success response

Still inside the **If no** branch, after the "Add a row" action:

1. Click **Add an action**.
2. Search for: **Request** and choose: **Response**
3. Configure it:
   - **Status Code:** `200`
   - **Headers:**
     - Name: `Access-Control-Allow-Origin` / Value: `*`
     - Name: `Content-Type` / Value: `application/json`
   - **Body:**
     ```json
     {"result":"success"}
     ```

---

## Step 9 — Save and connect the website

1. Click **Save** (top right).
2. Go back to the trigger step (labelled "manual" or "When an HTTP request is received"
   — both are correct, "manual" is Power Automate's internal name for this trigger type).
3. Find the **HTTP URL** or **HTTP POST URL** field at the top of that step.
   **Important:** click the **copy icon** next to it — do not try to read and retype the
   URL from the screen. The displayed URL is truncated; the real URL is much longer and
   contains embedded auth parameters you cannot see.
4. Open `website/index.html` in a text editor or VS Code.
5. Find:
   ```
   const POWER_AUTOMATE_URL = 'PASTE_YOUR_POWER_AUTOMATE_URL_HERE';
   ```
6. Replace the placeholder (keep the surrounding single quotes) with the URL you copied.
7. Save the file.

---

## Step 10 — Test the connection

1. Open the website (via VS Code Live Server or a deployed URL).
2. Fill in the signup form with a new test email and submit.
3. You should see the thank-you message on screen.
4. Open the Excel file on SharePoint — a new row should appear within seconds.
5. Submit the form again with the **same email**. You should see the message:
   _"That email address has already been used to sign up to the study."_
   No duplicate row should appear in Excel.
6. If anything is wrong, go to Power Automate → **My flows** → your flow →
   **28 day run history** to see the execution log and any error details.

---

## Troubleshooting

| Symptom                           | Likely cause               | Fix                                                            |
| --------------------------------- | -------------------------- | -------------------------------------------------------------- |
| Form shows "Something went wrong" | Wrong or truncated URL     | Re-copy the URL using the copy icon in PA, not by reading it   |
| No row in Excel                   | Flow ran but action failed | Check the flow run history in Power Automate                   |
| Duplicate email not caught        | Filter Query syntax error  | Check Step 4 — quotes around the expression matter            |
| "Premium connector" error         | Licensing issue            | Contact UCL IT to confirm Power Automate plan                  |
| Flow never triggered              | CORS or network issue      | Check browser DevTools Network tab for the POST request status |

---

## Note on the previous Google Apps Script integration

The `apps-script/` folder and `Code.gs` file in this repo are no longer used.
They documented the original Google Sheets integration, which has been replaced
by this Power Automate + Excel on SharePoint approach to keep all data on UCL
Microsoft servers.

---

## Export & mail-tracking (Exported Date / Mailed Date)

Once signups start arriving, you'll periodically want to pull out everyone's
email address, paste it into Mailchimp/Gmail to send the mass outreach email
(using `email/outreach-template.html`), and know afterwards who's already been
exported and mailed — so the next batch only ever picks up new people.

This is done with two extra columns on the Signups table and two small,
manually-triggered Power Automate flows. The actual mass email send still
happens outside Power Automate (Mailchimp/Gmail/BCC, as documented at the top
of this file) — these flows only compile the list and stamp the tracking
columns.

### Part A — Add the tracking columns

1. Open **minds_in_motion_signups.xlsx** and click any cell in the Signups
   table.
2. In the cell immediately to the right of the last column (**H: Client
   Timestamp**), type the header **`Exported Date`** and press Enter. The
   table automatically expands to include it as column **I**.
3. In the next empty cell to the right, type the header **`Mailed Date`** and
   press Enter — this becomes column **J**.
4. Leave both columns blank for all rows. Blank means "not done yet"; every
   new signup will also land with these two cells blank.

### Part B — Build the "Export New Signups" flow

Run this flow whenever you want to pull the latest batch of un-exported
emails.

1. Go to [make.powerautomate.com](https://make.powerautomate.com) → **+
   Create** → **Instant cloud flow**.
2. Name it **Export New Signups**. For the trigger, choose **Manually
   trigger a flow**. Click **Create**.
3. **+ New step** → **Excel Online (Business)** → **List rows present in a
   table**. Configure Location/Document Library/File/Table exactly as in
   Step 4 above (same file, **Signups** table), and leave Filter Query
   blank — list *all* rows. (The Excel connector's server-side filter
   doesn't reliably detect blank cells, so filtering happens in the next
   step instead.)
4. **+ New step** → search **Filter array** (under Data Operation), add it.

   - Immediately rename it: click the **⋯** on the action → **Rename**
     (or click directly on its title) → change it to **`FilterUnexported`**
     (no space). Do this for every action you're about to reference by
     typed expression — Power Automate stores a display name's spaces as
     underscores internally (`Filter array` → `Filter_array`), which is a
     common source of "invalid reference" errors when you type the name by
     hand. Renaming it to have no space up front removes that guesswork
     entirely: the name you see is the exact name you type.
   - **From:** the `value` output of the List rows step.
   - Build the condition: **`Exported Date`** is equal to *(leave the
     right-hand side blank)*.
5. **+ New step** → **Condition**. Set the left-hand value: click the field,
   go to the **Expression** tab, and type exactly:
   `length(body('FilterUnexported'))`
   Operator **is greater than**, right-hand value `0`. If there's nothing
   new, the flow ends here and sends nothing — safe to run any time without
   checking first.

   - If Power Automate still reports an invalid reference: click into the
     expression box, delete what you typed, retype just `length(body(`,
     then switch that same popup from the **Expression** tab to the
     **Dynamic content** tab — under the "FilterUnexported" heading click
     its output (usually listed as **value**) to insert the reference for
     you, then type the closing `)`. This inserts Power Automate's own
     guaranteed-correct token instead of relying on hand-typed text.
6. Inside **If yes**, add the following five actions **one after another,
   as siblings** (click **Add an action** inside the "If yes" box each time —
   do not nest them inside one another; only step 6e has its own action
   nested *inside it*, which is expected since it's a loop):

   **6a. Compose** (Data Operation) — rename it (see step 4) to
   `NewSignupCount`.

   - **Inputs:** click the field, switch to the **Expression** tab, type
     exactly `length(body('FilterUnexported'))` → **OK**. If it's rejected,
     use the same Dynamic-content-tab fallback described in step 5.
   - Why a separate Compose step: the Send-an-email action's Body field is
     a rich-text/HTML editor, and typing a raw function expression directly
     into it is what was causing the "invalid expression" error — the HTML
     editor can silently corrupt the token as you type or when anything
     else in the body is edited afterwards. A Compose action's Inputs field
     is a plain value field, not rich text, so the expression evaluates
     reliably there. You then just insert its *output* into the email as
     normal dynamic content (6d below) instead of retyping the expression
     inside the email body.

   **6b. Select** (Data Operation) — rename it to `SelectEmailFields`.

   - **From:** click the field → **Add dynamic content** → under the
     "FilterUnexported" heading, click **Body** (its filtered-array output —
     this is the only option offered here, and that's fine; the per-item
     fields aren't exposed as separate clickable tokens this far downstream
     of List rows, so you'll type them directly in the next part instead).
   - **Map:** by default this is a single value box. Click the **Switch to
     key/value mode** link just above/right of it — this turns it into a
     small table of Key/Value rows.
     - Row 1 — **Key:** type `Email` (plain text). **Value:** click into the
       box, but this time switch to the **Expression** tab instead of
       Dynamic content, and type `item()?['Email']` → **OK**.
     - Row 2 — **Key:** `First Name`. **Value:** same way, Expression tab,
       type `item()?['First Name']` → **OK**.
   - This *is* the correct, Microsoft-documented way to use `item()` in a
     Select action — unlike Create CSV table (the previous error), **Select**
     is specifically designed to support `item()` in its own value mapping
     without needing an explicit surrounding Apply-to-each loop. This step
     is what narrows the data down to just the two fields you want; without
     it, the next step would have no clean way to produce an Email + First
     Name-only CSV.

   **6c. Create CSV table** (Data Operation).

   - **From:** the SelectEmailFields (6b) output.
   - **Columns:** leave as **Automatic**. (Do *not* use Custom columns with
     a typed `item()` expression here — Create CSV table isn't itself a
     loop, so Power Automate rejects `item()`/`repeatItems` references in
     its column values at save time with an "InvalidTemplate" error. Since
     Select (6b) already narrowed the array down to just Email and First
     Name, Automatic columns now produces exactly those two columns with no
     expression needed.)

   **6d. Send an email (V2)** (Office 365 Outlook).

   - Send it **to yourself**. Subject: something like `Minds in Motion — new signups to export`. Body: type your message normally, then click
     into the body where you want the count → **Add dynamic content** →
     under the "NewSignupCount" (Compose, 6a) heading click **Outputs**.
     Do **not** type or paste a raw expression into this field — always use
     the dynamic content picker here.
   - **Attachment Name:** type this field as **plain text**, literally
     `new-signups.csv` — including the `.csv` extension. Don't use Add
     dynamic content for this field at all; it's just a filename string,
     and the extension you type here is the only thing that determines what
     file type the recipient sees. If you inserted a token here (or left it
     as an auto-suggested name), that's why the extension came through
     wrong or missing — clear the field and type the literal text instead.
   - **Attachment Content:** click **Add dynamic content** and pick
     **Output** from under the "Create CSV table" (6c) heading specifically
     — not Filter array's or Select's output, which are JSON, not CSV text.
     Attaching the wrong step's output is the other common cause of a
     wrong/garbled file: the *name* says `.csv` but the *content* isn't
     actually CSV-formatted.

   **6e. Apply to each** — its own input field (sometimes shown as "Select
   an output from previous steps"; this is the array the loop iterates over,
   one Update-a-row run per element): click it → **Add dynamic content** →
   under the "FilterUnexported" heading click **Body** (the filtered array).

   - Inside the loop (nested one level in, this is the only nesting in this
     step), add **Excel Online (Business)** → **Update a row**:
     Location/Document Library/File/Table as before.
     - **Key Column:** type `Email` (plain text — this tells the connector
       which column identifies the row; safe to use because the signup
       flow's duplicate-email check guarantees every email is unique).
     - **Key Value:** click into the field → try **Add dynamic content**
       first — if there's no individual **Email** token listed (only a
       whole-item/Body option, same as you just saw in the Select action),
       switch to the **Expression** tab instead and type
       `item()?['Email']` → **OK**. This is valid here specifically because
       Update a row is genuinely inside a real Apply to each loop — unlike
       the Create CSV table error earlier, `item()` is exactly what this
       loop context is for.
     - **Exported Date:** click into the field → **Add dynamic content** →
       **Expression** tab → type `utcNow()` → **OK**.

   After adding 6a–6e, go back to **6e (Apply to each)** and click its
   **⋯** menu → **Configure run after** → tick **is successful** for the
   Send email (6d) step (and untick "has failed"/"is skipped" if selected
   by default). This is the safety rail: rows only get stamped as exported
   if you actually received the list. If the email fails, nothing gets
   marked, and re-running the flow later will pick the same rows up again.

   **If the "invalid expression" error still appears on Send an email (V2)
   after this change:** click its **⋯** menu → **Peek code** to see the raw
   JSON for that action, and check every field for a stray `@` that isn't
   meant to start an expression (e.g. inside a plain-text email address
   typed directly into the body) — a literal `@` must be escaped as `@@`,
   or for an action name that doesn't exactly match how it's spelled in the
   designer (case and spacing both matter).
7. **Save** the flow.

### Part C — Build the "Mark Batch as Mailed" flow

Run this once you've actually sent the campaign externally using the
exported list.

1. Create another **Instant cloud flow**, name it **Mark Batch as Mailed**,
   trigger **Manually trigger a flow**.
2. **List rows present in a table** — same Signups table, no filter.
3. **Filter array** — add it, then rename it to **`FilterUnmailed`** (see
   the naming note in Part B, step 4 — renaming any action you'll reference
   later removes the space-vs-underscore guesswork). Condition, from the
   List rows output: **`Exported Date`** is not equal to *(blank)* **and**
   **`Mailed Date`** is equal to *(blank)*.
4. **Apply to each** — its input field: click it → **Add dynamic content**
   → under the "FilterUnmailed" heading click **Body**. Inside the loop,
   **Update a row** (Excel Online (Business)): **Key Column** = type
   `Email` (plain text); **Key Value** = try Add dynamic content first, and
   if no individual **Email** token is offered, switch to the **Expression**
   tab and type `item()?['Email']` (same reasoning as Part B, 6e — valid
   here because you're genuinely inside an Apply to each loop); **Mailed
   Date** = expression `utcNow()`.
5. Optional: **Send an email (V2)** to yourself confirming how many rows
   were marked.
6. **Save** the flow.

This flow only ever touches rows that were exported but not yet mailed, so
it's safe to run more than once or skip a cycle — it won't re-mark or
double-count anything.

### Part D — The day-to-day cycle

1. Run **Export New Signups** → you get an email with the new batch's CSV.
2. Import/paste those addresses into Mailchimp (or Gmail mail-merge/BCC),
   using `email/outreach-template.html` as the campaign body, and send.
3. Run **Mark Batch as Mailed**.
4. Repeat whenever new signups have trickled in — only genuinely new rows
   get exported, and only newly-exported rows get marked mailed.

---

# Booking flows (booking.html)

`booking.html` is the second stage of recruitment. People who registered
interest on `index.html` get emailed a link to it, and there they pick a
session slot, complete a demographic + personality questionnaire, and only
then confirm their place.

This page books **crowd sessions only** — one visit, up to two hours, no EEG
worn. EEG participants come through a separate funnel (two visits, extra
screening) which is not built yet. The data model below has a
`Session Type` column from day one so that funnel can be added later without
rebuilding anything.

Two flows are needed:

| Flow                           | What it does                                | Called                                         |
| ------------------------------ | ------------------------------------------- | ---------------------------------------------- |
| **Booking Availability** | Returns how full each slot is               | On page load, and again just before confirming |
| **Booking Confirm**      | Re-checks capacity, then writes the booking | Once, when the participant confirms            |

---

## Step 1 — Create the bookings workbook

Create a new Excel file in the **same SharePoint document library** as
`minds_in_motion_signups.xlsx`. Name it:

**minds_in_motion_bookings.xlsx**

It needs two sheets, each with a named table (same technique as the original
Signups table: select the header row plus a few rows below, **Insert →
Table**, tick "My table has headers", then right-click → **Table → Table
Name**).

### Sheet 1 — table name: `Slots`

Type these headers into Row 1:

| A       | B            | C    | D    | E     | F        |
| ------- | ------------ | ---- | ---- | ----- | -------- |
| Slot ID | Session Type | Date | Time | Label | Capacity |

Then type these nine rows exactly. `Label` is what participants actually see
on the website, so keep it readable.

| Slot ID | Session Type | Date       | Time  | Label              | Capacity |
| ------- | ------------ | ---------- | ----- | ------------------ | -------- |
| S1      | Crowd        | 2026-09-15 | 10:00 | Tue 15 Sept, 10:00 | 40       |
| S2      | Crowd        | 2026-09-15 | 14:00 | Tue 15 Sept, 14:00 | 40       |
| S3      | Crowd        | 2026-09-15 | 16:00 | Tue 15 Sept, 16:00 | 40       |
| S4      | Crowd        | 2026-09-16 | 10:00 | Wed 16 Sept, 10:00 | 40       |
| S5      | Crowd        | 2026-09-16 | 14:00 | Wed 16 Sept, 14:00 | 40       |
| S6      | Crowd        | 2026-09-16 | 16:00 | Wed 16 Sept, 16:00 | 40       |
| S7      | Crowd        | 2026-09-17 | 10:00 | Thu 17 Sept, 10:00 | 40       |
| S8      | Crowd        | 2026-09-17 | 14:00 | Thu 17 Sept, 14:00 | 40       |
| S9      | Crowd        | 2026-09-17 | 16:00 | Thu 17 Sept, 16:00 | 40       |

> **Why 40 when you only want 30 people?** Some people who book will not turn
> up. Overbooking to 40 against a target of 30 absorbs that. If you want to
> change a slot's size later, just edit its **Capacity** cell — nothing in
> the flows or the website needs to change.

> **Why the `Label` column has to stay in sync:** the website shows nothing
> but `Label`. It splits it on the comma to group slots by day, so keep the
> format `Day DD Mon, HH:MM`.

### Sheet 2 — table name: `Bookings`

Type these headers into Row 1. Leave all rows empty — the flow fills them in.

| A          | B                | C            | D       | E          |
| ---------- | ---------------- | ------------ | ------- | ---------- |
| Booking ID | Server Timestamp | Session Type | Slot ID | Slot Label |

| F          | G         | H     | I                |
| ---------- | --------- | ----- | ---------------- |
| First Name | Last Name | Email | Client Timestamp |

| J                     | K            | L                   | M         |
| --------------------- | ------------ | ------------------- | --------- |
| Questionnaire Version | Answers JSON | Registered Interest | Cancelled |

What the less obvious columns are for:

- **Answers JSON** — the entire questionnaire stored as one block of text.
  It looks unfriendly in Excel, and that is on purpose: it means changing the
  questions later is a one-line edit in `booking.html` and needs no change to
  this table or to the flows. Without it you would be adding and removing
  Excel columns every time the questionnaire changed.
- **Questionnaire Version** — which set of questions that person answered.
  Once the placeholder questions are replaced with real ones, this is what
  tells you how to read the older rows.
- **Registered Interest** — `Yes` if the email is already in the Signups
  table, `No` if not. Nobody is blocked either way; it just flags people who
  came in via a forwarded link or used a different address.
- **Cancelled** — leave blank. If someone drops out, type a date here and
  their place is immediately freed up for someone else. Do not delete the
  row: deleting loses the questionnaire answers you have already collected.

---

## How to read the expressions in this section

Every **Filter array** below is written as a single line for **Edit in
advanced mode** — the link underneath the condition boxes. Use that rather
than the two basic-mode boxes. Basic mode only offers you column names when
the incoming array carries a schema, which stops being true the moment an
array has passed through one Filter array, and typing a column name into
those boxes as plain text compares it as literal text and silently matches
nothing.

Three things appear in these expressions:

| What you see                 | What it means                                                                                                                                                                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `item()?['Slot ID']`       | The current row of**the array being filtered**, and the value in its `Slot ID` column. Inside a Filter array this always means the array in that action's own **From** box — never the row from an enclosing loop.     |
| `triggerBody()?['slotId']` | A field from**the trigger** — the flow's first step, *When an HTTP request is received*. This is the JSON that `booking.html` POSTed, and the field names match the Request Body JSON Schema you pasted into that trigger. |
| `outputs('CurrentSlotId')` | The result of an earlier**Compose** action of that name.                                                                                                                                                                        |

> **The capitalisation difference is deliberate, not a typo.**
> `item()?['Email']` is an **Excel column heading** — spelled exactly as it
> appears in Row 1 of the sheet, capitals and spaces included.
> `triggerBody()?['email']` is a **JSON field name** from the request —
> spelled exactly as in the schema, which is lower-case first letter. Getting
> either one's spelling wrong returns nothing and reports no error.

Type these lines in rather than pasting them; pasted text can carry invisible
characters that Power Automate rejects as an invalid expression.

---

## Step 2 — Build the "Booking Availability" flow

This one is safe to call from a public web page: it only ever returns
*counts*, never anyone's name, email, or answers.

1. [make.powerautomate.com](https://make.powerautomate.com) → **+ Create** →
   **Instant cloud flow** → name it **Minds in Motion Booking Availability**
   → trigger **When an HTTP request is received** → **Create**.
2. Click the trigger. Set **Who can trigger the flow?** to **Anyone**, set
   **Method** to **POST**, and paste this into **Request Body JSON Schema**:

   ```json
   {
     "type": "object",
     "properties": {
       "email": { "type": "string" }
     }
   }
   ```

   > **"Who can trigger the flow?" defaults to "Any user in my tenant", and
   > that will not work here.** That setting demands a UCL sign-in token on
   > every call, and `booking.html` is a public web page whose visitors are
   > not signed in to anything — every request would come back `401` and the
   > slot grid would never load. **Anyone** is correct: the long `sig=`
   > signature already embedded in the URL is what authorises the call, which
   > is exactly how the existing signup flow works. Set this on **both**
   > booking flows.
   >

   **Save**, then copy the URL from the **HTTP URL** box using the **copy
   icon** beside it — you need it in Step 4.

   > The box only fills in once the flow has been saved. Older Power Automate
   > versions label it **HTTP POST URL** — same thing, and there is only ever
   > one URL. The **Method** dropdown is what makes it a POST endpoint, so
   > there is no separate "POST URL" to hunt for.
   >
3. **+ New step** → **Excel Online (Business)** → **List rows present in a
   table** → the `Slots` table in `minds_in_motion_bookings.xlsx`. Rename
   this action to **ListSlots**.
4. Another **List rows present in a table** → the `Bookings` table. Rename it
   to **ListBookings**.

   > **Rename every action you will refer to later.** Power Automate stores
   > a name like "Filter array" as `Filter_array` internally, and typing the
   > wrong one is the single most common cause of "invalid reference" errors.
   > Names without spaces remove the guesswork entirely.
   >
5. **Filter array**, renamed **FilterCrowdSlots** — From: **ListSlots**'s
   `value`. **Edit in advanced mode**:

   ```
   @equals(item()?['Session Type'], 'Crowd')
   ```

   Keeps only the crowd slots, so EEG slots added to this table later are
   ignored by this flow.
6. **Filter array**, renamed **FilterActiveBookings** — From:
   **ListBookings**'s `value`. **Edit in advanced mode**:

   ```
   @empty(item()?['Cancelled'])
   ```

   Keeps only bookings that have not been cancelled, so a cancelled person
   stops taking up a place.

   > `empty()` is used rather than comparing to `''` because an untouched
   > Excel cell can come back as either an empty string or as null depending
   > on the row, and `empty()` correctly catches both. This check also has to
   > happen here rather than in the Excel connector's own Filter Query field,
   > which does not reliably match empty cells at all.
   >
7. **Initialize variable** — Name `SlotAvailability`, Type **Array**, Value
   `[]`. This must sit *before* the loop in step 8.

   > **Steps 5, 6 and 7 all sit at the top level of the flow — none of them
   > belong inside a loop.** By the end of step 8 you should have exactly one
   > loop in this flow. If a second one appears (often auto-created and named
   > "For each 1"), drag these actions back out and delete it. Power Automate
   > will not even save an *Initialize variable* that sits inside a loop.
   >
8. **Apply to each** — input: **FilterCrowdSlots**'s output (**Body**).
   Inside the loop add:

   1. **Compose**, renamed **CurrentSlotId** — Inputs → **Expression** tab →
      `item()?['Slot ID']`. This captures the slot the loop is currently on
      so the next action can refer back to it.
   2. **Filter array**, renamed **FilterBySlot** — From:
      **FilterActiveBookings**'s output. Then click **Edit in advanced
      mode** underneath the condition boxes and enter this single line:

      ```
      @equals(item()?['Slot ID'], outputs('CurrentSlotId'))
      ```

      > **Why advanced mode, and why the extra Compose.** Inside a Filter
      > array, `item()` means *the item being filtered* — here a booking —
      > **not** the slot from the enclosing loop. So you cannot use `item()`
      > for both sides of the comparison, and there is no way to express this
      > correctly using the two basic-mode boxes. The line above reads: keep
      > this booking if its Slot ID matches the slot we are currently
      > counting.
      >
      > You will also notice the basic-mode picker offers you no field names
      > here. That is expected: the array comes out of another Filter array,
      > which carries no column schema, so there is nothing for it to list.
      > Typing `Slot ID` into that box as plain text does **not** work — it
      > is compared as the literal text "Slot ID" and never matches, which
      > silently reports every slot as empty.
      >
      > `outputs('CurrentSlotId')` is used in preference to
      > `items('Apply_to_each')` because the latter depends on the loop's
      > exact internal name, which breaks if the loop is ever renamed or
      > duplicated.
      >
   3. **Compose**, renamed **SlotObject**. Click into Inputs and type `{` to
      get the JSON editor, then build:

      ```
      slotId   →  expression  item()?['Slot ID']
      label    →  expression  item()?['Label']
      capacity →  expression  int(item()?['Capacity'])
      booked   →  expression  length(body('FilterBySlot'))
      full     →  expression  greaterOrEquals(length(body('FilterBySlot')), int(item()?['Capacity']))
      ```

      > `item()` is correct in *this* action, unlike in FilterBySlot above.
      > SlotObject is a direct child of the Apply to each, so here `item()`
      > does mean the current slot.
      >
   4. **Append to array variable** — Name `SlotAvailability`, Value: the
      **Outputs** of **SlotObject** (click it from dynamic content).
9. After the loop — **outside it**, back at the flow's top level — add a
   **Filter array**, renamed **FilterEmailMatch**. From:
   **FilterActiveBookings**'s output (**Body**). **Edit in advanced mode**:

   ```
   @equals(toLower(coalesce(item()?['Email'], '')), toLower(coalesce(triggerBody()?['email'], '_none_')))
   ```

   This finds any existing booking belonging to whoever is currently using
   the page, which is what tells `booking.html` to stop someone at the first
   step instead of letting them redo the whole questionnaire.

   > Reading it from the inside out: `item()?['Email']` is the **Email
   > column** of the booking row being tested; `triggerBody()?['email']` is
   > the **email field** `booking.html` sent in the request.
   >
   > `toLower()` on both sides means `Alex@UCL.ac.uk` matches
   > `alex@ucl.ac.uk`, which people do type inconsistently.
   >
   > `coalesce(…, '_none_')` covers the page's first load, when nobody has
   > typed an email yet and the field arrives empty. Without it `toLower()`
   > is handed a null and the whole flow fails with a type error, so the slot
   > grid never loads. The nonsense value `_none_` can never match a real
   > email address, so the result is correctly empty. Comparing against `''`
   > instead would wrongly match any booking row with a blank email.
   >
10. **Compose**, renamed **AvailabilityResponseBody**:

    ```
    result        →  success
    slots         →  the SlotAvailability variable
    alreadyBooked →  expression  greater(length(body('FilterEmailMatch')), 0)
    ```

    > Build the response body in a Compose first rather than typing these
    > expressions straight into the Response action. This is the same lesson
    > as `NewSignupCount` earlier in this document: expressions typed into a
    > structured body field get silently mangled.
    >
11. **Response** — Status Code `200`; Headers
    `Access-Control-Allow-Origin: *` and `Content-Type: application/json`;
    Body: the **Outputs** of **AvailabilityResponseBody**.
12. **Save**.

> Do **not** turn on Concurrency Control for this flow. It only reads, so
> there is nothing to protect, and limiting it would just make the page
> slower when several people load it at once.

---

## Step 3 — Build the "Booking Confirm" flow

1. **+ Create** → **Instant cloud flow** → name it **Minds in Motion Booking
   Confirm** → **When an HTTP request is received** → **Create**.
2. ### Leave Concurrency Control switched OFF

   > **Do not turn Concurrency Control on for this flow.** It cannot be used
   > here, and switching it on makes the flow refuse to save with:
   >
   > *"InvalidConcurrencyConfiguration … concurrency control is not supported
   > when the workflow contains actions of type 'response' without the
   > operationOptions flag set to 'asynchronous'."*
   >
   > Concurrency control works by making runs queue up. A **Response** action
   > has to answer a browser that is sitting there waiting, and a queued run
   > cannot do that — so Power Automate forbids the combination. The only way
   > around it would be to make the responses asynchronous, which returns a
   > `202` and a polling URL instead of an answer, and `booking.html` would
   > have to be rewritten to cope. Not worth it.

   What you give up by leaving it off is the narrow window between counting
   the existing bookings (step 7) and writing the new row (step 13). For that
   to cause a problem, two people have to press Confirm within a second or so
   of each other on a slot sitting at exactly 39 of 40 — and the result is a
   41st booking in a slot that is already deliberately overbooked to 40
   against a real target of 30. That is comfortably inside the no-show margin
   you are already budgeting for.

   > **If you later want this airtight**, there is a lock-free pattern that
   > works alongside synchronous responses: write the row first, then check
   > whether you ended up past the cutoff and delete your own row if so.
   > Add a **Compose** named `NewBookingId` set to `guid()` and use
   > `outputs('NewBookingId')` for the Booking ID column instead of calling
   > `guid()` inline. Then after step 13, re-run **List rows** on Bookings,
   > add a **Filter array** named `FilterAheadOfMe`:
   > ```
   > @and(equals(item()?['Slot ID'], triggerBody()?['slotId']), empty(item()?['Cancelled']), less(item()?['Booking ID'], outputs('NewBookingId')))
   > ```
   > then a **Condition** — `length(body('FilterAheadOfMe'))` **is greater
   > than or equal to** `int(first(body('FilterSlotMeta'))?['Capacity'])`. If
   > yes, **Delete a row** (Key Column `Booking ID`, Key Value
   > `outputs('NewBookingId')`) and return the `409 slot_full` response; if
   > no, return the normal success response. Both racing runs can see both
   > rows by then, so they count consistently and exactly the right number of
   > bookings survive. `booking.html` already handles `slot_full` at this
   > point, so no website change is needed.

3. Set **Who can trigger the flow?** to **Anyone** (see the note in Step 2 —
   leaving it on "Any user in my tenant" makes every booking fail with a
   `401`), set **Method** to **POST**, and paste this **Request Body JSON
   Schema**:

   ```json
   {
     "type": "object",
     "properties": {
       "slotId":               { "type": "string" },
       "firstName":            { "type": "string" },
       "lastName":             { "type": "string" },
       "email":                { "type": "string" },
       "answers":              { "type": "object" },
       "questionnaireVersion": { "type": "string" },
       "timestamp":            { "type": "string" }
     }
   }
   ```

   **Save**, then copy the **HTTP POST URL** with the copy icon.
4. **List rows present in a table** → `Slots`, renamed **ListSlots**.
5. **List rows present in a table** → `Bookings`, renamed **ListBookings**.
6. **Filter array**, renamed **FilterSlotMeta** — From: **ListSlots**'s
   `value`. **Edit in advanced mode**:

   ```
   @and(equals(item()?['Slot ID'], triggerBody()?['slotId']), equals(item()?['Session Type'], 'Crowd'))
   ```

   Looks up the one slot being booked and confirms it really exists and
   really is a crowd slot, so a mistyped or EEG slot ID cannot be booked
   through this endpoint. Everything downstream reads the slot's capacity
   and label out of this result.
7. **Filter array**, renamed **FilterActiveForSlot** — From:
   **ListBookings**'s `value`. **Edit in advanced mode**:

   ```
   @and(equals(item()?['Slot ID'], triggerBody()?['slotId']), empty(item()?['Cancelled']))
   ```

   Every live booking already held against that slot. The number of items
   this returns *is* the current headcount, which step 9 compares against
   the slot's capacity.
8. **Filter array**, renamed **FilterActiveForEmail** — From:
   **ListBookings**'s `value`. **Edit in advanced mode**:

   ```
   @and(equals(toLower(coalesce(item()?['Email'], '')), toLower(coalesce(triggerBody()?['email'], '_none_'))), empty(item()?['Cancelled']))
   ```

   Any live booking this person already holds, in any slot — this is what
   stops one person quietly taking two places.

   > As in the availability flow: `item()?['…']` names an **Excel column**,
   > `triggerBody()?['…']` names a **field from the request**, `toLower()`
   > makes the email match case-insensitive, and `empty()` catches a blank
   > `Cancelled` cell whether Excel returns it as `''` or as null.
   >
9. **Condition**, renamed **SlotInvalidOrFull**. Left-hand value, as an
   expression (type it, do not paste):

   ```
   or(equals(length(body('FilterSlotMeta')), 0), greaterOrEquals(length(body('FilterActiveForSlot')), int(first(body('FilterSlotMeta'))?['Capacity'])))
   ```

   Operator **is equal to**, right-hand value `true`.

   - **If yes** → **Response**: Status `409`, the two usual headers, Body:
     ```json
     {"error":"slot_full"}
     ```
   - **If no** → carry on into step 10, *inside the If no branch*.
10. Inside **If no**, add a second **Condition**, renamed
    **EmailAlreadyBooked**. Left-hand value, expression
    `length(body('FilterActiveForEmail'))`, operator **is greater than**,
    right-hand value `0`.

    - **If yes** → **Response**: Status `409`, usual headers, Body:
      ```json
      {"error":"booking_duplicate"}
      ```
    - **If no** → the write branch, steps 11–14 below, all inside this inner
      **If no**.
11. **List rows present in a table** → the **`Signups`** table in
    `minds_in_motion_signups.xlsx` (the other workbook — not the bookings
    one), renamed **ListSignups**. Then a **Filter array**, renamed
    **FilterSignupMatch** — From: **ListSignups**'s `value`. **Edit in
    advanced mode**:

    ```
    @equals(toLower(coalesce(item()?['Email'], '')), toLower(coalesce(triggerBody()?['email'], '_none_')))
    ```

    Checks whether this person ever registered interest on `index.html`.
    Nobody is blocked either way — the result only decides what goes in the
    `Registered Interest` column, flagging people who arrived via a
    forwarded link or booked with a different address than they registered
    with.
12. **Compose**, renamed **AnswersJsonString** — Inputs, expression:
    `string(triggerBody()?['answers'])`
13. **Add a row into a table** → the `Bookings` table. Map every column:

    **Every row below is an expression** — click the field, switch to the
    **Expression** tab, type the line, click **OK**. There are no exceptions
    to remember, which is exactly why `'Crowd'` is written *with quotes*: as
    an expression, a bare unquoted word is not valid syntax, and the flow
    refuses to save with *"contains invalid expression(s)"*.

    | Excel column          | Expression to enter                                                |
    | --------------------- | ------------------------------------------------------------------ |
    | Booking ID            | `guid()`                                                         |
    | Server Timestamp      | `utcNow()`                                                       |
    | Session Type          | `'Crowd'`                                                        |
    | Slot ID               | `triggerBody()?['slotId']`                                       |
    | Slot Label            | `first(body('FilterSlotMeta'))?['Label']`                        |
    | First Name            | `triggerBody()?['firstName']`                                    |
    | Last Name             | `triggerBody()?['lastName']`                                     |
    | Email                 | `triggerBody()?['email']`                                        |
    | Client Timestamp      | `triggerBody()?['timestamp']`                                    |
    | Questionnaire Version | `triggerBody()?['questionnaireVersion']`                         |
    | Answers JSON          | `outputs('AnswersJsonString')`                                   |
    | Registered Interest   | `if(greater(length(body('FilterSignupMatch')), 0), 'Yes', 'No')` |
    | Cancelled             | leave untouched — see the warning below                          |

    > **`Cancelled` has to be left genuinely empty.** Do not open its
    > Expression tab and click OK, and do not type a space. An expression box
    > that was opened and left blank saves as an empty expression, and that
    > is the other common cause of the same "invalid expression" error on
    > this action.

    > **To find which field is broken**, click the action's **Code view**
    > tab. It lists every input exactly as stored. A healthy expression reads
    > `"@{triggerBody()?['slotId']}"`; a broken one is either a bare word
    > with no quotes inside the braces, or an empty `"@{}"`.
14. **Response** — Status `200`, usual headers, Body built in the JSON
    editor:

    ```
    result →  plain text   success
    slotId →  expression   triggerBody()?['slotId']
    label  →  expression   first(body('FilterSlotMeta'))?['Label']
    ```
15. **Save**.

---

## Step 4 — Connect the website

Open `booking.html` and find these two lines near the top of the `<script>`
block:

```js
const AVAILABILITY_URL = 'PASTE_YOUR_BOOKING_AVAILABILITY_URL_HERE';
const CONFIRM_URL      = 'PASTE_YOUR_BOOKING_CONFIRM_URL_HERE';
```

Replace each placeholder (keep the quotes) with the matching URL, copied
with the **copy icon** rather than read off the screen — the displayed URL is
truncated and the real one contains authentication parameters you cannot see.

`booking.html` is deliberately **not** linked from `index.html`. The only way
in is the link you send, which you set by putting the booking page's URL into
`email/outreach-template.html`'s existing `[WEBSITE_URL]` placeholder for
that campaign.

---

## Step 5 — Test it

### Testing a flow on its own, before the website is wired up

An HTTP-triggered flow cannot be set off from inside Power Automate — the
**Test** button only puts it into "waiting for a request" mode. Something has
to actually send it a request. Useful sequence:

1. Open the flow, click **Test** (top right) → **Manually** → **Test**. It
   now sits waiting, and will show you the run step by step as it happens.
2. From a terminal, send it a request. For the availability flow:

   ```bash
   curl -sS -X POST '<paste the HTTP URL here>' \
     -H 'Content-Type: application/json' \
     -d '{"email":""}'
   ```

   You should get back `{"result":"success","slots":[ …nine slots… ], "alreadyBooked":false}`.

   For the confirm flow:

   ```bash
   curl -sS -X POST '<paste the confirm URL here>' \
     -H 'Content-Type: application/json' \
     -d '{"slotId":"S1","firstName":"Flow","lastName":"Test",
          "email":"flowtest@example.com","answers":{"d_age_band":"25-34"},
          "questionnaireVersion":"placeholder-v1",
          "timestamp":"2026-09-01T10:00:00.000Z"}'
   ```

   You should get `{"result":"success","slotId":"S1","label":"Tue 15 Sept, 10:00"}` and a new row in the `Bookings` table. Delete that test row
   afterwards.
3. Whatever the response, open the flow → **28 day run history** to see
   exactly which action failed and what it received.

Common responses and what they mean:

| Response                                   | Meaning                                                                                                             |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `401` / a sign-in page                   | **Who can trigger the flow?** is still "Any user in my tenant" — change it to **Anyone**               |
| `202 Accepted` with an empty body        | The flow has no**Response** action on the path it took, or the Response sits inside a branch that did not run |
| `{"error":"slot_full"}` on an empty slot | `Capacity` is blank or stored as text, or `FilterActiveForSlot` is matching the wrong rows                      |
| Times out after ~2 minutes                 | The Response action is unreachable — usually an action failed earlier in the branch                                |

### Testing end to end through the website

1. Open `booking.html`. All nine slots should appear, grouped by day, each
   showing **Available**.
2. Book a place all the way through. In Excel, the new `Bookings` row should
   have the right `Slot ID`, a long string in `Answers JSON`, and
   `Registered Interest` = `Yes` if you used an email already in Signups.
3. Reload the page — that slot should now read 1 booking's worth of capacity
   used (it stays "Available" until it is 80% full).
4. Start again with the **same email**. You should be stopped at the first
   step, *before* the questionnaire, with a message saying that address
   already has a place.
5. **Test the capacity limit.** In Excel, temporarily set one slot's
   **Capacity** to `1`. Book that slot once so it is now full. Then open
   `booking.html` again, fill in the questionnaire, and try to confirm the
   same slot: you should be told the session just filled, be sent back to
   pick another time, and find *your answers still intact*. Check Excel — no
   second row was written. Set Capacity back to `40` afterwards.

   > This tests the capacity check itself, which is the part that matters day
   > to day. It deliberately does **not** test two people confirming at the
   > exact same moment — as explained in Step 3.2, that narrow window is
   > knowingly left open because the fix is incompatible with returning a
   > response to the browser.
6. Fill in half the questionnaire and refresh the page — your answers should
   still be there.

---

## Troubleshooting

| Symptom                                                | Likely cause                                          | Fix                                                                                           |
| ------------------------------------------------------ | ----------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Page shows "We couldn't load the available times"      | Availability URL wrong, or the flow failed            | Press Try again; if it persists, check the flow's run history                                 |
| All slots show as Full when they are not               | `Capacity` cells are empty or text                  | Check every Capacity cell contains a plain number                                             |
| A cancelled person still takes up a place              | `Cancelled` cell has a space in it, not truly blank | Clear the cell completely (Delete, not spacebar)                                              |
| Two bookings landed in a slot with room for one        | Two people confirmed within a second of each other, in the gap between the capacity check and the row being written | Expected and accepted — see the note in Step 3.2. Free a place by putting a date in that person's `Cancelled` cell, or build the write-then-verify pattern described there |
| Flow will not save: `InvalidConcurrencyConfiguration`  | Concurrency Control was switched on                   | Switch it back off — it cannot be used on a flow that has Response actions. See Step 3.2 |
| Slot times show the full date instead of just the time | A`Label` is missing its comma                       | Labels must read`Tue 15 Sept, 10:00`                                                        |
| Everyone shows`Registered Interest` = `No`         | ListSignups is pointed at the wrong file or table     | It must read the`Signups` table in `minds_in_motion_signups.xlsx`                         |
| Someone booked without doing the questionnaire         | Someone called the flow directly, bypassing the page  | The gate is in the website, not the flow; check`Answers JSON` looks complete                |

---

## Changing the questionnaire later

The questions live in one place: the `QUESTIONS` array near the top of the
`<script>` block in `booking.html`. Every question is currently marked
`[PLACEHOLDER]` so unfinished content is obvious.

When you replace them with the real instrument:

1. Edit the array. Each entry needs an `id`, a `section`, a `type`
   (`single`, `multi`, `text`, `textarea` or `number`), a `label`, `options`
   for the choice types, and `required`.
2. **Bump `QUESTIONNAIRE_VERSION`** on the line just above it (for example to
   `v2`). This does two things: anyone midway through the old questionnaire
   gets a clean start instead of a half-restored one, and every booking row
   records which version that person answered, so old rows stay readable.

Nothing else needs to change — pagination, the progress bar, validation and
storage all work off that one array.
