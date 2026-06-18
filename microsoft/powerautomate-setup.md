# Minds in Motion — Microsoft Integration Setup

This replaces the Google Apps Script approach. Participant data submitted on the website
is sent to a **Power Automate** flow, which writes a new row into an **Excel table hosted
on SharePoint** (UCL servers).

---

## Before you start

**Licensing check:** The "When an HTTP request is received" trigger in Power Automate
requires a **premium connector**. Most UCL Microsoft 365 accounts include this, but
confirm with UCL IT before proceeding if you are unsure.

Sign in to [make.powerautomate.com](https://make.powerautomate.com) using your UCL
Microsoft account (your UCL email ending in @ucl.ac.uk) to check access.

---

## Step 1 — Create the Excel file on SharePoint

1. Go to your UCL SharePoint site and navigate to the document library where you
   want to store the signup data.
2. Create a new Excel workbook. Name it: **Minds in Motion Signups.xlsx**
3. In the first sheet (Sheet1), type these column headers in Row 1, one per cell:

   | A | B | C | D | E | F | G | H |
   |---|---|---|---|---|---|---|---|
   | Server Timestamp | First Name | Last Name | Sex | Age | Email | Institution | Client Timestamp |

4. Select cells A1 through H1 (the headers). Then select a few rows below as well
   (e.g. A1:H10).
5. Click **Insert** in the Excel ribbon, then **Table**. Make sure "My table has
   headers" is checked. Click **OK**.
6. Right-click the table and choose **Table > Table Name**. Name it: **Signups**
7. Save the file.

---

## Step 2 — Create the Power Automate flow

1. Go to [make.powerautomate.com](https://make.powerautomate.com).
2. Click **+ Create** in the left sidebar.
3. Choose **Instant cloud flow**.
4. Name it: **Minds in Motion Signup Receiver**
5. For the trigger, choose: **When an HTTP request is received**
6. Click **Create**.

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
the trigger will populate. **Copy this URL** — you will need it in Step 7.

---

## Step 4 — Add the "Add a row" action

1. Click **+ New step**.
2. Search for: **Excel Online (Business)**
3. Choose the action: **Add a row into a table**
4. Configure it:
   - **Location:** SharePoint
   - **Document Library:** the library where you saved the Excel file
   - **File:** navigate to and select **Minds in Motion Signups.xlsx**
   - **Table:** select **Signups**
5. Map the columns. Click each column field and use the dynamic content picker
   to select the matching field from the HTTP trigger output:

   | Excel column | Dynamic content to select |
   |---|---|
   | Server Timestamp | Use the expression: `utcNow()` |
   | First Name | `firstName` |
   | Last Name | `lastName` |
   | Sex | `sex` |
   | Age | `age` |
   | Email | `email` |
   | Institution | `institution` |
   | Client Timestamp | `timestamp` |

   For **Server Timestamp**, click the field, then click "Expression" (not
   Dynamic content), type `utcNow()` and click **OK**.

---

## Step 5 — Add the Response action

1. Click **+ New step**.
2. Search for: **Request** and choose the action: **Response**
3. Configure it:
   - **Status Code:** `200`
   - **Headers:** click **+ Add new header**
     - Name: `Access-Control-Allow-Origin`
     - Value: `*`
   - Add another header:
     - Name: `Content-Type`
     - Value: `application/json`
   - **Body:**
     ```json
     {"result":"success"}
     ```

---

## Step 6 — Save and get the URL

1. Click **Save** (top right).
2. Go back to the trigger step ("When an HTTP request is received").
3. Copy the **HTTP POST URL** shown at the top of that step.
   It looks like: `https://prod-XX.XX.logic.azure.com:443/workflows/...`

---

## Step 7 — Connect the website

1. Open `website/index.html` in a text editor or VS Code.
2. Near the bottom of the file, find:
   ```
   const POWER_AUTOMATE_URL = 'PASTE_YOUR_POWER_AUTOMATE_URL_HERE';
   ```
3. Replace the placeholder (keep the quotes) with the URL you copied in Step 6.
4. Save the file.

---

## Step 8 — Test the connection

1. Open the website (via VS Code Live Server or a deployed URL).
2. Fill in the signup form with test data and submit.
3. You should see the thank-you message on screen.
4. Open your Excel file on SharePoint — a new row should appear within a few
   seconds.
5. If no row appears, go to Power Automate, click **My flows**, find your flow,
   and click **28 day run history** to see the execution log and any error details.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Form shows "Something went wrong" | Wrong URL pasted | Double-check the URL in index.html |
| No row in Excel | Flow ran but action failed | Check the flow run history in Power Automate |
| "Premium connector" error | Licensing issue | Contact UCL IT to confirm Power Automate plan |
| Flow never triggered | CORS or network issue | Check browser DevTools Network tab for the POST request status |

---

## Note on the previous Google Apps Script integration

The `apps-script/` folder and `Code.gs` file in this repo are no longer used.
They documented the original Google Sheets integration, which has been replaced
by this Power Automate + Excel on SharePoint approach to keep all data on UCL
Microsoft servers.
