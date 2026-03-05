import React, { useState, useMemo, useCallback } from 'react'
import type { Loan } from '../hooks/useLoans'
import { buildAmortSchedule } from '../utils/amortEngine'

export type KpiType = 'tpv' | 'rates' | 'payments' | 'distribution' | null

interface Props {
  kpi: KpiType
  loans: Loan[]
  onClose: () => void
}

interface TooltipState { x: number; y: number; lines: string[]; idx?: number }

// ── helpers ───────────────────────────────────────────────────────────────────
const fmt$ = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })

const fmtMY = (ym: string) => {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

const todayKey = (() => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
})()

function buildLoanTPVSeries(loan: Loan): Record<string, number> {
  const schedule = buildAmortSchedule(loan)
  const result: Record<string, number> = {}
  let cumP = 0, cumI = 0
  schedule.forEach(row => {
    if (!row.isOwned) return
    cumP += row.scheduledPrincipal + row.prepaymentPrincipal
    cumI += row.interest
    const key = `${row.loanDate.getFullYear()}-${String(row.loanDate.getMonth() + 1).padStart(2, '0')}`
    result[key] = (cumP + cumI) * loan.ownershipPct + row.balance * loan.ownershipPct * 0.95
  })
  return result
}

function buildPaymentSeries(loan: Loan): Record<string, number> {
  const schedule = buildAmortSchedule(loan)
  const result: Record<string, number> = {}
  schedule.forEach(row => {
    if (!row.isOwned) return
    const key = `${row.loanDate.getFullYear()}-${String(row.loanDate.getMonth() + 1).padStart(2, '0')}`
    result[key] = (result[key] || 0) + row.payment * loan.ownershipPct
  })
  return result
}

// ── shared sub-components ─────────────────────────────────────────────────────
function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 8, padding: '12px 16px', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>{value}</div>
    </div>
  )
}

const thSt: React.CSSProperties = {
  padding: '8px 10px', textAlign: 'left', fontSize: 12, fontWeight: 700,
  color: 'var(--muted)', borderBottom: '1px solid var(--border)',
  position: 'sticky', top: 0, background: 'var(--surface)', whiteSpace: 'nowrap',
}
const tdSt: React.CSSProperties = {
  padding: '8px 10px', borderBottom: '1px dashed rgba(15,23,42,0.04)', whiteSpace: 'nowrap',
}

// ── TPV Drawer ────────────────────────────────────────────────────────────────
function TPVDrawer({ loans, onTooltip }: { loans: Loan[]; onTooltip: (t: TooltipState | null) => void }) {
  const [hiddenLoans, setHiddenLoans] = useState<Set<string>>(new Set())
  const [hoveredId, setHoveredId]     = useState<string | null>(null)

  const stackData = useMemo(() => {
    const data: Record<string, Record<string, number>> = {}
    loans.forEach(loan => {
      Object.entries(buildLoanTPVSeries(loan)).forEach(([key, val]) => {
        data[key] ??= {}
        data[key][loan.loanId] = val
      })
    })
    return data
  }, [loans])

  const months = useMemo(() => Object.keys(stackData).sort(), [stackData])

  const currentTPV = useMemo(() => {
    const key = months.includes(todayKey) ? todayKey : months[months.length - 1] ?? ''
    return Object.entries(stackData[key] ?? {})
      .filter(([id]) => !hiddenLoans.has(id))
      .reduce((s, [, v]) => s + v, 0)
  }, [stackData, months, hiddenLoans])

  const maxTPV = useMemo(() =>
    Math.max(...months.map(m =>
      Object.entries(stackData[m] ?? {})
        .filter(([id]) => !hiddenLoans.has(id))
        .reduce((s, [, v]) => s + v, 0)
    ), 1)
  , [stackData, months, hiddenLoans])

  const totalInvested = loans.reduce((s, l) => s + l.purchasePrice, 0)

  const W = 480, H = 240, ML = 60, MR = 16, MT = 12, MB = 28
  const innerH = H - MT - MB
  const barW   = months.length > 0 ? (W - ML - MR) / months.length : 1

  const yTicks = [0,1,2,3,4].map(i => ({ val: (i/4)*maxTPV, y: MT + innerH - (i/4)*innerH }))

  function toggleLoan(id: string) {
    setHiddenLoans(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  return (
    <div>
      <div style={{ background: '#fff', borderRadius: 8, border: '1px solid rgba(15,23,42,0.08)', padding: 12, boxShadow: '0 2px 12px rgba(15,23,42,0.06)' }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', overflow: 'visible' }}>
          {yTicks.map((t, i) => (
            <g key={i}>
              <line x1={ML} x2={W-MR} y1={t.y} y2={t.y} stroke="rgba(15,23,42,0.06)" strokeWidth={1}/>
              <text x={ML-8} y={t.y+4} textAnchor="end" fontSize={10} fill="#64748b">${Math.round(t.val).toLocaleString()}</text>
            </g>
          ))}

          {months.map((monthKey, i) => {
            const x = ML + i * barW
            let yCursor = MT + innerH
            const total = Object.entries(stackData[monthKey] ?? {})
              .filter(([id]) => !hiddenLoans.has(id))
              .reduce((s,[,v]) => s+v, 0)
            return (
              <g key={monthKey}>
                {loans.map(loan => {
                  if (hiddenLoans.has(loan.loanId)) return null
                  const val = stackData[monthKey]?.[loan.loanId] ?? 0
                  const bh  = (val / maxTPV) * innerH
                  if (bh <= 0) return null
                  yCursor -= bh
                  return (
                    <rect key={loan.loanId} x={x} y={yCursor} width={Math.max(barW-1,1)} height={bh}
                      fill={loan.loanColor}
                      opacity={hoveredId && hoveredId !== loan.loanId ? 0.15 : 1}
                      style={{ transition: 'opacity 0.15s' }}
                    />
                  )
                })}
                <rect x={x} y={MT} width={barW} height={innerH} fill="transparent"
                  onMouseMove={e => onTooltip({ x: e.clientX, y: e.clientY - 90, lines: [fmtMY(monthKey), `TPV ${fmt$(total)}`] })}
                  onMouseLeave={() => onTooltip(null)}
                />
              </g>
            )
          })}

          {months.map((m, i) => {
            const skip = months.length > 24 ? 24 : months.length > 12 ? 6 : 2
            if (i % skip !== 0) return null
            return <text key={m} x={ML + i*barW + barW/2} y={H-MB+14} fontSize={10} textAnchor="middle" fill="#475569">{fmtMY(m)}</text>
          })}
        </svg>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, margin: '12px 0' }}>
        <MetricBox label="Current Month TPV" value={fmt$(currentTPV)} />
        <MetricBox label="Total Invested"     value={fmt$(totalInvested)} />
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'auto', maxHeight: '40vh', background: 'var(--card)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--surface)' }}>
              {['Loan On/Off','Loan','Current TPV','Projected TPV'].map(h => <th key={h} style={thSt}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {loans.map(loan => {
              const curKey  = months.includes(todayKey) ? todayKey : months[months.length-1] ?? ''
              const curVal  = stackData[curKey]?.[loan.loanId] ?? 0
              // ✅ AFTER — finds the last month that actually has a value for this specific loan
const loanMonths = months.filter(m => stackData[m]?.[loan.loanId] != null)
const projVal = stackData[loanMonths[loanMonths.length - 1]]?.[loan.loanId] ?? 0
              const hidden  = hiddenLoans.has(loan.loanId)
              return (
                <tr key={loan.loanId}
                  onMouseEnter={() => setHoveredId(loan.loanId)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{ background: hoveredId === loan.loanId ? 'rgba(148,163,184,0.12)' : undefined }}
                >
                  <td style={tdSt}>
                    <span onClick={() => toggleLoan(loan.loanId)} style={{ width:12, height:12, borderRadius:3, background:loan.loanColor, display:'inline-block', cursor:'pointer', opacity: hidden ? 0.25 : 1, transition:'opacity 0.15s' }} />
                  </td>
                  <td style={tdSt}><div style={{ fontWeight:600 }}>{loan.loanName}</div><div style={{ fontSize:12, color:'var(--muted)' }}>{loan.school}</div></td>
                  <td style={tdSt}>{fmt$(curVal)}</td>
                  <td style={tdSt}>{fmt$(projVal)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Rates Drawer ──────────────────────────────────────────────────────────────
function RatesDrawer({ loans, onTooltip }: { loans: Loan[]; onTooltip: (t: TooltipState | null) => void }) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const rates    = loans.map(l => l.nominalRate)
  const minRate  = Math.min(...rates)
  const maxRate  = Math.max(...rates)
  const avgRate  = rates.reduce((s,r) => s+r, 0) / rates.length
  const BINS     = 5
  const binWidth = (maxRate - minRate) / BINS || 1

  const binLoans: Loan[][] = Array.from({ length: BINS }, () => [])
  loans.forEach(l => {
    let idx = Math.floor((l.nominalRate - minRate) / binWidth)
    binLoans[Math.max(0, Math.min(BINS-1, idx))].push(l)
  })
  const maxCount = Math.max(...binLoans.map(b => b.length), 1)

  const W=480, H=220, PAD=36
  const innerW = W - PAD*2
  const innerH = H - PAD*2
  const bw  = innerW / BINS * 0.7
  const gap = (innerW / BINS - bw) / 2

  return (
    <div>
      <div style={{ background:'#fff', borderRadius:8, border:'1px solid rgba(15,23,42,0.08)', padding:12, boxShadow:'0 2px 12px rgba(15,23,42,0.06)' }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display:'block' }}>
          <line x1={PAD} x2={PAD}     y1={PAD} y2={H-PAD} stroke="#cbd5e1"/>
          <line x1={PAD} x2={W-PAD}   y1={H-PAD} y2={H-PAD} stroke="#cbd5e1"/>
          {binLoans.map((loansInBin, i) => {
            if (!loansInBin.length) return null
            const x = PAD + i * (innerW/BINS) + gap
            let yCursor = H - PAD
            const unitH = innerH / maxCount
            return (
              <g key={i}>
                {loansInBin.map(loan => {
                  yCursor -= unitH
                  const y = yCursor
                  return (
                    <rect key={loan.loanId} x={x} y={y} width={bw} height={unitH}
                      fill={loan.loanColor}
                      opacity={hoveredId && hoveredId !== loan.loanId ? 0.15 : 1}
                      style={{ transition:'opacity 0.15s', cursor:'pointer' }}
                      onMouseMove={e => onTooltip({ x: e.clientX, y: e.clientY - 70, lines: [loan.loanName, `${loan.nominalRate.toFixed(2)}%`] })}
                      onMouseLeave={() => onTooltip(null)}
                    />
                  )
                })}
                <text x={x+bw/2} y={H-PAD+14} fontSize={10} textAnchor="middle" fill="#475569">
                  {(minRate+i*binWidth).toFixed(2)}–{(minRate+(i+1)*binWidth).toFixed(2)}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:12, margin:'12px 0' }}>
        <MetricBox label="Avg Rate"   value={`${avgRate.toFixed(2)}%`}/>
        <MetricBox label="Rate Range" value={`${minRate.toFixed(2)}% – ${maxRate.toFixed(2)}%`}/>
      </div>

      <p style={{ fontSize:13, fontWeight:600, margin:'0 0 8px', color:'var(--muted)' }}>Loans sorted by rate</p>
      <div style={{ border:'1px solid var(--border)', borderRadius:8, overflow:'auto', maxHeight:'40vh', background:'var(--card)' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead><tr style={{ background:'var(--surface)' }}>{['','Loan','Rate','Purchase','Balance'].map(h => <th key={h} style={thSt}>{h}</th>)}</tr></thead>
          <tbody>
            {[...loans].sort((a,b) => b.nominalRate - a.nominalRate).map(loan => (
              <tr key={loan.loanId}
                onMouseEnter={() => setHoveredId(loan.loanId)}
                onMouseLeave={() => setHoveredId(null)}
                style={{ background: hoveredId === loan.loanId ? 'rgba(148,163,184,0.12)' : undefined }}
              >
                <td style={tdSt}><span style={{ width:10, height:10, borderRadius:2, background:loan.loanColor, display:'inline-block' }}/></td>
                <td style={tdSt}><div style={{ fontWeight:600 }}>{loan.loanName}</div><div style={{ fontSize:12, color:'var(--muted)' }}>{loan.school}</div></td>
                <td style={{ ...tdSt, color:loan.loanColor, fontWeight:600 }}>{loan.nominalRate.toFixed(2)}%</td>
                <td style={tdSt}>{loan.purchaseDate}</td>
                <td style={{ ...tdSt, textAlign:'right' }}>{fmt$(loan.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Payments Drawer ───────────────────────────────────────────────────────────
function PaymentsDrawer({ loans, onTooltip }: { loans: Loan[]; onTooltip: (t: TooltipState | null) => void }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  const { months, paymentsByMonth } = useMemo(() => {
    const combined: Record<string,number> = {}
    loans.forEach(loan => {
      Object.entries(buildPaymentSeries(loan)).forEach(([key,val]) => {
        combined[key] = (combined[key]||0) + val
      })
    })
    const months = Object.keys(combined).sort()
    return { months, paymentsByMonth: months.map(m => combined[m]||0) }
  }, [loans])

  const todayIdx      = months.indexOf(todayKey)
  const currentIncome = paymentsByMonth[todayIdx >= 0 ? todayIdx : 0] ?? 0
  const totalInvested = loans.reduce((s,l) => s+l.purchasePrice, 0)

  const W=480, H=220, PAD=40
  const innerW = W - PAD*2
  const innerH = H - PAD*2
  const maxV   = Math.max(...paymentsByMonth, 1)
  const stepX  = paymentsByMonth.length > 1 ? innerW / (paymentsByMonth.length-1) : innerW
  const todayX = todayIdx >= 0 ? PAD + todayIdx*stepX : -1

  const points = paymentsByMonth.map((v,i) => `${(PAD+i*stepX).toFixed(1)},${(PAD+innerH*(1-v/maxV)).toFixed(1)}`).join(' ')
  const yTicks = [0,1,2,3,4].map(i => ({ val:(i/4)*maxV, y:PAD+innerH*(1-i/4) }))

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const mouseX = ((e.clientX - rect.left) / rect.width) * W
    const idx = Math.max(0, Math.min(months.length-1, Math.round((mouseX-PAD)/stepX)))
    setHoverIdx(idx)
    onTooltip({ x: e.clientX, y: e.clientY - 90, idx, lines: [fmtMY(months[idx]), `Monthly Income ${fmt$(paymentsByMonth[idx])}`] })
  }

  function handleMouseLeave() {
    setHoverIdx(null)
    onTooltip(null)
  }

  return (
    <div>
      <div style={{ background:'#fff', borderRadius:8, border:'1px solid rgba(15,23,42,0.08)', padding:12, boxShadow:'0 2px 12px rgba(15,23,42,0.06)' }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display:'block', cursor:'crosshair' }}
          onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
          {yTicks.map((t,i) => (
            <g key={i}>
              <line x1={PAD} x2={W-PAD} y1={t.y} y2={t.y} stroke="rgba(15,23,42,0.06)" strokeWidth={1}/>
              <text x={PAD-6} y={t.y+4} textAnchor="end" fontSize={10} fill="#64748b">${Math.round(t.val).toLocaleString()}</text>
            </g>
          ))}
          <polyline points={points} fill="none" stroke="#fb7185" strokeWidth={2}/>
          {todayX > 0 && <line x1={todayX} x2={todayX} y1={PAD} y2={H-PAD} stroke="#111827" strokeDasharray="3 4" strokeOpacity={0.6}/>}
          {months.map((m,i) => {
            if (i % 24 !== 0) return null
            return <text key={m} x={PAD+i*stepX} y={H-PAD+14} fontSize={10} textAnchor="middle" fill="#475569">{fmtMY(m)}</text>
          })}
          {hoverIdx !== null && (() => {
            const cx = PAD + hoverIdx * stepX
            const cy = PAD + innerH * (1 - paymentsByMonth[hoverIdx] / maxV)
            return (
              <>
                <line x1={cx} x2={cx} y1={PAD} y2={H-PAD} stroke="#111827" strokeDasharray="3 4" strokeOpacity={0.5}/>
                <circle cx={cx} cy={cy} r={4} fill="#fb7185" stroke="#fff" strokeWidth={1.5}/>
              </>
            )
          })()}
        </svg>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:12, margin:'12px 0' }}>
        <MetricBox label="Current Monthly Income" value={fmt$(currentIncome)}/>
        <MetricBox label="Total Invested"          value={fmt$(totalInvested)}/>
      </div>

      <p style={{ fontSize:13, fontWeight:600, margin:'0 0 8px', color:'var(--muted)' }}>Monthly expected payments</p>
      <div style={{ border:'1px solid var(--border)', borderRadius:8, overflow:'auto', maxHeight:'38vh', background:'var(--card)' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead><tr style={{ background:'var(--surface)' }}><th style={thSt}>Month</th><th style={{ ...thSt, textAlign:'right' }}>Payments</th></tr></thead>
          <tbody>
            {months.map((m,i) => (
              <tr key={m} style={{ background: i%2===1 ? 'rgba(15,23,42,0.02)' : undefined }}>
                <td style={tdSt}>{fmtMY(m)}</td>
                <td style={{ ...tdSt, textAlign:'right' }}>{fmt$(paymentsByMonth[i])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Distribution Drawer ───────────────────────────────────────────────────────
function DistributionDrawer({ loans, onTooltip }: { loans: Loan[]; onTooltip: (t: TooltipState | null) => void }) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const { months, loansByMonth } = useMemo(() => {
    const map: Record<string,Loan[]> = {}
    loans.forEach(l => { const key = l.purchaseDate.slice(0,7); map[key] ??= []; map[key].push(l) })
    const months = Object.keys(map).sort()
    return { months, loansByMonth: map }
  }, [loans])

  const totalInvested = loans.reduce((s,l) => s+l.purchasePrice, 0)
  const maxVal = Math.max(...months.map(m => loansByMonth[m].reduce((s,l) => s+l.purchasePrice, 0)), 1)

  const W=480, H=240, PAD=56
  const innerW = W - PAD*2
  const innerH = H - PAD*2
  const bw    = months.length > 0 ? innerW/months.length*0.7 : 1
  const gap   = months.length > 0 ? (innerW/months.length - bw)/2 : 0
  const scale = innerH / maxVal

  const yTicks = [0,1,2,3,4].map(i => ({ val:(i/4)*maxVal, y: PAD+innerH-(i/4)*innerH }))

  return (
    <div>
      <div style={{ background:'#fff', borderRadius:8, border:'1px solid rgba(15,23,42,0.08)', padding:12, boxShadow:'0 2px 12px rgba(15,23,42,0.06)' }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display:'block' }}>
          <line x1={PAD} x2={PAD}     y1={PAD} y2={H-PAD} stroke="#cbd5e1"/>
          <line x1={PAD} x2={W-PAD}   y1={H-PAD} y2={H-PAD} stroke="#cbd5e1"/>
          {yTicks.map((t,i) => (
            <text key={i} x={PAD-10} y={t.y+4} fontSize={10} textAnchor="end" fill="#64748b">${Math.round(t.val).toLocaleString()}</text>
          ))}
          {months.map((m,i) => {
            const loansInMonth = loansByMonth[m]
            const x = PAD + i*(innerW/months.length) + gap
            let yCursor = H - PAD
            return (
              <g key={m}>
                {loansInMonth.map(loan => {
                  const segH = loan.purchasePrice * scale
                  yCursor -= segH
                  const y = yCursor
                  return (
                    <rect key={loan.loanId} x={x} y={y} width={bw} height={segH}
                      fill={loan.loanColor}
                      opacity={hoveredId && hoveredId !== loan.loanId ? 0.15 : 1}
                      style={{ transition:'opacity 0.15s', cursor:'pointer' }}
                      onMouseMove={e => onTooltip({ x: e.clientX, y: e.clientY - 90, lines: [loan.loanName, `Purchased ${loan.purchaseDate}`, `Rate ${loan.nominalRate.toFixed(2)}%`] })}
                      onMouseLeave={() => onTooltip(null)}
                    />
                  )
                })}
                {i%2===0 && (
                  <text x={x+bw/2} y={H-PAD+14} fontSize={10} textAnchor="middle" fill="#475569">{fmtMY(m)}</text>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:12, margin:'12px 0' }}>
        <MetricBox label="Total Invested" value={fmt$(totalInvested)}/>
        <MetricBox label="Loan Count"     value={String(loans.length)}/>
      </div>

      <p style={{ fontSize:13, fontWeight:600, margin:'0 0 8px', color:'var(--muted)' }}>Loans — Invested Capital</p>
      <div style={{ border:'1px solid var(--border)', borderRadius:8, overflow:'auto', maxHeight:'38vh', background:'var(--card)' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead><tr style={{ background:'var(--surface)' }}>{['','Loan','Rate','Purchase Price'].map(h => <th key={h} style={thSt}>{h}</th>)}</tr></thead>
          <tbody>
            {loans.map(loan => (
              <tr key={loan.loanId}
                onMouseEnter={() => setHoveredId(loan.loanId)}
                onMouseLeave={() => setHoveredId(null)}
                style={{ background: hoveredId === loan.loanId ? 'rgba(148,163,184,0.12)' : undefined }}
              >
                <td style={tdSt}><span style={{ width:10, height:10, borderRadius:2, background:loan.loanColor, display:'inline-block' }}/></td>
                <td style={tdSt}><div style={{ fontWeight:600 }}>{loan.loanName}</div><div style={{ fontSize:12, color:'var(--muted)' }}>{loan.school}</div></td>
                <td style={{ ...tdSt, color:loan.loanColor, fontWeight:600 }}>{loan.nominalRate.toFixed(2)}%</td>
                <td style={tdSt}>{fmt$(loan.purchasePrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── KPI meta ──────────────────────────────────────────────────────────────────
const KPI_META: Record<string, { title: string; sub: string }> = {
  tpv:          { title: 'Total Portfolio Value',             sub: 'TPV = sum of current month loan values; (cumulative principal + interest − fees) + Mark-to-Market (95%) of remaining balance' },
  rates:        { title: 'Rates Distribution',                sub: 'Histogram of loan nominal rates' },
  payments:     { title: 'Total Expected Payments (monthly)', sub: 'Sum of scheduled payments across loans' },
  distribution: { title: 'Distribution — Loans by Purchase Month', sub: 'Number of loans purchased by month' },
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function KpiDrawer({ kpi, loans, onClose }: Props) {
  const open = kpi !== null
  const meta = kpi ? KPI_META[kpi] : null

  // Tooltip lives HERE — outside all overflow:hidden/auto containers
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const handleTooltip = useCallback((t: TooltipState | null) => setTooltip(t), [])

  const btnSt: React.CSSProperties = {
    padding: '7px 14px', borderRadius: 8,
    border: '1px solid var(--border)', background: 'var(--card)',
    fontSize: 13, fontWeight: 500, cursor: 'pointer',
  }

  return (
    <>
      {/* Overlay */}
      {open && <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.15)', zIndex:89 }}/>}

      {/* Drawer */}
      <div style={{
        position:'fixed', right:0, top:0, bottom:0, width:580,
        background:'var(--card)', borderLeft:'1px solid var(--border)',
        boxShadow:'-28px 0 80px rgba(0,0,0,0.14)',
        transform: open ? 'translateX(0)' : 'translateX(110%)',
        transition:'transform 0.28s cubic-bezier(.2,.9,.3,1)',
        display:'flex', flexDirection:'column', zIndex:90, overflow:'hidden',
      }}>
        {/* Header */}
        <div style={{ padding:'18px 20px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexShrink:0 }}>
          <div>
            <h2 style={{ margin:0, fontSize:20, fontWeight:700 }}>{meta?.title}</h2>
            <div style={{ color:'var(--muted)', fontSize:12, marginTop:4, maxWidth:420, lineHeight:1.4 }}>{meta?.sub}</div>
          </div>
          <div style={{ display:'flex', gap:8, flexShrink:0, marginLeft:12 }}>
            <button style={btnSt}>Download CSV</button>
            <button onClick={onClose} style={{ background:'#f1f5f9', border:'none', padding:'8px 12px', borderRadius:8, cursor:'pointer', fontSize:16 }}>✕</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex:1, overflow:'auto', padding:'16px 20px' }}>
          {kpi === 'tpv'          && <TPVDrawer          loans={loans} onTooltip={handleTooltip}/>}
          {kpi === 'rates'        && <RatesDrawer        loans={loans} onTooltip={handleTooltip}/>}
          {kpi === 'payments'     && <PaymentsDrawer     loans={loans} onTooltip={handleTooltip}/>}
          {kpi === 'distribution' && <DistributionDrawer loans={loans} onTooltip={handleTooltip}/>}
        </div>

        {/* Footer */}
        <div style={{ padding:'14px 20px', borderTop:'1px solid var(--border)', background:'var(--surface)', display:'flex', gap:10, flexShrink:0 }}>
          <button style={btnSt}>Print</button>
          <button style={{ padding:'7px 14px', borderRadius:8, border:'none', background:'#0ea5e9', color:'#fff', fontSize:13, fontWeight:500, cursor:'pointer' }}>Copy CSV</button>
        </div>
      </div>

      {/* Tooltip rendered OUTSIDE the drawer — not clipped by overflow:hidden */}
      {tooltip && (
        <div style={{
          position:'fixed', left: tooltip.x + 10, top: tooltip.y,
          background:'#0f172a', color:'#f8fafc',
          padding:'7px 12px', borderRadius:8, fontSize:12, lineHeight:1.7,
          pointerEvents:'none', zIndex:9999, whiteSpace:'nowrap',
          boxShadow:'0 4px 16px rgba(0,0,0,0.3)',
        }}>
          {tooltip.lines.map((l,i) => <div key={i} style={{ fontWeight: i===0 ? 700 : 400 }}>{l}</div>)}
        </div>
      )}
    </>
  )
}