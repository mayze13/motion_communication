# Minds in Motion — Digital Infrastructure

Communication and recruitment materials for the Minds in Motion UCL neuroarchitecture study (September 2026), a follow-up to 100 Minds in Motion (UCL PEARL, 2024).

---

## What's in this repo

| File | What it is |
|---|---|
| `website/index.html` | Participant signup website (single HTML file, deploy anywhere) |
| `flyer/flyer.html` | Print-ready A5 recruitment flyer with QR code |
| `apps-script/Code.gs` | Google Apps Script endpoint — writes signups to a Google Sheet |
| `email/outreach-template.html` | HTML email template for outreach campaigns |

---

## Setup & Launch Checklist

Follow these steps in order to go from zero to a live recruitment system.

---

### Step 1 — Set up the Google Sheet

1. Go to [sheets.google.com](https://sheets.google.com) and create a new spreadsheet.
2. Name it: **Minds in Motion — Signups**
3. In Row 1, add these column headers (one per cell, left to right):

   ```
   A1: Server Timestamp
   B1: First Name
   C1: Last Name
   D1: Sex
   E1: Age
   F1: Email
   G1: Institution
   H1: Client Timestamp
   ```

4. Copy the **Sheet ID** from the browser URL bar — it's the long string between `/d/` and `/edit`:
   ```
   https://docs.google.com/spreadsheets/d/ >>>COPY THIS<<< /edit
   ```

---

### Step 2 — Deploy the Google Apps Script

1. In your Google Sheet, click **Extensions → Apps Script** (opens a new tab).
2. Delete all existing code in the editor.
3. Open `apps-script/Code.gs` from this repo and paste the entire contents.
4. Near the top, find `const SHEET_ID = 'PASTE_YOUR_GOOGLE_SHEET_ID_HERE'` and replace the placeholder with the Sheet ID from Step 1.
5. Save (Ctrl+S / Cmd+S).
6. Click **Deploy → New deployment**.
7. Click the gear icon → select **Web app**.
8. Set:
   - **Execute as:** Me
   - **Who has access:** Anyone
9. Click **Deploy** and authorise when prompted.
   > If you see "Google hasn't verified this app" — click Advanced → Go to [project name] (unsafe). This is expected for your own scripts.
10. **Copy the Web App URL** (starts with `https://script.google.com/macros/s/...`). Keep this safe.

---

### Step 3 — Connect the website to Google Sheets

1. Open `website/index.html` in any text editor.
2. Near the bottom of the file, find:
   ```
   const APPS_SCRIPT_URL = 'PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE';
   ```
3. Replace the placeholder text (keep the quotes) with the Web App URL from Step 2.
4. Save the file.

---

### Step 4 — Add UCL branding assets

In both `website/index.html` and `flyer/flyer.html`, search for the text `UCL Logo` to find placeholder elements. Replace each placeholder `<div>` with an `<img>` tag pointing to the UCL logo file:

```html
<!-- Website header -->
<img src="ucl-logo-white.png" alt="UCL" style="height:38px;">

<!-- Flyer header -->
<img src="ucl-logo-white.png" alt="UCL" style="height:11mm;">
```

Similarly, search for `Study image` to find the study photo placeholders. Replace each with an `<img>` tag pointing to your chosen study photograph.

Place logo and image files in the same folder as the HTML file they are used in.

---

### Step 5 — Deploy the website

**Option A: Netlify (recommended — free, no account needed for drag-and-drop)**

1. Go to [netlify.com](https://netlify.com) and sign up for a free account.
2. On your dashboard, drag and drop the `website/` folder onto the page.
3. Netlify will give you a URL like `https://your-site-name.netlify.app`.
4. (Optional) Go to **Domain settings** to set a custom subdomain, e.g. `mindsinmotion.netlify.app`.

**Option B: GitHub Pages (free, requires a GitHub account)**

1. Create a new GitHub repository.
2. Upload the contents of `website/` to the repository root.
3. Go to **Settings → Pages → Source: Deploy from branch → main → / (root)**.
4. Your site will be live at `https://yourusername.github.io/repo-name/`.

**Option C: Vercel**

1. Go to [vercel.com](https://vercel.com) and sign up.
2. Import the repository or drag-and-drop the `website/` folder.

---

### Step 6 — Test the signup flow

1. Open your live website URL.
2. Fill in the form with your own details and click **Register my interest**.
3. You should see the thank-you message on screen.
4. Open your Google Sheet — a new row should appear within a few seconds.

If the row doesn't appear, check the Apps Script execution log: in the Apps Script editor, click **Executions** in the left sidebar to see any errors.

---

### Step 7 — Create the bit.ly short link

1. Go to [bitly.com](https://bitly.com) and sign up for a free account.
2. Click **Create new → Link**.
3. Paste your deployed website URL.
4. Set a custom back-half. Suggested options (check availability):
   - `mindsinmotion` → **bit.ly/mindsinmotion** *(recommended)*
   - `mimucl` → bit.ly/mimucl
   - `uclmotion` → bit.ly/uclmotion
5. Click **Create** and copy the short link.

---

### Step 8 — Update and print the flyer

1. Open `flyer/flyer.html` in a text editor.
2. In the `<script>` block at the bottom, update the QR code URL:
   ```js
   text: 'https://bit.ly/mindsinmotion',  // ← your actual short link
   ```
3. Find the `<p class="short-link">` element and update the visible link text to match:
   ```html
   <p class="short-link">bit.ly/mindsinmotion</p>
   ```
4. Open `flyer/flyer.html` in **Chrome** or **Firefox**.
5. Press **Ctrl+P** (or Cmd+P on Mac) to open the print dialog.
6. Set:
   - **Paper size:** A5
   - **Margins:** None (or Minimum)
   - **Background graphics:** Enabled (tick the checkbox)
7. Click **Print** (to a physical printer) or **Save as PDF** for digital distribution.

---

### Step 9 — Send the email

1. Open `email/outreach-template.html` in a text editor.
2. Replace all placeholders in square brackets:
   - `[WEBSITE_URL]` → your live website URL or bit.ly short link
   - `[study email address]` → e.g. `mindsinmotion@ucl.ac.uk`
   - `[ethics reference]` → your UCL ethics approval reference
   - `[study image URL]` → a publicly accessible URL to a study photo (hosted online)
   - `[UCL logo URL]` → a publicly accessible URL to the UCL white logo PNG
   - `[unsubscribe URL]` → your bulk sender's unsubscribe link
3. Save the file.
4. To send via **Mailchimp:** Create Campaign → Email → Paste HTML → use Code/HTML view, paste the raw file contents.
5. To send via **Gmail** (small lists): use a browser extension such as Yet Another Mail Merge, or paste the HTML into a draft.

---

## Suggested subject lines

```
Participate in Minds in Motion — a UCL neuroarchitecture study (September 2026)
Shape the future of neuroarchitecture — join Minds in Motion at UCL
Could you be part of the next Minds in Motion? UCL study, September 2026
```

---

## Branding reference

| Element | Value |
|---|---|
| UCL Purple | `#361a54` |
| UCL White | `#fafafa` |
| Font (website/flyer) | DM Sans (Google Fonts) |
| Font (email) | Arial, Helvetica, sans-serif |

---

## Key contacts / placeholders to fill in before launch

- [ ] Study email address (e.g. mindsinmotion@ucl.ac.uk)
- [ ] UCL ethics approval reference number
- [ ] Study session duration (in hours)
- [ ] UCL logo PNG/SVG file (white version for purple backgrounds)
- [ ] Study photograph (for hero image on website, flyer strip, and email)
- [ ] Deployed website URL
- [ ] bit.ly short link (once created)

---

## Architecture overview

```
Participant
  → sees flyer / receives email
  → scans QR / types bit.ly/mindsinmotion
  → lands on website/index.html  (static host: Netlify / Vercel / GitHub Pages)
  → fills signup form
  → JS fetch() POST → apps-script/Code.gs  (Google Apps Script Web App)
  → Code.gs appends row → Google Sheet
  → {result:"success"} returned → website shows thank-you state
```
