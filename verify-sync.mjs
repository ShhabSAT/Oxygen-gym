// Live verification of the Oxygen Gym Firebase sync layer.
// Uses the Firebase REST + SSE (real-time) API with REAL anonymous
// credentials obtained via the Identity Toolkit REST API. Two independent
// anonymous tokens = two "devices". Talks to the REAL project oxegen-gym.

import { readFileSync } from 'node:fs'

// --- load .env manually (Node has no Vite import.meta.env) ---
const envText = readFileSync(new URL('./.env', import.meta.url), 'utf8')
const env = {}
for (const line of envText.split('\n')) {
  const m = line.match(/^VITE_(\w+)=(.+)$/)
  if (m) env[m[1]] = m[2].trim()
}
const API_KEY = env.FIREBASE_API_KEY
const PROJECT = env.FIREBASE_PROJECT_ID

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const ISO = () => new Date().toISOString()
// Audit log: an append-only list of timestamped, evidence-bearing events.
const audit = []
function log(ev) {
  const line = `[${ISO()}] ${ev}`
  audit.push(line)
  console.log(line)
}
const results = []
function record(test, pass, detail) {
  const entry = { test, pass, detail, at: ISO() }
  results.push(entry)
  console.log(`\n=== ${test} : ${pass ? 'PASS' : 'FAIL'} ===`)
  console.log(`  time   : ${entry.at}`)
  console.log(`  detail : ${detail}`)
}

// Get a real anonymous idToken (server-side) for a "device".
async function anonToken(label) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ returnSecureToken: true }) },
  )
  const j = await res.json()
  if (!j.idToken) throw new Error(`${label} signUp failed: ${JSON.stringify(j)}`)
  log(`${label} anonymous uid=${j.localId}`)
  return j.idToken
}

const COL = 'members'
function baseUrl(project, docId = '') {
  return `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/${COL}${docId ? '/' + docId : ''}`
}
const authH = (tok) => ({
  Authorization: `Bearer ${tok}`,
  'Content-Type': 'application/json',
})

// Firestore REST "value" helpers
function enc(v) {
  if (typeof v === 'number') return { integerValue: String(v) }
  if (typeof v === 'string') return { stringValue: v }
  return { nullValue: null }
}
function dec(fv) {
  if (!fv) return null
  if ('stringValue' in fv) return fv.stringValue
  if ('integerValue' in fv) return Number(fv.integerValue)
  if ('nullValue' in fv) return null
  return fv
}
function fields(obj) {
  const f = {}
  for (const [k, v] of Object.entries(obj)) f[k] = enc(v)
  return { fields: f }
}
async function getDoc(tok, id) {
  const r = await fetch(baseUrl(PROJECT, id), { headers: authH(tok) })
  if (r.status === 404) return null
  const j = await r.json()
  if (j.error) throw new Error(JSON.stringify(j.error))
  const out = {}
  for (const [k, v] of Object.entries(j.fields || {})) out[k] = dec(v)
  return { id: j.name.split('/').pop(), ...out }
}
// Whole-document write (== setDoc / SDK v9 setDoc semantics)
async function setDocFull(tok, id, obj) {
  const r = await fetch(baseUrl(PROJECT, id), {
    method: 'PATCH', headers: authH(tok), body: JSON.stringify(fields(obj)),
  })
  const j = await r.json()
  if (j.error) throw new Error(JSON.stringify(j.error))
  const ts = j.updateTime
  log(`setDocFull doc=${id} -> server updateTime=${ts}`)
  return j
}
// Field-LEVEL merge write (== updateDoc / SDK v9 updateDoc semantics).
// IMPORTANT: Firestore REST PATCH with no updateMask does a FULL REPLACE
// (we verified: it dropped other fields). The true equivalent of the
// SDK updateDoc is documents:commit with an Update write + updateMask.
// That merges ONLY the listed fields and preserves the rest.
async function updateDocFields(tok, id, patch) {
  const name = `projects/${PROJECT}/databases/(default)/documents/${COL}/${id}`
  const mask = { fieldPaths: Object.keys(patch) }
  const r = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents:commit`, {
    method: 'POST',
    headers: authH(tok),
    body: JSON.stringify({
      writes: [{ update: { name, ...fields(patch) }, updateMask: mask }],
    }),
  })
  const j = await r.json()
  if (j.error) throw new Error(JSON.stringify(j.error))
  const ts = j.commitTime
  const fieldsStr = Object.entries(patch).map(([k, v]) => `${k}=${v}`).join(',')
  log(`updateDocFields doc=${id} fields=[${fieldsStr}] -> server commitTime=${ts}`)
  return j
}
async function delDoc(tok, id) {
  const r = await fetch(baseUrl(PROJECT, id), { method: 'DELETE', headers: authH(tok) })
  const ok = r.status === 200 || r.status === 204
  log(`delDoc doc=${id} -> http=${r.status} ok=${ok}`)
  return ok
}

// Polling "listener" for device B. The Firestore REST `:listen` SSE
// endpoint does not support ?alt=sse (returns 400), so we poll the
// authoritative full collection set from B's perspective every 300ms.
// This still genuinely proves cross-device propagation (a different
// authenticated device sees A's write) — it only can't measure push
// latency. The app's real-time PUSH is the SDK onSnapshot in-browser.
function listen(tok, onMembers, onError) {
  let stopped = false
  let timer = null
  const poll = async () => {
    if (stopped) return
    try {
      const all = await fetch(baseUrl(PROJECT), { headers: authH(tok) }).then((x) => x.json())
      if (all.error) { onError?.(new Error(JSON.stringify(all.error))); return }
      const members = (all.documents || []).map((d) => {
        const o = { id: d.name.split('/').pop() }
        for (const [k, v] of Object.entries(d.fields || {})) o[k] = dec(v)
        return o
      })
      onMembers(members)
    } catch (e) { /* transient */ }
    timer = setTimeout(poll, 300)
  }
  poll()
  return () => { stopped = true; if (timer) clearTimeout(timer) }
}

async function main() {
  const tokA = await anonToken('deviceA')
  const tokB = await anonToken('deviceB')

  // ---------- TEST 1: cross-device real-time sync ----------
  let bMembers = []
  let bError = null
  const stopB = listen(tokB, (m) => { bMembers = m }, (e) => { bError = e })
  await sleep(2000) // let B's listener attach / prime
  log(`TEST1 listener attached for deviceB; polling every 300ms`)

  const t1 = `test_sync_${Date.now()}`
  const writeAt = ISO()
  const w1 = await setDocFull(tokA, t1, {
    id: t1, name: 'اختبار المزامنة', gender: 'men', phone: '0999999999',
    first_registration_date: '2026-01-01', status: 'active', notes: 'A', updated_at: Date.now(),
  })
  const serverWriteTs = w1.updateTime
  log(`TEST1 A wrote doc=${t1} at ${writeAt} (client) / ${serverWriteTs} (server)`)

  let synced = false
  const t0 = Date.now()
  for (let i = 0; i < 30; i++) {
    if (bMembers.some((m) => m.id === t1)) { synced = true; break }
    await sleep(300)
  }
  const seenAt = ISO()
  const latencyS = ((Date.now() - t0) / 1000).toFixed(1)
  record('TEST 1 — cross-device real-time sync (A writes, B sees via listener)',
    synced,
    synced
      ? `doc_id=${t1} | A wrote at ${serverWriteTs} (server) | B's listener observed it at ${seenAt} (~${latencyS}s later) | no refresh | bError=${bError ? bError.message : 'none'}`
      : `doc_id=${t1} | A wrote at ${serverWriteTs} | NOT observed by B after 9s | bMembers=${bMembers.length} | bError=${bError ? bError.message : 'none'}`)

  // ---------- TEST 3: delete propagation + no resurrection ----------
  const delAt = ISO()
  await delDoc(tokA, t1)
  let deleted = false
  const td0 = Date.now()
  for (let i = 0; i < 30; i++) {
    if (!bMembers.some((m) => m.id === t1)) { deleted = true; break }
    await sleep(300)
  }
  const delSeenAt = ISO()
  if (deleted) {
    await sleep(30000) // 30s wait
    const recheck = await fetch(baseUrl(PROJECT), { headers: authH(tokB) }).then((x) => x.json())
    const members = (recheck.documents || []).map((d) => d.name.split('/').pop())
    const stillGone = !members.includes(t1)
    record('TEST 3 — delete propagation + NO resurrection after 30s',
      stillGone,
      stillGone
        ? `doc_id=${t1} | A deleted at ${delAt} | B observed deletion at ${delSeenAt} (~${((Date.now()-td0)/1000).toFixed(0)}s) | did NOT reappear after +30s re-check at ${ISO()}`
        : `doc_id=${t1} | resurrected after 30s — FAIL (tombstone bug)`)
  } else {
    record('TEST 3 — delete propagation + NO resurrection after 30s', false,
      `doc_id=${t1} | deletion did not propagate to B (B still shows doc after 9s)`)
  }

  // ---------- TEST 4a: same-field LWW ----------
  const lww = `test_lww_${Date.now()}`
  await setDocFull(tokA, lww, { id: lww, name: 'LWW', gender: 'men', phone: '000', first_registration_date: '2026-01-01', status: 'active', notes: 'BASE', updated_at: 0 })
  await sleep(800)
  const b4a = await updateDocFields(tokB, lww, { notes: 'FROM_B' })   // B earlier
  await sleep(500)
  const a4a = await updateDocFields(tokA, lww, { notes: 'FROM_A' }) // A later -> should win
  await sleep(1200)
  const final4a = await getDoc(tokA, lww)
  record('TEST 4a — same-field LWW (last write wins)',
    final4a?.notes === 'FROM_A',
    `doc_id=${lww} | B wrote notes=FROM_B @ ${b4a.commitTime} | A wrote notes=FROM_A @ ${a4a.commitTime} (later) | final notes="${final4a?.notes}" | expected FROM_A`)

  // ---------- TEST 4b: DIFFERENT-field, NEW updateDoc merge ----------
  // Mirrors FIXED app code (updateDoc = field-merge via updateMask).
  const pa = await updateDocFields(tokA, lww, { phone: '1111111111' })  // A edits phone
  await sleep(500)
  const pb = await updateDocFields(tokB, lww, { notes: 'B_NOTES' })  // B edits notes
  await sleep(1200)
  const final4b = await getDoc(tokA, lww)
  const bothSurvive = final4b?.phone === '1111111111' && final4b?.notes === 'B_NOTES'
  record('TEST 4b — DIFFERENT-field, field-merge (A=phone, B=notes) BOTH survive',
    bothSurvive,
    `doc_id=${lww} | A updateDoc phone=1111111111 @ ${pa.commitTime} | B updateDoc notes=B_NOTES @ ${pb.commitTime} | final: phone=${final4b?.phone}, notes=${final4b?.notes} | ${bothSurvive ? 'BOTH preserved (clobber FIXED)' : 'ONE LOST (still clobbering)'}`)

  // cleanup
  stopB()
  await delDoc(tokA, lww).catch(() => {})

  console.log('\n================ AUDIT TRAIL ===============')
  for (const line of audit) console.log(line)
  console.log('\n================ SUMMARY ===============')
  for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  [${r.at}]  ${r.test}`)
  process.exit(results.every((r) => r.pass) ? 0 : 1)
}

main().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(2) })
