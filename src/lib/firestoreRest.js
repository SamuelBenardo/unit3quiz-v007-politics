function getProjectId() {
  return import.meta.env.VITE_FIREBASE_PROJECT_ID || ''
}

export function isFirestoreConfigured() {
  return Boolean(getProjectId())
}

export async function writeVoteToFirestore({ idToken, email, stance, context }) {
  const projectId = getProjectId()
  if (!projectId) throw new Error('Firestore not configured (missing project id)')

  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/votes`

  const body = {
    fields: {
      stance: { stringValue: stance },
      email: { stringValue: email || 'unknown' },
      dataset: { stringValue: context?.dataset || '' },
      itemType: { stringValue: context?.itemType || '' },
      metric: { stringValue: context?.metric || '' },
      createdAt: { timestampValue: new Date().toISOString() },
    },
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(body),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = data?.error?.message || `Firestore write failed (${res.status})`
    throw new Error(msg)
  }
  return data
}


