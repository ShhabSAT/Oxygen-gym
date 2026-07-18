# Manual cross-device / offline test script (run in TWO real browser windows)

The automated harness can't isolate two browser profiles with independent
network control, so please run these yourself. Two Chrome windows = two
"devices". Both must be logged in (admin / oxygen123).

Pre-req: dev server running (`npm run dev` → http://localhost:5173).
Writes now use fire-and-forget against the local cache (see `src/lib/store.ts`):
the sheet closes IMMEDIATELY and the list updates from `onSnapshot`, so the
offline UI must never hang on "جارٍ الحفظ…". A late server-side rejection
(e.g. rule denial after reconnect — NOT mere offline) surfaces as a non-blocking
red toast ("تعذر حفظ بعض التغييرات على الخادم…"), not a stuck spinner.

============================================================
TEST 1 — cross-device real-time (both online)   [DONE — verified live, PASS]
============================================================
1. Window A: open http://localhost:5173 → log in.
2. Window B: open same URL in a NEW window (not tab) → log in.
3. In B, go to Members (الأعضاء) and watch the list.
4. In A, register a new member (تسجيل عضو جديد).
5. Observe B: the new member should appear within ~1-3s, NO refresh.
   → If yes: PASS. If you must refresh: FAIL.

============================================================
TEST 3 — delete propagation + no resurrection   [DONE — verified live, PASS]
============================================================
1. Both A and B showing the same member (e.g. the one from Test 1).
2. In A, open the member → حذف العضو → confirm.
3. Observe B: member disappears within ~1-3s, no refresh.
4. Wait 30s on B. Confirm it does NOT reappear.
   → If gone and stays gone: PASS. If it comes back: FAIL (tombstone bug).

============================================================
TEST 2 — offline write + reconnect sync   [you run — needs network toggle]
============================================================
1. A and B both online, both showing the SAME member's profile.
2. In B: open DevTools (F12) → Network tab → set throttling to **Offline**.
 3. In B, record a payment (تسجيل دفعة) for that member.
 4. confirm B's UI stays responsive — the sheet CLOSES at once and the
    payment shows locally (no "جارٍ الحفظ…" spinner, no frozen UI).
    → offline usability: PASS/FAIL.
5. In B: DevTools → Network → back to **No throttling** (online).
6. Observe A: the payment now appears in that member's profile.
   → sync-after-reconnect: PASS/FAIL.
   (If A doesn't show it within ~5s, try a manual refresh once;
    if it STILL needs refresh, that's a FAIL — tell me.)

============================================================
TEST 4 — simultaneous offline edits (different fields)   [you run offline part]
============================================================
Goal: confirm A's `phone` edit and B's `notes` edit BOTH survive
after reconnect (the clobber risk we just fixed with updateDoc).

1. A and B both online, same member open in both.
2. B: DevTools → Network → **Offline**.
3. A: DevTools → Network → **Offline**.
4. In A: edit the member's PHONE number, save.
5. In B: edit the member's NOTES field, save.
6. Both still offline: confirm each window shows its OWN edit locally.
7. A: Network → online.  B: Network → online.
8. Wait ~5s. On BOTH windows, reopen / re-check the member:
   - phone should = A's value
   - notes should = B's value
   → If BOTH are correct: PASS (updateDoc merge works).
   → If one field reverted to the other window's value: FAIL (clobber
     still happening — report which field was lost).

NOTES:
- If a window shows a "تعذر الاتصال بالخادم" (connection error) screen
  instead of data, that means anonymous auth / rules aren't live yet.
- Report PASS/FAIL per test with what you observed.
