# Oxygen Gym Management App - Implementation Plan (v1.1)

This document outlines the milestones and detailed development tasks required to build the Oxygen Gym PWA. The system is designed as an internal Modern Standard Arabic (MSA) tool for supervisors to manage member subscriptions, track debts, freeze subscriptions, and maintain a complete activity log, with full offline-first capabilities and a mobile-first, native-like UI (bottom sheets on mobile).

---

## Technical Stack & Configuration
- **Frontend:** React + Vite + TypeScript + Tailwind CSS (configured for RTL and Arabic typography, mobile-first optimization).
- **Styling & Icons:** Tailwind CSS, Lucide React (Visual Identity: Red, Black, Metallic Gray, White).
- **UI Paradigm:** Mobile-first; use Bottom Sheets on mobile devices instead of standard pop-ups for a native-like thumb-reach experience; standard modal pop-ups on larger desktop screens.
- **Backend/Database:** Supabase or Firebase (supporting offline persistence/local caching out-of-the-box or with RxDB/IndexedDB sync).
- **PWA Capabilities:** `vite-plugin-pwa` for offline assets caching, service worker for background sync.
- **Hosting:** Free hosting service (e.g., Vercel or Netlify) to host the app files once.
- **Daily Notifications:** Scheduled Cloud Function running once a day on the provider's servers, independent of device connectivity.

---

## Milestones

### 📅 Milestone 1: Core Framework, PWA & Localization Setup
**Objective:** Set up the codebase, install required dependencies, implement Arabic (RTL) typography with mobile-first patterns, configure the Oxygen Gym theme, establish the shared login authentication page, and build the persistent supervisor selection mechanism.

- [x] **Task 1.1: Project Scaffold & Dependencies**
  - Scaffold React with Vite and TypeScript.
  - Install Tailwind CSS, `lucide-react`, and configure RTL support via CSS `direction: rtl` and custom Tailwind classes.
  - Install and configure `vite-plugin-pwa` for offline manifest and service worker.
  - Configure mobile-first responsive breakpoints and bottom-sheet primitives.
- [x] **Task 1.2: Theme & Visual Identity Setup**
  - Configure Tailwind with the Oxygen Gym color palette:
    - Primary/Accent: Red (`#E53E3E` or `#C53030`)
    - Dark/Background: Deep Black (`#1A1A1A`, `#121212`)
    - Neutrals: Silver/Metallic Gray (`#A0AEC0`, `#E2E8F0`), White (`#FFFFFF`)
  - Import a clean Arabic font (e.g., Cairo or Tajawal) from Google Fonts and set it as the default font.
- [x] **Task 1.3: Authentication & Supervisor Selection**
  - Implement a simple, secure shared login page (single username and password shared among supervisors).
  - Implement a persistent supervisor selection modal/dropdown. Since there is no multi-user credential system, when an action is performed, the supervisor must choose their name from a pre-defined list.
  - Store the selected supervisor in local storage / session state to auto-fill actions, with an easy shortcut to switch supervisor.
- [x] **Task 1.4: Base Navigation & Layout**
  - Implement the main bottom-navigation bar (or responsive sidebar) in Arabic containing the four main sections:
    1. **الرئيسية (Dashboard)**
    2. **قائمة الأعضاء (Members List)**
    3. **سجل النشاطات (Activity Log)**
    4. **لوحة التحكم (Admin Page)**
  - Ensure navigation and touch targets are optimized for mobile-first use.

---

### 📅 Milestone 2: Offline-First Database Layer & Local Sync
**Objective:** Model the database schema, set up local indexing/caching to allow 100% offline CRUD operations, and establish automatic background syncing with "Last Write Wins" conflict resolution.

- [x] **Task 2.1: Data Modeling & Schema Design**
  - Establish TS interfaces & DB schemas for:
    - **Member (العضو):** `id`, `name`, `gender` (men/women), `phone`, `goal` (optional), `notes` (optional), `first_registration_date`, `status` (active/expired/frozen).
    - **Subscription (الاشتراك):** `id`, `member_id`, `type_id`, `start_date`, `end_date`, `base_price`, `actual_price`, `duration_days`, `status`.
    - **Payment (الدفعة):** `id`, `subscription_id`, `amount`, `date`, `supervisor_name`.
    - **Freeze (التجميد):** `id`, `subscription_id`, `start_date`, `duration_days` (or null if open-ended), `end_date`, `actual_unfreeze_date`, `supervisor_name`.
    - **ActivityLog (سجل النشاطات):** `id`, `action_type`, `description`, `supervisor_name`, `timestamp`, `entity_id`.
    - **SubscriptionType (أنواع الاشتراكات):** `id`, `name`, `price_men`, `price_women`.
  - Seed default subscription types per PRD:
    - Visit (single day): 10,000 / 10,000
    - Intermittent (3 days/week, 1 month): 50,000 / 75,000
    - Monthly: 75,000 / 100,000
    - Private (monthly): 100,000 / 150,000
- [x] **Task 2.2: Offline Storage Engine Setup**
  - Integrate LocalStorage, IndexedDB, or Firebase/Supabase offline SDK to allow local CRUD when offline.
  - Implement a synchronized service layer that writes changes locally first, queueing operations when offline.
- [x] **Task 2.3: Background Sync and "Last Write Wins" Sync**
  - Configure automatic synchronization when the browser goes online (`window.addEventListener('online', ...)`).
  - Use "Last Write Wins" logic to update the master remote database without blocking supervisor flows.

---

### 📅 Milestone 3: Member Profiles, Registration & Smart Search
**Objective:** Create the members list page with custom search and filtering, implement the registration bottom sheet with automated duplicate checking, and build member details views with renewal tracking.

- [x] **Task 3.1: Members Directory View**
  - Build a high-performance grid/list display for members in Arabic, mobile-first optimized.
  - Implement color-coding status indicators: Green for active subscriptions, Gray for expired, Blue/Yellow for frozen.
  - Implement client-side filtering by gender (ذكور / إناث), status (نشط / منتهي / مجمد), and subscription type.
- [x] **Task 3.2: Smart Arabic Search & Duplicate Detection**
  - Build a search input that searches by name or phone number in Arabic (ignoring common Arabic diacritics and Alef variations if possible).
  - Create the registration dialog as a **Bottom Sheet on mobile** and a standard modal on desktop.
  - Implement **Smart Lookup**: As the supervisor types a name/phone number, check against expired members. If a match is found, prompt: "هل هذا العضو مسجل سابقاً؟" (Is this member previously registered?).
  - If confirmed, reactivate the existing member profile and keep their previous history, rather than duplicating the record.
- [x] **Task 3.3: Member Profile Page & Subscription History**
  - Design a detailed page for each member displaying:
    - Personal info, status, active debt details, and custom notes.
    - Tabular subscription history (showing start date, end date, payments, and freeze logs).
    - Direct "تجديد الاشتراك" (Renew Subscription) button on the profile, with option to adjust type or price at renewal.
  - Ensure no data is ever auto-deleted; deletion is manual only at supervisor discretion.

---

### 📅 Milestone 4: Subscriptions, Debts, & Payments
**Objective:** Implement standard and custom subscription periods, custom prices, automatic debt computation, and partial/multiple debt payments.

- [x] **Task 4.1: Subscription Creation Logic (Standard & Custom)**
  - Integrate standard subscription tiers into the checkout/registration flow (accessible from both Dashboard and Members List via bottom sheet on mobile).
  - **Custom Duration:** Allow entering custom durations (e.g., 6 months). Automatically compute the recommended price proportionally based on the base monthly rate.
  - **Custom Price:** Add a checkbox (off by default) to override the calculated price. If checked, show an input field for a custom rate; remaining balance is computed from that price.
  - No minimum payment required at registration; subscription starts immediately.
- [x] **Task 4.2: Debt Calculation & Payment Tracking**
  - Automatically calculate debt: `Debt = Subscription Price - Total Paid`.
  - Allow initial payments to be 0 or any partial amount. The subscription starts immediately.
  - Clearly display current debt on member cards and profiles in Red.
  - No automatic action (freezing/blocking) on non-payment; only display debt status clearly.
- [x] **Task 4.3: Log Outstanding Debts & Payments**
  - Build a dialog (bottom sheet on mobile) for logging payments against an existing debt.
  - Support multiple partial payments over time without any mandatory schedule.
  - Log each payment under the `Payments` table with the supervisor's name.

---

### 📅 Milestone 5: Subscription Freeze & Extension
**Objective:** Build fixed-duration and open-ended subscription freezing, unfreezing workflows, and automatic end-date calculations.

- [x] **Task 5.1: Freeze Form & Configurations**
  - Add a "تجميد الاشتراك" (Freeze Subscription) option on active subscriptions.
  - Implement two modes:
    1. **Fixed Duration (مدة محددة):** Supervisor enters days or months/days; freeze lifts automatically at period end, with option to unfreeze manually before then.
    2. **Open-Ended Freeze (مفتوح):** No return date is specified; subscription remains frozen until manually resumed.
- [x] **Task 5.2: Unfreeze Workflows & End-date Calculation**
  - Provide a quick "إلغاء التجميد" (Unfreeze) action on frozen member profiles (manual or automatic on period end).
  - Automatically calculate the extension: When unfreezing, calculate the exact number of days spent in freeze, and extend the subscription's `end_date` by that precise amount of days to ensure the member gets their full paid duration.

---

### 📅 Milestone 6: Dashboard (Home Screen) & Activity Log
**Objective:** Create the landing dashboard with expiring subscription trackers, pending debt lists, quick actions, and build the detailed activity log.

- [x] **Task 6.1: Dashboard Quick Alerts**
  - Build a section for **اشتراكات تنتهي اليوم** (Subscriptions expiring today).
  - Build sections grouped for subscriptions expiring in 2 days and 3 days.
  - Include quick-renew buttons directly next to expiring members (triggering bottom sheet on mobile).
- [x] **Task 6.2: Outstanding Debt Board**
  - Build a list displaying all **الديون المستحقة** (Outstanding Debts), sorted from oldest to newest.
  - Add quick action buttons next to each debt item to log a payment instantly.
  - Add quick shortcuts: "تسجيل عضو جديد", "إدارة الأسعار" (triggering bottom sheets on mobile).
- [x] **Task 6.3: Chronological Activity Log**
  - Implement the `Activity Log` page, displaying a full list of all logged events from most recent to oldest, covering:
    - New member registration, subscription renewal, payment collection, editing member info, editing prices, deleting member/subscription, freezing/unfreezing.
  - Each log entry must show:
    - Log type icon & detailed Arabic text (e.g., "تم تسجيل عضو جديد: محمد ياسين").
    - The responsible supervisor's name.
    - Timestamp (date and time) in a clear, formatted Arabic margin.
  - Ensure any subscription creation, renewal, payment, deletion, or freeze/unfreeze actions write to this log automatically.

---

### 📅 Milestone 7: Admin Panel, Backup Operations, & Polish
**Objective:** Build the admin page for managing subscription types, implement automatic and manual backup features, run cloud function daily alerts (mocked or scheduled), and compile a beautiful final PWA.

- [x] **Task 7.1: Admin Panel & Confirmation Safeguards**
  - Build the Admin interface (accessible to any supervisor, no extra protection) to view, edit, and add subscription types with standard male/female prices.
  - Add a mandatory double-confirmation popup window: "هل أنت متأكد من حفظ تغييرات الأسعار؟" (Are you sure you want to save price modifications?) before applying changes.
  - Log price updates in the activity log.
- [x] **Task 7.2: Automatic & Manual Backup System**
  - **Manual Backup:** Implement JSON/CSV export button to download the entire IndexedDB/local state database as a file. Implement an Import button to restore data from a previously downloaded backup.
  - **Automatic Backup:** Implement a weekly automatic background backup saved to local storage or offline file.
- [x] **Task 7.3: Scheduled Alerts (Cloud Function Architecture)**
  - Document/scaffold the daily notification schedule task (Cloud Function). It runs on the provider's servers once a day to evaluate expiring memberships and trigger supervisor alerts, independent of device connectivity.
- [x] **Task 7.4: Styling Refinements & Build Verification**
  - Review Arabic translations across the app to ensure Modern Standard Arabic accuracy.
  - Apply professional, modern dark-mode inspired UI using Red, Black, and Silver gradients; ensure mobile-first polish.
  - Verify full build (`npm run build`), service worker behavior, and PWA installability.

---

## Progress Tracking
Keep track of progress by updating the checkboxes above as features are delivered and validated.
