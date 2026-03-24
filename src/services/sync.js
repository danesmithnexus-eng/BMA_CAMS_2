import { Network } from '@capacitor/network'
import { Capacitor } from '@capacitor/core'
import api from './api'
import {
  getPendingRequests,
  markRequestDone,
  incrementRequestRetry,
  removeProcessedRequests,
  getPendingAnswerAssignmentIds,
  getOfflineAnswers,
  markAnswersSynced,
  updateCachedAssignmentStatus
} from './db'

let syncing = false
let started = false

// ── Check if the DB is usable before attempting any sync ─────────────────────
// On web, jeep-sqlite must be in the DOM. If it's not ready yet, skip silently.
function isDbAvailable() {
  if (Capacitor.getPlatform() !== 'web') return true
  return !!document.querySelector('jeep-sqlite')
}

// ── Generic pending_requests queue ───────────────────────────────────────────

async function processOne(req) {
  const method = (req.method || 'GET').toLowerCase()
  const url = req.url
  const body = req.body ? JSON.parse(req.body) : undefined
  const headers = req.headers ? JSON.parse(req.headers) : undefined
  try {
    await api.request({ method, url, data: body, headers })
    await markRequestDone(req.id)
    return true
  } catch (e) {
    await incrementRequestRetry(req.id)
    return false
  }
}

async function syncPendingRequests() {
  let batch = await getPendingRequests(50)
  while (Array.isArray(batch) && batch.length > 0) {
    for (const req of batch) {
      await processOne(req)
    }
    await removeProcessedRequests()
    batch = await getPendingRequests(50)
  }
}

// ── Offline exam answers 

async function syncOfflineAnswers() {
  const assignmentIds = await getPendingAnswerAssignmentIds()
  if (!assignmentIds.length) return

  console.log(`[Sync] Syncing offline answers for ${assignmentIds.length} assignment(s)...`)

  for (const assignmentId of assignmentIds) {
    try {
      const answers = await getOfflineAnswers(assignmentId)
      if (!answers.length) continue

      // Start exam on server (may already be started — ignore errors)
      try { await api.patch(`/student-exam-assignments/${assignmentId}/start`) } catch (_) { }

      // Push each answer
      for (const row of answers) {
        try {
          await api.post('/student-answers', {
            assignment_id: Number(assignmentId),
            question_id: Number(row.question_id),
            answer_value: row.answer_value
          })
        } catch (e) {
          console.warn(`[Sync] Answer q${row.question_id} failed:`, e?.response?.data?.message || e.message)
        }
      }

      // Mark complete on server
      try { await api.patch(`/student-exam-assignments/${assignmentId}/complete`, { score: 0 }) } catch (_) { }

      // Mark local records as synced
      await markAnswersSynced(assignmentId)
      await updateCachedAssignmentStatus(assignmentId, 'Completed')

      console.log(`[Sync] Assignment ${assignmentId} synced successfully.`)
    } catch (e) {
      console.error(`[Sync] Failed to sync assignment ${assignmentId}:`, e)
    }
  }
}

// ── Main entry points 

export async function syncAll() {
  // Don't attempt sync if the DB isn't ready (web platform, jeep-sqlite not mounted)
  if (!isDbAvailable()) {
    console.warn('[Sync] DB not available yet — skipping sync')
    return
  }

  if (syncing) return
  syncing = true
  try {
    await syncPendingRequests()
    await syncOfflineAnswers()
  } catch (e) {
    console.error('[Sync] syncAll error:', e)
  } finally {
    syncing = false
  }
}

// Keep the old export name working so nothing else breaks
export const syncPendingRequestsCompat = syncAll

export async function startSyncListener() {
  if (started) return
  started = true

  try {
    const status = await Network.getStatus()
    if (status.connected) {
      // On web: defer first sync until jeep-sqlite is confirmed ready
      if (Capacitor.getPlatform() === 'web') {
        await customElements.whenDefined('jeep-sqlite')
        // Extra tick so jeep-sqlite finishes its own async init
        await new Promise(r => setTimeout(r, 300))
      }
      await syncAll()
    }
  } catch (e) {
    console.warn('[Sync] startSyncListener initial sync failed:', e)
  }

  Network.addListener('networkStatusChange', async (s) => {
    if (s.connected) {
      console.log('[Sync] Network restored — running sync...')
      await syncAll()
    }
  })
}