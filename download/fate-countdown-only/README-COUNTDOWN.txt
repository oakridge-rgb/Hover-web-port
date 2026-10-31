FATE — COUNTDOWN-ONLY PACKAGE (original files + countdown)
===========================================================

This pack = your ORIGINAL site files, untouched, except one added
<script> line on index.html and games.html. Nothing else changed.
settings.html is byte-for-byte your original — the countdown doesn't
need any settings changes.

UPLOAD THESE 4 FILES to your site root:
  index.html     — your original + 1 line (countdown script tag)
  games.html     — your original + 1 line (countdown script tag)
  countdown.js   — NEW file, the countdown itself (drop-in)
  settings.html  — your original, unchanged (only here so you can
                   restore it if you already uploaded the V7 one)

WHAT IT DOES:
  - Top of Home + Games shows:  FATE V7 LAUNCHES IN
      [19 DAYS][10 HRS][38 MIN][00 SEC]   NOV 19 - 6:05 AM CT
  - Ticks every second, everyone in the world sees the same time.
  - Colors come from each page's own CSS variables (your amber
    theme) with built-in fallbacks, so it matches automatically.
  - At 6:05 AM on Nov 19 it flips to a glowing "FATE V7 IS LIVE"
    pill by itself. Nothing to edit on launch day.

NOTES:
  - countdown.js does NOT need theme.js — it's fully standalone.
  - Different date? Before the countdown <script> tag add:
      <script>window.FATE_LAUNCH_AT='2026-11-19T06:05:00-06:00';</script>
  - Want the banner on other pages? Add the same script tag there.
  - If you'd rather keep your original index/games and only add the
    line yourself, it's exactly this, inside <head>:
      <script src="countdown.js"></script>
