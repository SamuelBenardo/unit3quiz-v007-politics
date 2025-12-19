const ID_TOOLKIT = 'https://identitytoolkit.googleapis.com/v1'

function getApiKey() {
  return (
    import.meta.env.VITE_FIREBASE_WEB_API_KEY ||
    import.meta.env.VITE_FIREBASE_API_KEY ||
    ''
  )
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = data?.error?.message || `Request failed (${res.status})`
    throw new Error(msg)
  }
  return data
}

export function isFirebaseAuthConfigured() {
  return Boolean(getApiKey())
}

export async function signUpEmailPassword({ email, password }) {
  const apiKey = getApiKey()
  if (!apiKey) throw new Error('Firebase auth is not configured (missing API key)')

  return await postJson(`${ID_TOOLKIT}/accounts:signUp?key=${apiKey}`, {
    email,
    password,
    returnSecureToken: true,
  })
}

export async function signInEmailPassword({ email, password }) {
  const apiKey = getApiKey()
  if (!apiKey) throw new Error('Firebase auth is not configured (missing API key)')

  return await postJson(`${ID_TOOLKIT}/accounts:signInWithPassword?key=${apiKey}`, {
    email,
    password,
    returnSecureToken: true,
  })
}


