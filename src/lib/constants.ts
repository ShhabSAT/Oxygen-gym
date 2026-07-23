export interface AdminAccount {
  username: string
  password: string
  /** Supervisor name(s) this account can use. */
  supervisors: string[]
}

export const ADMIN_ACCOUNTS: AdminAccount[] = [
  { username: 'admin', password: 'oxygen123', supervisors: ['طارق', 'رامي'] },
  { username: 'n1',    password: 'n1_oxygen',  supervisors: ['مشرف ن1'] },
  { username: 'n2',    password: 'n2_oxygen',  supervisors: ['مشرف ن2'] },
]

export const STORAGE_KEYS = {
  loggedIn: 'oxygen_logged_in',
  supervisor: 'oxygen_supervisor',
  account: 'oxygen_account',
}

export const SUPERVISORS = ['طارق', 'رامي', 'مشرف ن1', 'مشرف ن2']
