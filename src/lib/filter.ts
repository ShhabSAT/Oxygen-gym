import type { Member } from '../types'

const RESTRICTED = ['مشرف ن1', 'مشرف ن2']

/**
 * Whether the given supervisor is allowed to see the given member.
 *
 * - طارق / رامي → see everyone (male & female, any supervisor).
 * - مشرف ن1 / مشرف ن2 → only female members *they* registered.
 *   Legacy members (no `registered_by`) are visible to all supervisors.
 */
export function canSeeMember(member: Member, supervisor: string): boolean {
  if (!RESTRICTED.includes(supervisor)) return true

  // Restricted supervisors only see female members
  if (member.gender !== 'women') return false

  // Legacy members without registered_by are visible to everyone
  if (!member.registered_by) return true

  // Must match the registering supervisor
  return member.registered_by === supervisor
}

/**
 * Filter a list of members so the current supervisor only sees the
 * members they are allowed to see.
 */
export function filterVisibleMembers(
  members: Member[],
  supervisor: string,
): Member[] {
  return members.filter((m) => canSeeMember(m, supervisor))
}
