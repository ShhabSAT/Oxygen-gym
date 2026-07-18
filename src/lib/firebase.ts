import { initializeApp, type FirebaseApp } from 'firebase/app'
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
  CACHE_SIZE_UNLIMITED,
} from 'firebase/firestore'
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  type Auth,
} from 'firebase/auth'

/* ------------------------------------------------------------------
 * Firebase config is read from environment variables (see .env).
 * Only variables prefixed with VITE_ are exposed to the client bundle.
 * To rotate credentials, edit .env (or .env.example for a template).
 * ------------------------------------------------------------------ */

function readConfig() {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID
  const appId = import.meta.env.VITE_FIREBASE_APP_ID

  if (!apiKey || !projectId || !appId) {
    throw new Error(
      'Firebase config is missing. Copy .env.example to .env and fill in the ' +
        'VITE_FIREBASE_* values from your Firebase project settings.',
    )
  }

  return {
    apiKey,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? `${projectId}.firebaseapp.com`,
    projectId,
    storageBucket:
      import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? `${projectId}.appspot.com`,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
    appId,
  }
}

export const firebaseConfig = readConfig()

export const firebaseApp: FirebaseApp = initializeApp(firebaseConfig)

/* ------------------------------------------------------------------
 * Firestore with BUILT-IN offline persistence.
 *
 * We use the modern `persistentLocalCache` API (Firestore SDK 9+/10),
 * which stores data in IndexedDB under the hood. This is a SINGLE source
 * of truth: the app ONLY reads/writes through Firestore. We deliberately
 * removed the old `idb`-based custom store so there is no second local
 * database that could drift out of sync.
 *
 * `persistentMultipleTabManager` lets multiple tabs/windows share the
 * same cache (needed so two browser windows behave like two devices).
 *
 * Writes made while offline are queued by Firestore itself and flushed
 * automatically on reconnect — no custom sync queue is used.
 * ------------------------------------------------------------------ */

export const db: Firestore = initializeFirestore(firebaseApp, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
    cacheSizeBytes: CACHE_SIZE_UNLIMITED,
  }),
})

// Diagnostic: confirm persistence initialised without error.
if (typeof window !== 'undefined') {
  console.log('[firebase] Firestore initialized with persistentLocalCache + multipleTabManager')
  // Enable debug logging for writes so we can see when a write is queued
  // locally vs. when it flushes to the server. Uncomment for diagnosis.
  // import {setLogLevel} from 'firebase/firestore'; setLogLevel('debug');
}

/* Collection name constants — map 1:1 to the old IndexedDB object stores. */
export const COLLECTIONS = {
  members: 'members',
  subscriptions: 'subscriptions',
  payments: 'payments',
  freezes: 'freezes',
  activityLog: 'activityLog',
  subscriptionTypes: 'subscriptionTypes',
} as const

/* ------------------------------------------------------------------
 * AUTHENTICATION (Anonymous)
 *
 * The app uses a single shared login (its own in-app auth screen), so we
 * authenticate to Firebase with Anonymous Auth. This gives each client a
 * stable Firebase UID, satisfying the Security Rules' `request.auth != null`
 * requirement without forcing end users to manage Firebase credentials.
 *
 * `signInAnonymously` is idempotent-ish: if a user is already signed in we
 * keep the existing session. We expose a promise that resolves once auth
 * is ready so the app can delay Firestore reads/writes until signed in
 * (otherwise rule `request.auth != null` rejects them).
 * ------------------------------------------------------------------ */

export const auth: Auth = getAuth(firebaseApp)

let authReadyPromise: Promise<void> | null = null

export function whenAuthReady(): Promise<void> {
  if (authReadyPromise) return authReadyPromise
  authReadyPromise = new Promise<void>((resolve) => {
    // If already signed in, resolve immediately.
    if (auth.currentUser) {
      resolve()
      return
    }
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        unsub()
        resolve()
      }
    })
    // Kick off anonymous sign-in.
    void signInAnonymously(auth).catch(() => {
      // Even on failure, resolve so the app can surface the error via the
      // Firestore request (rules will reject) rather than hanging forever.
      unsub()
      resolve()
    })
  })
  return authReadyPromise
}
