// ═══════════════════════════════════════════════════════════════════════════
// Minds in Motion — Google Apps Script Web App
// Receives POST requests from the signup website and writes participant
// data to a Google Sheet.
//
// ─────────────────────────────────────────────────────────────────────────
// COMPLETE SETUP INSTRUCTIONS (written for non-developers)
// ─────────────────────────────────────────────────────────────────────────
//
// ── STEP 1: Create your Google Sheet ─────────────────────────────────────
//
//   a) Go to sheets.google.com and sign in with the Google account you
//      want to use for this study.
//   b) Click the big "+" button to create a new spreadsheet.
//   c) Name it something like: Minds in Motion — Signups
//   d) In Row 1, type the following column headers (one per cell):
//        A1: Server Timestamp
//        B1: First Name
//        C1: Last Name
//        D1: Sex
//        E1: Age
//        F1: Email
//        G1: Institution
//        H1: Client Timestamp
//   e) Look at your browser's address bar. The URL will look like this:
//        https://docs.google.com/spreadsheets/d/  >>>THIS_LONG_ID<<<  /edit
//      Copy just the long ID in the middle (between /d/ and /edit).
//   f) Paste that ID into the SHEET_ID constant below (replacing the
//      placeholder text).
//
// ── STEP 2: Open Apps Script ──────────────────────────────────────────────
//
//   a) In your Google Sheet, click the menu: Extensions → Apps Script
//      (A new browser tab will open with the Apps Script editor.)
//   b) Delete ALL the existing code in the editor (select all, delete).
//   c) Copy the entire contents of this file (Code.gs) and paste it in.
//   d) Click the floppy disk / save icon, or press Ctrl+S (Cmd+S on Mac).
//      Name the project if prompted, e.g. "Minds in Motion Signups".
//
// ── STEP 3: Deploy as a Web App ───────────────────────────────────────────
//
//   a) Click the blue "Deploy" button in the top right corner.
//   b) Click "New deployment".
//   c) Click the gear/cog icon next to "Select type" and choose "Web app".
//   d) Fill in the settings:
//        Description:    Minds in Motion signup endpoint
//        Execute as:     Me  (your Google account)
//        Who has access: Anyone
//   e) Click "Deploy".
//   f) Google will ask you to authorise the script. Click "Authorise access".
//      • You may see a warning: "Google hasn't verified this app"
//        This is normal for scripts you write yourself. Click "Advanced",
//        then click "Go to [project name] (unsafe)". This is safe — you
//        wrote the script and are authorising your own account.
//      • Click through any remaining permission prompts.
//   g) After authorisation, you'll see a "Deployment" screen with a
//      Web app URL. It starts with:
//        https://script.google.com/macros/s/...
//      COPY THIS URL — you will need it in the next step.
//
// ── STEP 4: Connect the website to this endpoint ──────────────────────────
//
//   a) Open the file: website/index.html in a text editor
//      (Notepad, TextEdit, VS Code, etc.)
//   b) Near the bottom of the file, find this line:
//        const APPS_SCRIPT_URL = 'PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE';
//   c) Replace the placeholder text (keeping the single quotes) with the
//      Web App URL you copied in Step 3g.
//   d) Save the file.
//
// ── STEP 5: Test the connection ───────────────────────────────────────────
//
//   a) Open website/index.html in a web browser.
//   b) Fill in the signup form with test data (e.g. your own name/email).
//   c) Click "Register my interest".
//   d) If it works: you'll see the thank-you message on screen, and a new
//      row will appear in your Google Sheet within a few seconds.
//   e) If something goes wrong: open the Apps Script editor, click
//      "Executions" in the left sidebar to see error logs.
//
// ── IMPORTANT: Redeployment ───────────────────────────────────────────────
//
//   If you ever change the script code after initial deployment, you must
//   create a NEW deployment (Deploy → New deployment) to apply the changes.
//   Editing and saving alone does NOT update the live endpoint.
//
// ═══════════════════════════════════════════════════════════════════════════


// ─── CONFIGURATION ────────────────────────────────────────────────────────
// Paste your Google Sheet ID here (the long string from the URL — see Step 1e).
const SHEET_ID = 'PASTE_YOUR_GOOGLE_SHEET_ID_HERE';

// The name of the tab/sheet to write data to. Default is 'Sheet1'.
// If you rename your tab (right-click the tab at the bottom of Google Sheets),
// update this value to match.
const SHEET_TAB_NAME = 'Sheet1';
// ──────────────────────────────────────────────────────────────────────────


/**
 * Handles POST requests from the website signup form.
 * Parses the JSON body and appends a new row to the Google Sheet.
 *
 * Expected JSON body fields:
 *   firstName, lastName, sex, age, email, institution, timestamp
 */
function doPost(e) {
  try {
    const raw  = e.postData && e.postData.contents ? e.postData.contents : '{}';
    const data = JSON.parse(raw);

    const sheet = SpreadsheetApp
      .openById(SHEET_ID)
      .getSheetByName(SHEET_TAB_NAME);

    if (!sheet) {
      throw new Error(
        'Sheet tab "' + SHEET_TAB_NAME + '" not found. ' +
        'Check the SHEET_TAB_NAME constant in Code.gs.'
      );
    }

    // Append one row: server timestamp first, then participant fields
    sheet.appendRow([
      new Date(),                   // A: Server Timestamp  (set by this script)
      data.firstName   || '',       // B: First Name
      data.lastName    || '',       // C: Last Name
      data.sex         || '',       // D: Sex
      data.age         || '',       // E: Age
      data.email       || '',       // F: Email
      data.institution || '',       // G: Institution
      data.timestamp   || ''        // H: Client Timestamp  (sent by the form)
    ]);

    return buildResponse({ result: 'success' });

  } catch (err) {
    // Log to Apps Script's Executions panel for debugging
    console.error('doPost error:', err.toString());
    return buildResponse({ result: 'error', message: err.toString() });
  }
}


/**
 * Handles GET requests — useful as a quick health-check.
 * Visit the Web App URL directly in a browser to see this response.
 */
function doGet(e) {
  return buildResponse({
    result: 'ok',
    message: 'Minds in Motion signup endpoint is live. ' +
             'Send POST requests with JSON body to submit participant data.'
  });
}


/**
 * Builds a JSON response.
 *
 * Note on CORS: ContentService does not allow setting arbitrary response headers,
 * so Access-Control-Allow-Origin cannot be set here. Apps Script handles CORS by
 * issuing a 302 redirect on POST requests; the website's fetch() call uses
 * redirect:'follow' and omits the Content-Type header (sending as text/plain),
 * which avoids triggering a CORS preflight. This is the standard pattern for
 * Apps Script Web App integrations.
 */
function buildResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
