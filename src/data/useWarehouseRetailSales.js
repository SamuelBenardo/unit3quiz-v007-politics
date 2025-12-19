import { useEffect, useMemo, useState } from 'react'

const SOCRATA_ENDPOINT = 'https://data.montgomerycountymd.gov/resource/v76h-r7br.json'

function safeNumber(value) {
  const n = Number.parseFloat(value)
  return Number.isFinite(n) ? n : 0
}

/**
 * Fetches a compact, server-aggregated monthly dataset from Socrata:
 * group by YEAR + MONTH + ITEM TYPE and sum retail/warehouse sales.
 *
 * This keeps the UI fast (we avoid downloading ~300k raw rows).
 */
export function useWarehouseRetailSalesAggregates() {
  const [rows, setRows] = useState([])
  const [status, setStatus] = useState('idle') // idle | loading | success | error
  const [error, setError] = useState(null)

  useEffect(() => {
    const controller = new AbortController()

    async function run() {
      try {
        setStatus('loading')
        setError(null)

        const params = new URLSearchParams({
          $select:
            'calendar_year,cal_month_num,item_type,sum(rtl_sales) as retail_sales,sum(whs_sales) as warehouse_sales',
          $group: 'calendar_year,cal_month_num,item_type',
          $order: 'calendar_year asc, cal_month_num asc, item_type asc',
          $limit: '50000',
        })

        const res = await fetch(`${SOCRATA_ENDPOINT}?${params.toString()}`, {
          signal: controller.signal,
        })
        if (!res.ok) {
          throw new Error(`Data fetch failed (${res.status})`)
        }
        const json = await res.json()

        const normalized = json.map((r) => ({
          year: Number.parseInt(r.calendar_year, 10),
          month: Number.parseInt(r.cal_month_num, 10),
          itemType: (r.item_type || 'UNKNOWN').trim(),
          retailSales: safeNumber(r.retail_sales),
          warehouseSales: safeNumber(r.warehouse_sales),
        }))

        setRows(normalized)
        setStatus('success')
      } catch (e) {
        if (e?.name === 'AbortError') return
        setError(e instanceof Error ? e : new Error('Unknown error'))
        setStatus('error')
      }
    }

    run()
    return () => controller.abort()
  }, [])

  const itemTypes = useMemo(() => {
    const set = new Set()
    for (const r of rows) set.add(r.itemType)
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [rows])

  return { rows, itemTypes, status, error }
}


