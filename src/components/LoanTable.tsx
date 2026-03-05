import React, { useState, useMemo } from 'react'
import type { Loan, LoanEvent } from '../hooks/useLoans'
import OwnershipPie from './OwnershipPie'
import EventBadge from './EventBadge'
import type { EventType } from './EventBadge'

export interface ExtraColumn {
  header: string
  key: string
  render: (loan: Loan) => React.ReactNode
  sortValue?: (loan: Loan) => number | string
}

interface Props {
  loans: Loan[]
  onRowClick: (loan: Loan) => void
  extraColumn?: ExtraColumn
}

type SortDir = 'asc' | 'desc'
interface SortState { key: string; dir: SortDir }

const fmt$ = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })

const EVENT_ROW_BG: Record<string, string> = {
  prepayment: 'rgba(34,197,94,0.16)',
  deferral:   'rgba(234,179,8,0.20)',
  default:    'rgba(239,68,68,0.20)',
}
const EVENT_PRIORITY = ['default', 'deferral', 'prepayment']

function getEventRowBg(events: LoanEvent[]): string | undefined {
  if (!events.length) return undefined
  const types = events.map(e => e.type)
  for (const p of EVENT_PRIORITY) {
    if (types.includes(p as EventType)) return EVENT_ROW_BG[p]
  }
  return undefined
}

const SORTABLE_COLUMNS: { key: string; label: string }[] = [
  { key: 'loanId',        label: 'ID' },
  { key: 'event',         label: 'Event' },
  { key: 'ownershipPct',  label: '% Owned' },
  { key: 'loanName',      label: 'Loan' },
  { key: 'school',        label: 'School' },
  { key: 'loanStartDate', label: 'Loan Start' },
  { key: 'purchaseDate',  label: 'Purchase Date' },
  { key: 'principal',     label: 'Orig Amt' },
  { key: 'purchasePrice', label: 'Purchase $' },
  { key: 'nominalRate',   label: 'Rate' },
  { key: 'termYears',     label: 'Term' },
  { key: 'graceYears',    label: 'Grace' },
]

function getSortValue(loan: Loan, key: string): string | number {
  switch (key) {
    case 'loanId':        return loan.loanId
    case 'loanName':      return loan.loanName
    case 'school':        return loan.school
    case 'loanStartDate': return loan.loanStartDate
    case 'purchaseDate':  return loan.purchaseDate
    case 'principal':     return loan.principal
    case 'purchasePrice': return loan.purchasePrice
    case 'nominalRate':   return loan.nominalRate
    case 'termYears':     return loan.termYears
    case 'graceYears':    return loan.graceYears
    case 'ownershipPct':  return loan.ownershipPct
    case 'event':         return loan.events.length ? loan.events[0].type : ''
    case 'balance':       return loan.balance
    default:              return ''
  }
}

// ── Tightened styles ──────────────────────────────────────────────────────────
const th: React.CSSProperties = {
  padding: '6px 7px',
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--muted)',
  borderBottom: '1px solid var(--border)',
  whiteSpace: 'nowrap',
  position: 'sticky',
  top: 0,
  zIndex: 10,
  background: 'var(--surface)',
  userSelect: 'none',
  boxShadow: '0 2px 4px rgba(15,23,42,0.10)',
}

const td: React.CSSProperties = {
  padding: '5px 7px',
  borderBottom: '1px dashed rgba(15,23,42,0.05)',
  whiteSpace: 'nowrap',
  fontSize: 12,
}

const tdBold: React.CSSProperties = {
  ...td,
  fontWeight: 600,
}

export default function LoanTable({ loans, onRowClick, extraColumn }: Props) {
  const [hoveredRow, setHoveredRow] = useState<string | null>(null)
  const [sort, setSort] = useState<SortState>({ key: 'loanName', dir: 'asc' })

  function handleSortClick(key: string) {
    setSort(prev =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' }
    )
  }

  const sorted = useMemo(() => {
    const arr = [...loans]
    arr.sort((a, b) => {
      const av = extraColumn && sort.key === extraColumn.key
        ? (extraColumn.sortValue ? extraColumn.sortValue(a) : 0)
        : getSortValue(a, sort.key)
      const bv = extraColumn && sort.key === extraColumn.key
        ? (extraColumn.sortValue ? extraColumn.sortValue(b) : 0)
        : getSortValue(b, sort.key)
      if (typeof av === 'string' && typeof bv === 'string')
        return sort.dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      return sort.dir === 'asc'
        ? (av as number) - (bv as number)
        : (bv as number) - (av as number)
    })
    return arr
  }, [loans, sort, extraColumn])

  const allColumns = [
    ...SORTABLE_COLUMNS,
    extraColumn
      ? { key: extraColumn.key, label: extraColumn.header }
      : { key: 'balance', label: 'Bal' },
  ]

  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid var(--border)',
      borderRadius: 12,
      boxShadow: '0 2px 16px rgba(15,23,42,0.08)',
      padding: '8px 8px 0 8px',
      maxHeight: 'calc(100vh - 320px)',
      overflowY: 'auto',
      overflowX: 'auto',
    }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: 'var(--surface)', boxShadow: '0 2px 6px rgba(15,23,42,0.08)' }}>
            {allColumns.map(col => {
              const isActive = sort.key === col.key
              const arrow = isActive ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ''
              return (
                <th
                  key={col.key}
                  onClick={() => handleSortClick(col.key)}
                  style={{
                    ...th,
                    cursor: 'pointer',
                    color: isActive ? 'var(--brand)' : 'var(--muted)',
                  }}
                >
                  {col.label}{arrow}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((loan, idx) => {
            const isEven   = idx % 2 === 1
            const isHovered = hoveredRow === loan.loanId
            const eventBg  = getEventRowBg(loan.events)

            const rowBg = isHovered
              ? 'rgba(148,163,184,0.15)'
              : eventBg ?? (isEven ? 'rgba(15,23,42,0.02)' : 'transparent')

            return (
              <tr
                key={loan.loanId}
                onClick={() => onRowClick(loan)}
                onMouseEnter={() => setHoveredRow(loan.loanId)}
                onMouseLeave={() => setHoveredRow(null)}
                style={{ background: rowBg, cursor: 'pointer', transition: 'background 0.15s', position: 'relative', zIndex: 0 }}
              >
                {/* ID — truncated to 8 chars */}
                <td style={td}>{loan.loanId.slice(0, 8)}</td>

                {/* Event badges */}
                <td style={td}>
                  <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                  {loan.events.map((ev: LoanEvent, i: number) => (
  <EventBadge key={i} type={ev.type as EventType} variant="round" event={ev} />
))}
                  </div>
                </td>

                {/* Ownership pie */}
                <td style={td}>
                  <OwnershipPie pct={loan.ownershipPct} color={loan.loanColor} />
                </td>

                {/* Loan name */}
                <td style={tdBold}>{loan.loanName}</td>

                {/* School */}
                <td style={td}>{loan.school}</td>

                {/* Dates */}
                <td style={td}>{loan.loanStartDate}</td>
                <td style={td}>{loan.purchaseDate}</td>

                {/* Amounts */}
                <td style={td}>{fmt$(loan.principal)}</td>
                <td style={td}>{fmt$(loan.purchasePrice)}</td>

                {/* Rate */}
                <td style={tdBold}>{loan.nominalRate.toFixed(2)}%</td>

                {/* Term / Grace */}
                <td style={td}>{loan.termYears}</td>
                <td style={td}>{loan.graceYears}</td>

                {/* Balance or extra column */}
                <td style={tdBold}>
                  {extraColumn ? extraColumn.render(loan) : fmt$(loan.balance)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}