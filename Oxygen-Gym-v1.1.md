# Product Requirements Document (PRD)
## Oxygen Gym Management App

*Version 1.1 — Internal Web App (PWA) - Mobile Optimized*

---

## 1. Overview

This project is a Progressive Web App (PWA) built exclusively for Oxygen Gym's supervisors, to manage member subscriptions (men and women), track payments and debts, alert supervisors of subscriptions nearing expiration, and log every action taken in the system through a complete activity log.

The app is an internal tool built for a single gym only, not a product sold to other clients (not a SaaS). This decision significantly simplifies the technical architecture (no need for multi-tenancy or a subscription/billing system for the gyms themselves).

---

## 2. Goals

- Provide a centralized, unified tool for registering and tracking member subscriptions instead of relying on paper logs or memory.
- Reduce disputes and confusion between supervisors by clearly logging every action (who did it and when), with no ambiguity.
- Make it easy to track outstanding member debts and reduce the chance of them being lost or forgotten.
- Proactively alert supervisors about subscriptions nearing expiration to improve renewal rates.
- Keep the app as simple, fast to use, and highly mobile-friendly as possible, prioritizing a smooth experience on smartphones without extra features the gym doesn't actually need.
- Operate without hosting costs or paid subscriptions (relying on free tiers of the services used).
- Work reliably even when the internet inside the gym goes down, with automatic data sync once connectivity returns.

---

## 3. Non-goals

- The project is not intended to become a SaaS product sold to other gyms (no multi-tenancy, no billing system for external clients).
- No financial reports or advanced analytics (e.g., comparing monthly income, charts) in this version.
- No multi-level permission system between supervisors (a single shared login account, no roles or differing permissions).
- No actual daily attendance tracking (check-in) — the "intermittent" subscription type is managed with just a start and end date, without logging actual attendance days.
- No SMS messages or notifications sent to the member themselves; alerts are directed to supervisors only.
- No separate native app on Google Play or the App Store; access is via the PWA link only.
- No advanced conflict-resolution system for syncing; a "Last Write Wins" approach is used, since simultaneous conflicts are expected to be rare.

---

## 4. Users

A single user type: gym supervisors. All supervisors use one shared login account (a single shared username and password) to prevent unauthorized access. When performing any action, the system asks the user to select their name from a pre-registered list of supervisors — this is for logging/attribution purposes in the activity log only, and has no effect on permissions.

---

## 5. Technical Approach

- **UI/UX Paradigm (Mobile-First):** Since supervisors will primarily access the app via their mobile phones, the interface must be highly optimized for mobile touch interactions. Native-like mobile UI patterns must be used to ensure a smooth vibe-coding output (e.g., using Bottom Sheets instead of standard pop-ups on mobile devices).
- **App type:** Progressive Web App (PWA) — works on any device (Android, iOS, laptop) from a single link, with the ability to be "installed" to the home screen like a regular app.
- **Hosting:** A free hosting service (e.g., Vercel or Netlify) to host the app's files once.
- **Database and sync:** A free Backend-as-a-Service (e.g., Firebase or Supabase) that supports offline persistence and automatic sync when the internet returns.
- **Offline operation:** Each device keeps a full local copy of the app and data after the first load, and continues to work fully offline; any changes are automatically synced later.
- **Sync conflict resolution:** "Last Write Wins," given how rare it is for the same data to be edited from two offline devices at the same moment.
- **Daily notifications:** Delivered via a scheduled Cloud Function that runs automatically once a day on the service provider's servers, completely independent of whether the gym's devices are connected to the internet.
- **Visual identity:** Based on the Oxygen Gym logo (black, red, silver/metallic gray, white).
- **Interface language:** Fully in Modern Standard Arabic.

---

## 6. Detailed Features

### 6.1 Subscription Management

Standard subscription types, editable later from the admin page:

| Subscription Type | Price (Men) | Price (Women) |
|---|---|---|
| Visit (single day) | 10,000 | 10,000 |
| Intermittent (3 days/week, 1 month) | 50,000 | 75,000 |
| Monthly subscription | 75,000 | 100,000 |
| Private (monthly) | 100,000 | 150,000 |

- **Custom Duration:** When registering a subscription, the supervisor can set a non-standard duration (e.g., 6 months), and the system automatically calculates the suggested price based on the base rate.
- **Custom Price:** An option that is off by default when registering any subscription; if the supervisor enables it, a field appears to manually enter a custom price, and the system calculates the member's remaining balance based on that price.
- **Admin page:** Accessible to any supervisor (no additional protection), allowing them to edit prices for existing types or add an entirely new subscription type. A mandatory confirmation message must appear before saving any price changes.

### 6.2 Debts and Payments

- There is no minimum payment required at registration; the subscription starts immediately regardless of the amount paid.
- Any difference between the subscription price and the amount paid is automatically logged as a debt on the member.
- Debts can be paid off across multiple partial payments over several visits, with no mandatory repayment schedule.
- No automatic action (freezing, blocking, etc.) is taken in case of non-payment; the system simply displays the debt status clearly to supervisors.

### 6.3 Subscription Freeze

- Supervisors can freeze any member's subscription (e.g., for travel).
- **Fixed-duration freeze:** The supervisor sets a number of days, or months and days; the freeze is lifted automatically once the period ends, with the option to unfreeze manually at any point before that.
- **Open-ended freeze (no set date):** For cases where the return date is unknown; the subscription stays frozen until the supervisor manually unfreezes it.
- When the freeze is lifted (automatically or manually), the subscription's end date is automatically extended by exactly the number of frozen days, so the member retains the full remaining duration they had before the freeze.

### 6.4 Member Profiles and Smart Search

Member data captured at registration: name, gender, phone number, subscription type, subscription goal (optional), notes (optional).

- **Responsive Action Menus:** New subscription registration happens through a **Bottom Sheet** on mobile devices (for a smooth, native-like thumb reach) and a standard modal pop-up on larger desktop screens. This UI component is accessible from both the dashboard and the members list.
- When registering a "new" person, the system automatically searches (by name and phone number) for a match with a previous member whose subscription has expired, and prompts the supervisor: "Is this the same member?".
- Upon confirmation, the old member profile is updated instead of creating a duplicate one, fully preserving their subscription history and past dates.
- Every member keeps a complete history of their subscriptions (not just their current status), allowing supervisors to track how consistently they renew.
- The members list displays everyone with clear color-coding: green for active subscriptions, gray for expired ones.
- Smart search by name or phone number, with filters by gender, subscription type, and subscription status.
- The member's profile page displays their full history and any follow-up notes recorded on them.
- Subscriptions can be renewed directly from the member's profile, with the option to adjust the subscription type or price at renewal.
- No data is ever automatically deleted regardless of how long a member has been inactive; deletion is manual only, at the supervisor's discretion.

### 6.5 Dashboard (Home Screen)

The dashboard is the most important screen in the app and the default view when it's opened. It includes:

- A list of "subscriptions expiring today," with additional grouping for those expiring in two or three days, and a quick-access button to renew a subscription directly from the list.
- A list of "outstanding debts," sorted from oldest to most recent, with a quick-access button to log a payment directly.
- Quick shortcuts: register a new member, admin page, and other core functions (triggering bottom sheets on mobile).

### 6.6 Activity Log

This section logs every action performed in the system, sorted from most recent to oldest, covering the following types:

- New member registration
- Subscription renewal
- Payment collection (partial or full) against a debt
- Editing member information
- Editing prices from the admin page
- Deleting a member or subscription
- Freezing and unfreezing a subscription

Each line in the log clearly and directly displays the details of the action (e.g., "New member registered: Mohammad Yassin"), along with the responsible supervisor's name and the date/time of the action shown in the margin.

### 6.7 Backup

- Automatic, periodic (weekly) backup of all data, saved without requiring any action from supervisors.
- The ability to manually export a backup at any time (downloading a data file).
- The ability to import a previous backup to restore data when needed.

---

## 7. Data Model (Core Entities)

- **Member:** Name, gender, phone number, goal (optional), notes (optional), date of first registration, status (active/expired/frozen).
- **Subscription:** Linked to a member, type, start date, end date, actual price (standard or custom), duration (standard or custom).
- **Payment:** Linked to a subscription, amount, date, name of the supervisor who collected it.
- **Freeze:** Linked to a subscription, start date, duration (fixed or open-ended), actual unfreeze date.
- **ActivityLog:** Action type, description, supervisor name, date and time, related member/subscription reference.
- **SubscriptionType:** Name, price for men, price for women, editable from the admin page.

---

## 8. App Structure (Main Tabs)

- **Dashboard** — the default screen when the app is opened.
- **Members list** — search, filters, and status-based color-coding.
- **Activity log** — a complete chronological log of all operations.
- **Admin page** — manage subscription prices and types.

---

## 9. Risks and Considerations

- Relying on a shared login account means there's no real access control; attribution logging depends on the supervisor honestly selecting their correct name for each action, not on technical verification.
- The lack of a minimum debt threshold or mandatory debt alerts could allow debts to pile up unnoticed if supervisors don't regularly check the dashboard.
- The "Last Write Wins" sync approach could, in rare cases, cause a change made on one device to be lost if another device edits the same data at the exact same moment while offline; this is considered acceptable given how rarely this is expected to occur.
- Full reliance on free tiers for hosting and database services requires simple periodic monitoring to make sure the gym doesn't approach the free plan's limits as it grows in the future.

---

*End of document*