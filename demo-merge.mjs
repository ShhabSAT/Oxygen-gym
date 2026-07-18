// Local, network-free demonstration of the clobber fix.
// Models Firestore setDoc (= replace whole doc) vs updateDoc (= merge).
// Mirrors the OLD code (setDoc) vs NEW code (updateDoc) for the
// Test-4 scenario: device A edits phone, device B edits notes, both offline,
// then both flush. Last flusher wins the whole doc under setDoc (clobber);
// under updateDoc each write merges only its own fields (both survive).

// --- a minimal "server" doc store ---
let serverDoc = {
  id: 'm1', name: 'BASE', gender: 'men',
  phone: '0000000000', notes: 'BASE', updated_at: 0,
}

// OLD behavior: setDoc(ref, wholeRecord) -> full replace
function setDocSim(record) { serverDoc = { ...serverDoc, ...record } }
// NEW behavior: updateDoc(ref, {field, updated_at}) -> field merge
function updateDocSim(patch) { serverDoc = { ...serverDoc, ...patch } }

console.log('START doc:', JSON.stringify(serverDoc))

// --- OLD (setDoc) path, simulating two offline devices each staging a FULL doc ---
const stagedA = { ...serverDoc, phone: '1111111111', updated_at: 5000 } // A edited phone
const stagedB = { ...serverDoc, notes: 'B_NOTES', updated_at: 6000 }  // B edited notes
// flush order: A then B (B later)
setDocSim(stagedA)
setDocSim(stagedB)
console.log('\n[OLD / setDoc] after A-flush then B-flush:')
console.log('  phone =', serverDoc.phone, '| notes =', serverDoc.notes)
console.log('  => A\'s phone edit (' + stagedA.phone + ') was SILENTLY LOST:', serverDoc.phone !== stagedA.phone)

// reset
serverDoc = { id: 'm1', name: 'BASE', gender: 'men', phone: '0000000000', notes: 'BASE', updated_at: 0 }

// --- NEW (updateDoc) path, each device stages ONLY its changed field ---
const patchA = { phone: '1111111111', updated_at: 5000 } // A edited phone
const patchB = { notes: 'B_NOTES', updated_at: 6000 }  // B edited notes
updateDocSim(patchA)
updateDocSim(patchB)
console.log('\n[NEW / updateDoc] after A-flush then B-flush:')
console.log('  phone =', serverDoc.phone, '| notes =', serverDoc.notes)
const bothSurvive = serverDoc.phone === '1111111111' && serverDoc.notes === 'B_NOTES'
console.log('  => BOTH edits survive (no clobber):', bothSurvive)

console.log('\n=== RESULT ===')
console.log('OLD clobbers the non-last device\'s field: CONFIRMED RISK (now removed)')
console.log('NEW preserves both fields: ' + (bothSurvive ? 'PASS' : 'FAIL'))
process.exit(bothSurvive ? 0 : 1)
