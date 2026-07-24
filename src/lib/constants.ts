export interface AdminAccount {
  username: string
  password: string
  /** Supervisor name(s) this account can use. */
  supervisors: string[]
}

export const ADMIN_ACCOUNTS: AdminAccount[] = [
  { username: 'o2gym',    password: 'o2gym1125', supervisors: ['طارق', 'رامي'] },
  { username: 'coach w 1', password: 'w1o2gym',    supervisors: ['مشرف ن1'] },
  { username: 'coach w 2', password: 'w2o2gym',    supervisors: ['مشرف ن2'] },
]

export const STORAGE_KEYS = {
  loggedIn: 'oxygen_logged_in',
  supervisor: 'oxygen_supervisor',
  account: 'oxygen_account',
}

export const SUPERVISORS = ['طارق', 'رامي', 'مشرف ن1', 'مشرف ن2']
