import React, { useState, useEffect, useRef, useMemo } from 'react'
import type { Loan } from '../hooks/useLoans'
import { buildAmortSchedule } from '../utils/amortEngine'
import type { AmortRow } from '../utils/amortEngine'

interface Props {
  loan: Loan | null
  open: boolean
  onClose: () => void
}

const EVENT_PRIORITY = ['default', 'deferral', 'prepayment']

const fmt$ = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })

const fmtMonthYear = (d: Date) =>
  d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

// ── Amort chart (SVG) ─────────────────────────────────────────────────────────
function AmortChart({ schedule, loan }: { schedule: AmortRow[]; loan: Loan }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<{ idx: number; x: number; y: number } | null>(null)

  const w = 480, h = 300, pad = 52

  const rows = useMemo(() => {
    let cumPrincipal = 0, cumInterest = 0
    return schedule.map(r => {
      cumPrincipal += r.scheduledPrincipal + r.prepaymentPrincipal
      cumInterest  += r.interest
      return {
        ...r,
        cumPrincipal: +cumPrincipal.toFixed(2),
        cumInterest:  +cumInterest.toFixed(2),
        cumTotal:     +(cumPrincipal + cumInterest).toFixed(2),
      }
    })
  }, [schedule])

  const allYs = rows.flatMap(r => [r.balance, r.cumPrincipal, r.cumInterest, r.cumTotal])
  const maxY  = Math.max(...allYs) * 1.15 || 1
  const minY  = 0
  const range = maxY - minY

  const stepX = (w - pad * 2) / Math.max(1, rows.length - 1)

  function toXY(y: number, i: number): [number, number] {
    const x = pad + i * stepX
    const cy = pad + (h - pad * 2) - ((y - minY) / range) * (h - pad * 2)
    return [x, cy]
  }

  function buildPath(vals: number[]): string {
    return vals.map((v, i) => {
      const [x, y] = toXY(v, i)
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    }).join(' ')
  }

  const today = new Date()
  const startDate = new Date(loan.loanStartDate + 'T00:00:00')
  const monthsDiff = (today.getFullYear() - startDate.getFullYear()) * 12
    + today.getMonth() - startDate.getMonth()
  const todayIdx = Math.min(Math.max(monthsDiff, 0), rows.length - 1)
  const todayX = pad + todayIdx * stepX

  const purchaseDate = new Date(loan.purchaseDate + 'T00:00:00')
  const purchaseMonthsDiff = (purchaseDate.getFullYear() - startDate.getFullYear()) * 12
    + purchaseDate.getMonth() - startDate.getMonth()
  const purchaseIdx = Math.min(Math.max(purchaseMonthsDiff, 0), rows.length - 1)
  const purchaseX = pad + purchaseIdx * stepX

  const yLabels = [0, 1, 2, 3, 4].map(i => ({
    val: minY + ((4 - i) / 4) * range,
    y: pad + i * ((h - pad * 2) / 4),
  }))

  const xLabels = [0, 1, 2, 3, 4].map(i => {
    const idx = Math.round((i / 4) * (rows.length - 1))
    const d = new Date(startDate)
    d.setMonth(d.getMonth() + (rows[idx]?.monthIndex ?? idx))
    return { label: fmtMonthYear(d), x: pad + idx * stepX }
  })

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const mouseX = ((e.clientX - rect.left) / rect.width) * w
    let best = Infinity, bestIdx = 0
    rows.forEach((_, i) => {
      const xAtI = pad + i * stepX
      if (Math.abs(mouseX - xAtI) < best) { best = Math.abs(mouseX - xAtI); bestIdx = i }
    })
    setHover({ idx: bestIdx, x: pad + bestIdx * stepX, y: e.clientY })
  }

  const hoverRow = hover !== null ? rows[hover.idx] : null
  const hoverDate = hoverRow
    ? (() => { const d = new Date(startDate); d.setMonth(d.getMonth() + (hoverRow.monthIndex - 1)); return fmtMonthYear(d) })()
    : ''

  const series = [
    { vals: rows.map(r => r.balance),      color: '#0f172a', width: 2.5 },
    { vals: rows.map(r => r.cumPrincipal), color: '#06b6d4', width: 1.8 },
    { vals: rows.map(r => r.cumInterest),  color: '#a78bfa', width: 1.8 },
    { vals: rows.map(r => r.cumTotal),     color: '#fb7185', width: 1.4 },
  ]

  return (
    <div style={{ position: 'relative' }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${w} ${h}`}
        width="100%"
        style={{ display: 'block', cursor: 'crosshair' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHover(null)}
      >
        {yLabels.map((l, i) => (
          <line key={i} x1={pad} x2={w - pad} y1={l.y} y2={l.y} stroke="#eef2f7" strokeWidth={1} />
        ))}
        {yLabels.map((l, i) => (
          <text key={i} x={pad - 6} y={l.y + 4} textAnchor="end" fontSize={10} fill="var(--muted)">
            ${Math.round(l.val).toLocaleString()}
          </text>
        ))}
        {xLabels.map((l, i) => (
          <text key={i} x={l.x} y={h - pad + 16} textAnchor="middle" fontSize={10} fill="var(--muted)">
            {l.label}
          </text>
        ))}
        {series.map((s, i) => (
          <path key={i} d={buildPath(s.vals)} fill="none" stroke={s.color} strokeWidth={s.width} />
        ))}
        <line x1={purchaseX} x2={purchaseX} y1={pad} y2={h - pad}
          stroke="#16a34a" strokeDasharray="3 4" strokeOpacity={0.8} strokeWidth={1.5} />
        <line x1={todayX} x2={todayX} y1={pad} y2={h - pad}
          stroke="#111827" strokeDasharray="3 4" strokeOpacity={0.5} strokeWidth={1} />
        {hover && hoverRow && (
          <>
            <line x1={hover.x} x2={hover.x} y1={pad} y2={h - pad}
              stroke="#0f172a" strokeDasharray="3 4" strokeOpacity={0.6} strokeWidth={1} />
            {[
              { val: hoverRow.balance,      color: '#0f172a' },
              { val: hoverRow.cumPrincipal, color: '#06b6d4' },
              { val: hoverRow.cumInterest,  color: '#a78bfa' },
              { val: hoverRow.cumTotal,     color: '#fb7185' },
            ].map((s, i) => {
              const [cx, cy] = toXY(s.val, hover.idx)
              return <circle key={i} cx={cx} cy={cy} r={4} fill={s.color} stroke="#fff" strokeWidth={1.5} />
            })}
          </>
        )}
      </svg>

      {hover && hoverRow && (
        <div style={{
          position: 'fixed',
          left: hover.x + 12,
          top: hover.y - 160,
          background: '#0f172a', color: '#f8fafc',
          padding: '8px 12px', borderRadius: 8,
          fontSize: 12, lineHeight: 1.7,
          boxShadow: '0 6px 18px rgba(2,6,23,0.3)',
          border: '1px solid rgba(148,163,184,0.2)',
          pointerEvents: 'none', zIndex: 9999, whiteSpace: 'nowrap',
        }}>
          <div style={{ fontWeight: 700, marginBottom: 2 }}>{hoverDate}</div>
          <div><span style={{ opacity: 0.75 }}>Remaining Balance</span> {fmt$(hoverRow.balance)}</div>
          <div><span style={{ opacity: 0.75 }}>Principal Paid to Date</span> {fmt$(hoverRow.cumPrincipal)}</div>
          <div><span style={{ opacity: 0.75 }}>Interest Paid to Date</span> {fmt$(hoverRow.cumInterest)}</div>
          <div><span style={{ opacity: 0.75 }}>Total Paid</span> {fmt$(hoverRow.cumTotal)}</div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12, color: 'var(--muted)', flexWrap: 'wrap' }}>
        {[
          { color: '#0f172a', label: 'Remaining Balance' },
          { color: '#06b6d4', label: 'Cum. Principal Paid' },
          { color: '#a78bfa', label: 'Cum. Interest Paid' },
          { color: '#fb7185', label: 'Total Paid' },
        ].map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 12, height: 12, background: s.color, borderRadius: 3, flexShrink: 0 }} />
            {s.label}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Amort table ───────────────────────────────────────────────────────────────
const EVENT_BG: Record<string, string> = {
  prepayment: 'rgba(34,197,94,0.16)',   // match LoanTable
  deferral:   'rgba(234,179,8,0.20)',   // match LoanTable
  default:    'rgba(239,68,68,0.20)',   // match LoanTable
}

function AmortTable({ schedule, loan }: { schedule: AmortRow[]; loan: Loan }) {
  return (
    <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '45vh', borderRadius: 8, border: '1px solid var(--border)', boxShadow: '0 2px 16px rgba(15,23,42,0.08)', padding: 4 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ color: 'var(--muted)', fontSize: 12, fontWeight: 600 }}>
            {['Month', 'Payment', 'Principal', 'Interest', 'Balance'].map(h => (
              <th key={h} style={{
                padding: '8px 10px',
                textAlign: h === 'Month' ? 'left' : 'right',
                borderBottom: '1px solid var(--border)',
                position: 'sticky',
                top: 0,
                zIndex: 10,
                background: 'var(--surface)',
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 4px rgba(15,23,42,0.10)',
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {schedule.map((row, idx) => {
            const rowKey = (() => {
              const d = new Date(loan.loanStartDate + 'T00:00:00')
              d.setMonth(d.getMonth() + row.monthIndex - 1)
              return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
            })()
            const purchaseKey = (() => {
              const d = new Date(loan.purchaseDate + 'T00:00:00')
              return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
            })()
            const isPurchaseMonth = rowKey === purchaseKey
            const isPreOwnership  = row.loanDate < new Date(loan.purchaseDate + 'T00:00:00')
            const isEven = idx % 2 === 1

            let bg = isEven ? 'rgba(15,23,42,0.02)' : 'transparent'
            if (row.eventTypes && row.eventTypes.length > 0) {
              for (const p of EVENT_PRIORITY) {
                if (row.eventTypes.includes(p)) { bg = EVENT_BG[p]; break }
              }
            } else if (row.eventType) {
              bg = EVENT_BG[row.eventType] || bg
            }

            const dash = isPreOwnership ? '—' : null

            return (
              <tr key={idx} style={{
                background: bg,
                borderTop: isPurchaseMonth ? '3px solid #16a34a' : undefined,
                color: isPreOwnership ? '#9aa3af' : undefined,
              }}>
                <td style={{ padding: '7px 10px', borderBottom: '1px dashed rgba(15,23,42,0.04)' }}>
                  {fmtMonthYear(row.loanDate)}
                </td>
                <td style={{ padding: '7px 10px', textAlign: 'right', borderBottom: '1px dashed rgba(15,23,42,0.04)' }}>
                  {dash ?? fmt$(row.payment)}
                </td>
                <td style={{ padding: '7px 10px', textAlign: 'right', borderBottom: '1px dashed rgba(15,23,42,0.04)' }}>
                  {dash ?? fmt$(row.scheduledPrincipal + row.prepaymentPrincipal)}
                </td>
                <td style={{ padding: '7px 10px', textAlign: 'right', borderBottom: '1px dashed rgba(15,23,42,0.04)' }}>
                  {dash ?? fmt$(row.interest)}
                </td>
                <td style={{ padding: '7px 10px', textAlign: 'right', borderBottom: '1px dashed rgba(15,23,42,0.04)', fontWeight: 600 }}>
                  {fmt$(row.balance)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Main drawer ───────────────────────────────────────────────────────────────
export default function LoanDrawer({ loan, open, onClose }: Props) {
  const [tab, setTab] = useState<'schedule' | 'investment'>('schedule')

  // Reset to schedule tab when loan changes or when viewing market loan
  useEffect(() => {
    setTab('schedule')
  }, [loan?.loanId])

  // Force back to schedule if somehow on investment tab for a market loan
  useEffect(() => {
    if (loan?.isMarketLoan && tab === 'investment') setTab('schedule')
  }, [loan?.isMarketLoan, tab])

  const schedule = useMemo(() => {
    if (!loan) return []
    return buildAmortSchedule(loan)
  }, [loan?.loanId])

  const investmentSchedule = useMemo(() => {
    if (!loan) return []
    return schedule.map(row => ({
      ...row,
      payment:             row.payment * loan.ownershipPct,
      scheduledPrincipal:  row.scheduledPrincipal * loan.ownershipPct,
      prepaymentPrincipal: row.prepaymentPrincipal * loan.ownershipPct,
      interest:            row.interest * loan.ownershipPct,
      balance:             row.balance * loan.ownershipPct,
    }))
  }, [schedule, loan?.ownershipPct])

  const activeSchedule = tab === 'investment' ? investmentSchedule : schedule

  const tabBtn = (active: boolean): React.CSSProperties => ({
    padding: '7px 16px',
    borderRadius: 8,
    border: active ? '2px solid var(--brand)' : '1px solid var(--border)',
    background: active ? 'rgba(14,165,233,0.08)' : 'transparent',
    color: active ? 'var(--brand)' : 'var(--muted)',
    fontWeight: active ? 700 : 500,
    fontSize: 13,
    cursor: 'pointer',
  })

  if (!loan) return null

  const showInvestmentTab = !loan.isMarketLoan

  return (
    <>
      {open && (
        <div onClick={onClose} style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.15)',
          zIndex: 89,
        }} />
      )}

      <div style={{
        position: 'fixed', right: 0, top: 0, bottom: 0,
        width: 580,
        background: 'var(--card)',
        borderLeft: '1px solid var(--border)',
        boxShadow: '-28px 0 80px rgba(0,0,0,0.14)',
        transform: open ? 'translateX(0)' : 'translateX(110%)',
        transition: 'transform 0.28s cubic-bezier(.2,.9,.3,1)',
        display: 'flex', flexDirection: 'column',
        zIndex: 90, overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{
          padding: '18px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{loan.loanName}</h2>
              {loan.isMarketLoan && (
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '2px 8px',
                  borderRadius: 20, background: '#f0fdf4', color: '#16a34a',
                  border: '1px solid #bbf7d0',
                }}>
                  Available
                </span>
              )}
            </div>
            <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 3 }}>{loan.school}</div>
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>
              {loan.isMarketLoan
                ? `Loan Start ${loan.loanStartDate} · Orig Loan Amt ${fmt$(loan.principal)}`
                : `Purchased ${loan.purchaseDate} · Orig Loan Amt ${fmt$(loan.principal)}`}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button style={{
              padding: '7px 14px', borderRadius: 8,
              border: '1px solid var(--border)', background: 'var(--card)',
              fontSize: 13, fontWeight: 500, cursor: 'pointer',
            }}>
              Download CSV
            </button>
            <button onClick={onClose} style={{
              background: '#f1f5f9', border: 'none',
              padding: '8px 12px', borderRadius: 8,
              cursor: 'pointer', fontSize: 16,
            }}>✕</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Chart */}
          <div style={{
            background: '#ffffff', borderRadius: 8,
            border: '1px solid rgba(15,23,42,0.08)',
            padding: '12px',
            boxShadow: '0 2px 12px rgba(15,23,42,0.06)',
          }}>
            <AmortChart schedule={activeSchedule} loan={loan} />
          </div>

          {/* Info tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12 }}>
            <div style={{
              background: 'var(--surface)', borderRadius: 8,
              padding: '12px 16px', border: '1px solid var(--border)',
            }}>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                {loan.isMarketLoan ? 'Available % (unowned)' : 'Invested Capital'}
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>
                {loan.isMarketLoan
                  ? `${(loan.ownershipPct * 100).toFixed(1)}%`
                  : fmt$(loan.purchasePrice)}
              </div>
            </div>
            <div style={{
              background: 'var(--surface)', borderRadius: 8,
              padding: '12px 20px', border: '1px solid var(--border)',
            }}>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Rate</div>
              <div style={{ fontSize: 16, fontWeight: 800, marginTop: 4 }}>{loan.nominalRate.toFixed(2)}%</div>
            </div>
          </div>

          {/* Tabs — only show My Investment for non-market loans */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={tabBtn(tab === 'schedule')} onClick={() => setTab('schedule')}>
              Loan Schedule
            </button>
            {showInvestmentTab && (
              <button style={tabBtn(tab === 'investment')} onClick={() => setTab('investment')}>
                My Investment
              </button>
            )}
          </div>

          {/* Amortization table */}
          <div>
            <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700 }}>Amortization</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
              <span style={{ width: 20, height: 2, background: '#16a34a', display: 'inline-block' }} />
              Green line indicates the month the loan was purchased
            </div>
            <AmortTable schedule={activeSchedule} loan={loan} />
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 20px',
          borderTop: '1px solid var(--border)',
          background: 'var(--surface)',
          display: 'flex', gap: 10, flexShrink: 0,
        }}>
          <button style={{
            padding: '7px 14px', borderRadius: 8,
            border: '1px solid var(--border)', background: 'var(--card)',
            fontSize: 13, fontWeight: 500, cursor: 'pointer',
          }}>Print</button>
          <button style={{
            padding: '7px 14px', borderRadius: 8, border: 'none',
            background: '#0ea5e9', color: '#fff',
            fontSize: 13, fontWeight: 500, cursor: 'pointer',
          }}>Copy CSV</button>
        </div>
      </div>
    </>
  )
}