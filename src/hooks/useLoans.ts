import { useState, useEffect } from 'react'
import { getCurrentBalance } from '../utils/amortEngine'

const LOANS_URL = 'https://raw.githubusercontent.com/jeff-stratofied/reporting-phase1/main/data/loans.json'

export interface OwnershipLot {
  user: string
  pct: number
  purchaseDate: string
  pricePaid?: number
}

export interface LoanEvent {
  type: 'prepayment' | 'deferral' | 'default'
  date?: string
  amount?: number
  months?: number
  startDate?: string
  recovered?: number
}

export interface Loan {
  loanId: string
  loanName: string
  school: string
  loanStartDate: string
  purchaseDate: string
  principal: number
  purchasePrice: number
  nominalRate: number
  termYears: number
  graceYears: number
  balance: number
  ownershipPct: number
  ownershipLots: OwnershipLot[]
  events: LoanEvent[]
  loanColor: string
  visible: boolean
  isMarketLoan: boolean
}

const LOAN_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#0ea5e9',
  '#8b5cf6', '#f97316', '#14b8a6', '#ec4899', '#06b6d4',
  '#84cc16', '#a855f7', '#f43f5e', '#22d3ee', '#fb923c',
  '#4ade80', '#818cf8', '#fbbf24', '#34d399', '#fb7185',
]

// pct in JSON may be fraction (0.5) or percentage (50) — normalise to 0-1
function toFraction(pct: number): number {
  return pct > 1.5 ? pct / 100 : pct
}

function normalizeLoan(raw: any, index: number, userId: string): Loan | null {
  const loanId = String(raw.loanId ?? raw.id ?? 'unknown')
  const lots: OwnershipLot[] = Array.isArray(raw.ownershipLots) ? raw.ownershipLots : []

  const isMarket = userId === 'market'

  if (isMarket) {
    // Market view: show loans that have a 'market' ownership lot
    const marketLots = lots.filter(l => String(l.user).toLowerCase() === 'market')
    const marketFraction = marketLots.reduce((sum, l) => sum + toFraction(Number(l.pct || 0)), 0)

    if (marketFraction <= 0) return null  // no market ownership — skip

    const principal = Number(raw.principal ?? raw.origPrincipalBal ?? 0)
    const nominalRate = Number(raw.nominalRate ?? raw.rate ?? 0) * 100
    const termYears = Number(raw.termYears ?? 0)
    const graceYears = Number(raw.graceYears ?? (raw.mosGraceElig ? raw.mosGraceElig / 12 : 0))
    const loanStartDate = raw.loanStartDate || raw.dateOnSystem || ''

    const balance = getCurrentBalance({
      loanId,
      loanName: raw.loanName || '',
      principal,
      nominalRate,
      termYears,
      graceYears,
      loanStartDate,
      purchaseDate: loanStartDate,
      events: Array.isArray(raw.events) ? raw.events : [],
    })

    return {
      loanId,
      loanName: raw.loanName || '',
      school: raw.school || raw.originalSchoolName || '',
      loanStartDate,
      purchaseDate: loanStartDate,
      principal,
      purchasePrice: 0,
      nominalRate,
      termYears,
      graceYears,
      balance,
      ownershipPct: marketFraction,
      ownershipLots: lots,
      events: Array.isArray(raw.events) ? raw.events : [],
      loanColor: LOAN_COLORS[index % LOAN_COLORS.length],
      visible: raw.visible !== false,
      isMarketLoan: true,
    }
  }

  // Standard user view — only loans this user owns
  const userLots = lots.filter(l => String(l.user).toLowerCase() === userId.toLowerCase())
  const ownershipPct = userLots.reduce((sum, l) => sum + toFraction(Number(l.pct || 0)), 0)

  if (ownershipPct <= 0) return null

  const purchasePrice = userLots.reduce((sum, l) => sum + Number(l.pricePaid || 0), 0)
  const userLotDates = userLots.map(l => l.purchaseDate).filter(Boolean).sort()
  const purchaseDate = userLotDates[0] || raw.purchaseDate || raw.loanStartDate || ''
  const nominalRate = Number(raw.nominalRate ?? raw.rate ?? 0) * 100
  const principal = Number(raw.principal ?? raw.origPrincipalBal ?? 0)

  const balance = getCurrentBalance({
    loanId,
    loanName: raw.loanName || '',
    principal,
    nominalRate,
    termYears: Number(raw.termYears ?? 0),
    graceYears: Number(raw.graceYears ?? (raw.mosGraceElig ? raw.mosGraceElig / 12 : 0)),
    loanStartDate: raw.loanStartDate || '',
    purchaseDate,
    events: Array.isArray(raw.events) ? raw.events : [],
  })

  return {
    loanId,
    loanName: raw.loanName || '',
    school: raw.school || raw.originalSchoolName || '',
    loanStartDate: raw.loanStartDate || raw.dateOnSystem || '',
    purchaseDate,
    principal,
    purchasePrice,
    nominalRate,
    termYears: Number(raw.termYears ?? 0),
    graceYears: Number(raw.graceYears ?? (raw.mosGraceElig ? raw.mosGraceElig / 12 : 0)),
    balance,
    ownershipPct,
    ownershipLots: lots,
    events: Array.isArray(raw.events) ? raw.events : [],
    loanColor: LOAN_COLORS[index % LOAN_COLORS.length],
    visible: raw.visible !== false,
    isMarketLoan: false,
  }
}

export function useLoans(userId: string) {
  const [loans, setLoans] = useState<Loan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    setLoading(true)
    setError(null)

    fetch(LOANS_URL)
      .then(res => {
        if (!res.ok) throw new Error(`GitHub fetch error: ${res.status}`)
        return res.json()
      })
      .then(data => {
        const raw: any[] = Array.isArray(data)
          ? data
          : Array.isArray(data.loans)
            ? data.loans
            : []

        console.log(`Loaded ${raw.length} raw loans`)

        const normalized = raw
          .map((l, i) => normalizeLoan(l, i, userId))
          .filter((l): l is Loan => l !== null && l.visible)

        console.log(`Normalized ${normalized.length} loans for user: ${userId}`)
        setLoans(normalized)
      })
      .catch(err => {
        console.error('Loans fetch failed:', err)
        setError(err.message)
      })
      .finally(() => setLoading(false))
  }, [userId])

  return { loans, loading, error }
}