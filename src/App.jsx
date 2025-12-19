import './App.css'
import { useEffect, useMemo, useState } from 'react'
import { MonthLineChart } from './components/MonthLineChart.jsx'
import { useWarehouseRetailSalesAggregates } from './data/useWarehouseRetailSales.js'
import { isFirebaseAuthConfigured, signInEmailPassword, signUpEmailPassword } from './lib/firebaseAuthRest.js'
import { isFirestoreConfigured, writeVoteToFirestore } from './lib/firestoreRest.js'

const DATA_SOURCE_URL = 'https://catalog.data.gov/dataset/warehouse-and-retail-sales'
const DATASET_LABEL = 'Warehouse and Retail Sales (Montgomery County, MD)'

const AUTH_STORAGE_KEY = 'unit3quiz.auth'
const VOTE_STORAGE_KEY = 'unit3quiz.vote'

function monthName(m) {
  const names = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ]
  return names[m - 1] || `Month ${m}`
}

function monthShort(m) {
  return monthName(m).slice(0, 3)
}

function formatNumber(n) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(n)
}

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

function App() {
  const { rows, itemTypes, status, error } = useWarehouseRetailSalesAggregates()

  const [selectedDrug, setSelectedDrug] = useState('ALL')
  const [metric, setMetric] = useState('totalSales') // totalSales | retailSales | warehouseSales

  const [vote, setVote] = useState(() => loadJson(VOTE_STORAGE_KEY, null))

  const [auth, setAuth] = useState(() => loadJson(AUTH_STORAGE_KEY, null))
  const [authMode, setAuthMode] = useState('signup') // signup | signin
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState(null)
  const [voteSaveError, setVoteSaveError] = useState(null)

  const firebaseAuthConfigured = isFirebaseAuthConfigured()
  const firestoreConfigured = isFirestoreConfigured()

  useEffect(() => {
    saveJson(AUTH_STORAGE_KEY, auth)
  }, [auth])

  useEffect(() => {
    saveJson(VOTE_STORAGE_KEY, vote)
  }, [vote])

  const monthly = useMemo(() => {
    const filtered =
      selectedDrug === 'ALL' ? rows : rows.filter((r) => r.itemType === selectedDrug)

    const byMonth = new Map()
    for (const r of filtered) {
      if (!Number.isFinite(r.year) || !Number.isFinite(r.month)) continue

      const key = `${r.year}-${String(r.month).padStart(2, '0')}`
      const prev = byMonth.get(key) || {
        key,
        year: r.year,
        month: r.month,
        retailSales: 0,
        warehouseSales: 0,
      }
      prev.retailSales += r.retailSales
      prev.warehouseSales += r.warehouseSales
      byMonth.set(key, prev)
    }

    return Array.from(byMonth.values()).sort(
      (a, b) => a.year - b.year || a.month - b.month,
    )
  }, [rows, selectedDrug])

  const chartData = useMemo(() => {
    return monthly.map((m) => {
      const totalSales = m.retailSales + m.warehouseSales
      const value =
        metric === 'retailSales'
          ? m.retailSales
          : metric === 'warehouseSales'
            ? m.warehouseSales
            : totalSales

      return {
        key: m.key,
        label: `${monthShort(m.month)} '${String(m.year).slice(-2)}`,
        fullLabel: `${monthName(m.month)} ${m.year}`,
        value,
      }
    })
  }, [monthly, metric])

  const kpis = useMemo(() => {
    const values = chartData.map((d) => d.value)
    const sum = values.reduce((acc, v) => acc + v, 0)
    const avg = values.length ? sum / values.length : 0
    const latest = values.length ? values[values.length - 1] : 0
    const range =
      monthly.length >= 2
        ? `${monthShort(monthly[0].month)} ${monthly[0].year} → ${monthShort(monthly[monthly.length - 1].month)} ${monthly[monthly.length - 1].year}`
        : '—'
    return { sum, avg, latest, range }
  }, [chartData, monthly])

  async function handleVote(stance) {
    setVoteSaveError(null)
    setVote({
      stance,
      at: new Date().toISOString(),
      itemType: selectedDrug,
      metric,
    })

    if (auth?.idToken && firestoreConfigured) {
      try {
        await writeVoteToFirestore({
          idToken: auth.idToken,
          email: auth.email,
          stance,
          context: {
            dataset: DATASET_LABEL,
            itemType: selectedDrug,
            metric,
          },
        })
      } catch (e) {
        setVoteSaveError(e instanceof Error ? e.message : 'Vote save failed')
      }
    }
  }

  async function handleAuthSubmit(e) {
    e.preventDefault()
    setAuthError(null)

    const trimmedEmail = email.trim()
    if (!trimmedEmail || !password) {
      setAuthError('Please enter an email and password.')
      return
    }

    setAuthBusy(true)
    try {
      if (firebaseAuthConfigured) {
        const fn = authMode === 'signin' ? signInEmailPassword : signUpEmailPassword
        const data = await fn({ email: trimmedEmail, password })
        setAuth({
          email: data.email || trimmedEmail,
          idToken: data.idToken,
          localId: data.localId,
        })
      } else {
        // Fallback (for when Firebase Auth isn't configured yet)
        setAuth({ email: trimmedEmail, idToken: 'local-demo', localId: 'local-demo' })
      }
    } catch (e2) {
      setAuthError(e2 instanceof Error ? e2.message : 'Authentication failed')
    } finally {
      setAuthBusy(false)
    }
  }

  return (
    <div className="page">
      <header className="header">
        <div className="titleRow">
          <h1 className="title">Unit 3 Quiz: “Drugs” by Month</h1>
          <div className="pillRow">
            <span className="pill">Dataset: {DATASET_LABEL}</span>
            <span className="pill">View: Monthly totals</span>
          </div>
        </div>
        <p className="subtitle">
          This page graphs the full dataset on one screen and lets you segment by “Drug” type.
          In this Data.gov source, the closest “drug” category is <b>ITEM TYPE</b> (WINE / LIQUOR /
          BEER / etc.), which we use as the segmentation control.
        </p>
      </header>

      <div className="grid">
        <section className="card">
          <div className="cardHeader">
            <div>
              <h2 className="cardTitle">Monthly Trend Chart</h2>
              <p className="cardSub">
                Choose a drug (item type) and metric. The chart updates instantly.
              </p>
            </div>
            <div className="controls">
              <div className="control">
                <div className="label">Drug (Item Type)</div>
                <select
                  className="select"
                  value={selectedDrug}
                  onChange={(e) => setSelectedDrug(e.target.value)}
                >
                  <option value="ALL">All drugs (all item types)</option>
                  {itemTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="control">
                <div className="label">Metric</div>
                <select
                  className="select"
                  value={metric}
                  onChange={(e) => setMetric(e.target.value)}
                >
                  <option value="totalSales">Total Sales (Retail + Warehouse)</option>
                  <option value="retailSales">Retail Sales</option>
                  <option value="warehouseSales">Warehouse Sales</option>
                </select>
              </div>
            </div>
          </div>

          <div className="cardBody">
            {status === 'loading' ? (
              <div className="notice">Loading dataset…</div>
            ) : status === 'error' ? (
              <div className="error">
                Couldn’t load the dataset. {error?.message ? <span>({error.message})</span> : null}
              </div>
            ) : null}

            <div className="kpiRow">
              <div className="kpi">
                <div className="kpiLabel">Total ({kpis.range})</div>
                <div className="kpiValue">{formatNumber(kpis.sum)}</div>
                <div className="kpiNote">Sum of selected metric</div>
              </div>
              <div className="kpi">
                <div className="kpiLabel">Monthly average</div>
                <div className="kpiValue">{formatNumber(kpis.avg)}</div>
                <div className="kpiNote">Average per month</div>
              </div>
              <div className="kpi">
                <div className="kpiLabel">Latest month</div>
                <div className="kpiValue">{formatNumber(kpis.latest)}</div>
                <div className="kpiNote">Most recent datapoint</div>
              </div>
            </div>

            <div className="chartWrap" style={{ marginTop: 12 }}>
              <MonthLineChart data={chartData} color="#7c5cff" />
            </div>

            <details style={{ marginTop: 12 }}>
              <summary style={{ cursor: 'pointer', color: 'rgba(255,255,255,0.80)' }}>
                View monthly totals table (aggregated)
              </summary>
              <table className="table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Retail Sales</th>
                    <th>Warehouse Sales</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {monthly.map((m) => (
                    <tr key={m.key}>
                      <td>
                        {monthName(m.month)} {m.year}
                      </td>
                      <td>{formatNumber(m.retailSales)}</td>
                      <td>{formatNumber(m.warehouseSales)}</td>
                      <td>{formatNumber(m.retailSales + m.warehouseSales)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </div>
        </section>

        <aside style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <section className="card">
            <div className="cardHeader">
              <div>
                <h2 className="cardTitle">Statement of Intent (Politician)</h2>
                <p className="cardSub">
                  My stance is based on the monthly “drug” (alcohol product) volume shown above.
                </p>
              </div>
            </div>
            <div className="cardBody">
              <p style={{ marginTop: 0, color: 'rgba(255,255,255,0.88)' }}>
                The chart shows consistently high monthly movement of alcohol products (a widely used
                drug) across multiple years. High volume and steady demand means we should treat
                substance harm as a <b>public health priority</b>, not just a personal issue.
              </p>
              <p style={{ color: 'rgba(255,255,255,0.88)' }}>
                <b>I support</b> funding prevention and treatment programs, strengthening responsible
                retail practices, and using data-driven policy (not guesswork) to reduce addiction,
                injuries, and overdose/poisoning outcomes.
              </p>

              <div className="notice" style={{ marginTop: 12 }}>
                Vote below if you support this stance. Registering (sign-up) counts as being
                “registered to vote” for this assignment.
              </div>
            </div>
          </section>

          <section className="card">
            <div className="cardHeader">
              <div>
                <h2 className="cardTitle">Register + Vote</h2>
                <p className="cardSub">
                  Support/Against buttons are available. If Firebase Auth isn’t configured yet, the
                  form still works in local demo mode.
                </p>
              </div>
            </div>
            <div className="cardBody">
              <div className="btnRow">
                <button className="btn btnPrimary" onClick={() => handleVote('support')}>
                  Support
                </button>
                <button className="btn btnDanger" onClick={() => handleVote('against')}>
                  Against
                </button>
              </div>

              {vote ? (
                <div className={vote.stance === 'support' ? 'success' : 'notice'} style={{ marginTop: 12 }}>
                  {vote.stance === 'support' ? (
                    <b>Thank you for your support.</b>
                  ) : (
                    <b>Thanks for participating.</b>
                  )}{' '}
                  Your vote was recorded on {new Date(vote.at).toLocaleString()}.
                </div>
              ) : null}

              {voteSaveError ? (
                <div className="notice" style={{ marginTop: 12 }}>
                  Vote saved locally, but Firestore write failed: <b>{voteSaveError}</b>
                </div>
              ) : null}

              <div style={{ marginTop: 12 }}>
                {auth?.email ? (
                  <div className="success">
                    Logged in as <b>{auth.email}</b>.{' '}
                    <button className="btn" style={{ marginLeft: 10 }} onClick={() => setAuth(null)}>
                      Log out
                    </button>
                    {!firebaseAuthConfigured ? (
                      <div style={{ marginTop: 8, color: 'rgba(255,255,255,0.78)' }}>
                        Note: Firebase Auth API key not found, so this is local demo mode.
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <form onSubmit={handleAuthSubmit}>
                    <div className="controls">
                      <div className="control" style={{ minWidth: 0, flex: 1 }}>
                        <div className="label">Email</div>
                        <input
                          className="input"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@example.com"
                          autoComplete="email"
                        />
                      </div>
                      <div className="control" style={{ minWidth: 0, flex: 1 }}>
                        <div className="label">Password</div>
                        <input
                          className="input"
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          autoComplete={
                            authMode === 'signin' ? 'current-password' : 'new-password'
                          }
                        />
                      </div>
                    </div>

                    <div className="btnRow" style={{ marginTop: 10 }}>
                      <button className="btn btnPrimary" type="submit" disabled={authBusy}>
                        {authBusy
                          ? 'Working…'
                          : authMode === 'signin'
                            ? 'Sign in'
                            : 'Sign up (Register)'}
                      </button>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => setAuthMode(authMode === 'signin' ? 'signup' : 'signin')}
                      >
                        Switch to {authMode === 'signin' ? 'Sign up' : 'Sign in'}
                      </button>
                    </div>

                    {authError ? (
                      <div className="error" style={{ marginTop: 12 }}>
                        {authError}
                      </div>
                    ) : null}

                    {!firebaseAuthConfigured ? (
                      <div className="notice" style={{ marginTop: 12 }}>
                        To enable real Firebase Auth (email/password), add{' '}
                        <b>VITE_FIREBASE_WEB_API_KEY</b> to your Vite env and enable Email/Password
                        in the Firebase Console.
                      </div>
                    ) : null}
                  </form>
                )}
              </div>

              {auth?.idToken && firestoreConfigured ? (
                <div className="pill" style={{ marginTop: 12 }}>
                  Firestore vote logging: enabled
                </div>
              ) : null}
            </div>
          </section>
        </aside>
      </div>

      <footer className="footer">
        <div>
          <b>Data source:</b> <a href={DATA_SOURCE_URL}>{DATA_SOURCE_URL}</a>
        </div>
        <div>
          <b>GitHub repo:</b>{' '}
          <a href={import.meta.env.VITE_GITHUB_URL || 'https://github.com/your-username/unit3quiz-v007-politics'}>
            {import.meta.env.VITE_GITHUB_URL || 'https://github.com/your-username/unit3quiz-v007-politics'}
          </a>{' '}
          (replace with your actual public repo URL)
        </div>
        <div style={{ color: 'rgba(255,255,255,0.55)' }}>
          Note: This UI uses the Socrata API to fetch a compact monthly aggregation (fast + reliable)
          instead of downloading all ~300k raw rows in the browser.
        </div>
      </footer>
    </div>
  )
}

export default App
