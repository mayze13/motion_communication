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
