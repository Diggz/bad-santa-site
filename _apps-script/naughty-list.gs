/**
 * Bad Santa and the Angry Elves — Naughty List form handler
 * ---------------------------------------------------------
 * Lives in its own Apps Script project and writes to the sheet
 * below by ID. Deploy → New deployment →
 * Web app (Execute as: Me, Who has access: Anyone).
 * Put the /exec URL into ENDPOINT in naughty-list.html.
 *
 * Bot protection, in order:
 *   1. Honeypot field ("website") must be empty
 *   2. Page must have run the site's JavaScript
 *   3. Form can't be submitted faster than a human can type
 *   4. Optional Cloudflare Turnstile check (set TURNSTILE_SECRET
 *      under Project Settings → Script Properties to turn on)
 *   5. Same email can't resubmit more than once a minute
 *
 * If an email is already on the list, its row is updated
 * (so people can change their opt-ins) instead of duplicated.
 */

var SPREADSHEET_ID = '196qv6zPh3_lbZ1LE4sS_yTdVLPeOM8G5NNAgTcJUAt0';
var SHEET_NAME = 'Naughty List';
var MIN_FILL_MS = 2500;
// BSide at Ten10 Brewing RSVPs close at midnight at the end of Thursday 11/26/2026, Eastern (Fri 11/27 05:00 UTC).
var RSVP_DEADLINE = Date.UTC(2026, 10, 27, 5, 0, 0);

// Keep this in sync with the SMS checkbox text on naughty-list.html.
// It's saved with every SMS opt-in as a record of what the person agreed to.
var SMS_CONSENT_TEXT =
  'By checking this box, I agree to receive recurring automated text messages from ' +
  'Bad Santa and the Angry Elves at the phone number provided, including show ' +
  'announcements, RSVP reminders and updates. Consent is not a condition of purchase. ' +
  'Message frequency varies. Message and data rates may apply. Reply STOP to opt out ' +
  'at any time or HELP for help. We never sell or share your phone number.';

// Column order must match row 1 of the sheet.
// Timestamp | First Name | Last Name | Email | Phone | SMS Opt-In | Marketing Opt-In |
// SMS Consent Language Shown | Source Page | Referrer | User Agent |
// RSVP: BSide @ Ten10 Brewing 11/27/2026 | Guests (incl. self) |
// Christmas Wish | Note to Bad Santa

function doPost(e) {
  try {
    var p = (e && e.parameter) || {};

    // 1. Honeypot: bots fill every field. Pretend it worked so they move on.
    if (p.website) return json_({ ok: true });

    // 2. Must come from the real page.
    if (p.js !== 'kringle') return json_({ ok: true });

    // 3. Too fast to be a person.
    var elapsed = Number(p.elapsed || 0);
    if (!elapsed || elapsed < MIN_FILL_MS) {
      return json_({ ok: false, error: 'Whoa, that was fast! Give it a second and try again.' });
    }

    // 4. Optional Turnstile.
    var secret = PropertiesService.getScriptProperties().getProperty('TURNSTILE_SECRET');
    if (secret) {
      if (!p.turnstileToken || !verifyTurnstile_(secret, p.turnstileToken)) {
        return json_({ ok: false, error: 'The bot check didn’t pass. Please refresh and try again.' });
      }
    }

    // Validate fields.
    var first = clean_(p.firstName, 60);
    var last = clean_(p.lastName, 60);
    var email = String(p.email || '').trim().toLowerCase().slice(0, 120);
    var phoneRaw = String(p.phone || '').trim().slice(0, 20);
    var phoneDigits = phoneRaw.replace(/\D/g, '');
    var sms = p.smsOptIn === 'yes';
    var marketing = p.marketing === 'yes' ? 'yes' : (p.marketing === 'no' ? 'no' : '');
    // Show RSVP. Blank if the page didn't send it (older cached page).
    var rsvp = p.rsvp === 'yes' ? 'Yes' : (p.rsvp === 'no' ? 'No' : '');
    var guests = '';
    if (rsvp === 'Yes' && Date.now() >= RSVP_DEADLINE) {
      return json_({ ok: false, error: 'RSVPs for BSide at Ten10 Brewing closed at midnight on 11/26. Uncheck the RSVP box to still join the Naughty List.' });
    }
    if (rsvp === 'Yes') {
      guests = Math.floor(Number(p.guests));
      if (!(guests >= 1 && guests <= 4)) return json_({ ok: false, error: 'Please pick 1 to 4 guests, including yourself.' });
    }

    if (!first || !last) return json_({ ok: false, error: 'Please enter your first and last name.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json_({ ok: false, error: 'Please enter a valid email address.' });
    if (phoneRaw && (phoneDigits.length < 10 || phoneDigits.length > 15)) return json_({ ok: false, error: 'Please enter a valid phone number.' });
    if (sms && phoneDigits.length < 10) return json_({ ok: false, error: 'Add your phone number to get text alerts.' });
    if (!marketing) return json_({ ok: false, error: 'Please choose whether you want email updates.' });

    // 5. Rate limit per email.
    var cache = CacheService.getScriptCache();
    var key = 'nl:' + Utilities.base64EncodeWebSafe(email);
    if (cache.get(key)) return json_({ ok: true });
    cache.put(key, '1', 60);

    var row = [
      new Date(),
      first,
      last,
      email,
      phoneRaw ? formatPhone_(phoneDigits) : '',
      sms ? 'Yes' : 'No',
      marketing === 'yes' ? 'Yes' : 'No',
      sms ? SMS_CONSENT_TEXT : '',
      clean_(p.page, 300),
      clean_(p.referrer, 300),
      clean_(p.ua, 300),
      rsvp,
      guests,
      clean_(p.wish, 200),
      cleanNote_(p.note, 1000)
    ];

    var lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      var sheet = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
      var existing = sheet.getRange('D:D').createTextFinder(email).matchEntireCell(true).findNext();
      if (existing && existing.getRow() > 1) {
        sheet.getRange(existing.getRow(), 1, 1, row.length).setValues([row]);
      } else {
        sheet.appendRow(row);
      }
    } finally {
      lock.releaseLock();
    }

    return json_({ ok: true });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: 'The Elves dropped your form. Please try again.' });
  }
}

// Read-only guest list for the unlinked roster page (names + RSVP only, nothing else).
// Requests must include ?list=1&key=LIST_KEY. Change the key here and in
// naughtylist-roster.html to cut off old copies of that page.
var LIST_KEY = 'Oh6aXB9IoYaxHqTz3tO8WrlbdkSp';

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.list === '1') {
    if (p.key !== LIST_KEY) return json_({ ok: false, error: 'Not allowed.' });
    var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    var values = sheet.getDataRange().getValues();
    var people = [];
    for (var i = 1; i < values.length; i++) {
      var r = values[i];
      if (!r[1] && !r[2]) continue;
      people.push({
        first: String(r[1] || ''),
        last: String(r[2] || ''),
        rsvp: String(r[11] || ''),
        guests: Number(r[12]) || 0
      });
    }
    return json_({ ok: true, updated: new Date().toISOString(), people: people });
  }
  return json_({ ok: true, service: 'Bad Santa Naughty List' });
}

/* ---------- helpers ---------- */

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// Trim, cap length, and stop spreadsheet formula injection (=, +, -, @).
function clean_(v, max) {
  var s = String(v || '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, max || 100);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

// Like clean_ but keeps line breaks, so longer notes stay readable in the sheet.
function cleanNote_(v, max) {
  var s = String(v || '').replace(/\r\n?/g, '\n').replace(/\t/g, ' ').trim().slice(0, max || 1000);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

function formatPhone_(d) {
  if (d.length === 11 && d.charAt(0) === '1') d = d.slice(1);
  if (d.length === 10) return '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6);
  return "'+" + d;
}

function verifyTurnstile_(secret, token) {
  var res = UrlFetchApp.fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'post',
    payload: { secret: secret, response: token },
    muteHttpExceptions: true
  });
  try { return JSON.parse(res.getContentText()).success === true; } catch (x) { return false; }
}
