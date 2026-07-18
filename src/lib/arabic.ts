export function normalizeArabic(str: string): string {
  if (!str) return ''
  let s = str.trim().toLowerCase()

  const alefMap = ['أ', 'إ', 'آ', 'ٱ']
  for (const a of alefMap) {
    s = s.split(a).join('ا')
  }
  s = s.split('ى').join('ي')
  s = s.split('ؤ').join('و')
  s = s.split('ئ').join('ي')
  s = s.split('ة').join('ه')

  const arabicDiacritics = /[ؐ-ًؚ-ٰـ]/g
  s = s.replace(arabicDiacritics, '')

  s = s.replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim()

  return s
}

export function arabicIncludes(haystack: string, needle: string): boolean {
  if (!needle) return true
  return normalizeArabic(haystack).includes(normalizeArabic(needle))
}

export function arabicEquals(a: string, b: string): boolean {
  return normalizeArabic(a) === normalizeArabic(b)
}

/**
 * Subsequence matcher: returns true if every character of `needle` (in order,
 * not necessarily contiguous) appears in `haystack`. Used for fuzzy/typo-
 * tolerant member search so e.g. "مم" matches "محمد" (م .. م).
 *
 * An empty needle matches everything.
 */
export function isSubsequence(needle: string, haystack: string): boolean {
  if (!needle) return true
  let i = 0
  for (let j = 0; j < haystack.length && i < needle.length; j++) {
    if (haystack[j] === needle[i]) i++
  }
  return i === needle.length
}

/**
 * Counts how many single-character insertions/deletions/substitutions would
 * turn `a` into `b` (Levenshtein distance), restricted to short strings for
 * performance. Used to tolerate single-character typos in search.
 */
export function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m
  let prev = new Array<number>(n + 1)
  let curr = new Array<number>(n + 1)
  for (let j = 0; j <= n; j++) prev[j] = j
  for (let i = 1; i <= m; i++) {
    curr[0] = i
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
    }
    ;[prev, curr] = [curr, prev]
  }
  return prev[n]
}

/**
 * Fuzzy / typo-tolerant Arabic search.
 *
 * A member name matches the query if, after Arabic normalization:
 *   1. It contains the query as a contiguous substring (exact-ish), OR
 *   2. The normalized query appears as a subsequence of the normalized name
 *      (e.g. "مم" → "محمد"), OR
 *   3. It is within a small edit distance (typo tolerance). The allowed
 *      distance scales with the name length so a one-letter typo never
 *      causes zero results but very short queries stay strict.
 *
 * The query is matched against the name only here; callers may also pass a
 * combined haystack (e.g. name + phone) by building their own.
 */
export function fuzzyArabicIncludes(haystackRaw: string, needleRaw: string): boolean {
  const needle = normalizeArabic(needleRaw)
  if (!needle) return true
  const haystack = normalizeArabic(haystackRaw)

  // Fast path: contiguous substring.
  if (haystack.includes(needle)) return true

  // Subsequence match (letters in order, non-contiguous).
  if (isSubsequence(needle, haystack)) return true

  // Typo tolerance: allow a single wrong letter for reasonably-sized inputs.
  if (needle.length >= 2) {
    const allowed = haystack.length <= 4 ? 1 : 2
    if (levenshtein(haystack, needle) <= allowed) return true
  }

  return false
}
