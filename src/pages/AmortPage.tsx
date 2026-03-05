import { useState, useMemo } from 'react'
import { useLoans } from '../hooks/useLoans'
import { useUser } from '../context/UserContext'
import type { Loan } from '../hooks/useLoans'
import LoanTable from '../components/LoanTable'
import LoanDrawer from '../components/LoanDrawer'
import KpiDrawer from '../components/KpiDrawer'
import type { KpiType } from '../components/KpiDrawer'

const fmt$ = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })

const selectStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--card)',
  color: 'var(--text)',
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
}

const btnStyle: React.CSSProperties = {
  padding: '7px 14px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--card)',
  color: 'var(--text)',
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
}

function KpiTile({ label, value, onClick }: { label: string; value: string; onClick?: () => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'var(--card)',
        borderRadius: 10,
        padding: '12px 16px',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow)',
        cursor: 'pointer',
        flex: 1,
        minWidth: 0,
        transition: 'transform 0.18s',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
      }}
    >
      <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, marginTop: 6 }}>{value}</div>
    </div>
  )
}

const MARKETPLACE_IMG = 'https://jeff-stratofied.github.io/loan-dashboard/assets/MarketplaceReporting.png'

function TabStrip({ onMarketplaceClick, onHoldingsClick, activeTab = 'holdings' }: { onMarketplaceClick: () => void; onHoldingsClick: () => void; activeTab?: string }) {
  const tabs = [
    { key: 'marketplace', label: 'Marketplace', onClick: onMarketplaceClick },
    { key: 'holdings',    label: 'My Holdings', onClick: onHoldingsClick },
  ]
  return (
    <div style={{ flexShrink: 0, padding: '0 48px', marginBottom: 16 }}>
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
        {tabs.map((tab) => (
          <div
            key={tab.key}
            onClick={tab.onClick}
            style={{
              padding: '10px 0',
              marginRight: 28,
              fontSize: 14,
              fontWeight: activeTab === tab.key ? 700 : 500,
              color: activeTab === tab.key ? 'var(--brand)' : 'var(--muted)',
              borderBottom: activeTab === tab.key ? '2px solid var(--brand)' : '2px solid transparent',
              marginBottom: -1,
              cursor: activeTab !== tab.key ? 'pointer' : 'default',
              userSelect: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
          </div>
        ))}
      </div>
    </div>
  )
}


export default function AmortPage() {
  const { userId, isMarket } = useUser()
  const { loans, loading, error } = useLoans(userId)

  const today = new Date()

  const [filterName,   setFilterName]   = useState('')
  const [filterSchool, setFilterSchool] = useState('')
  const [filterRate,   setFilterRate]   = useState('')
  const [sortKey,      setSortKey]      = useState('')
  const [selectedLoan,      setSelectedLoan]      = useState<Loan | null>(null)
  const [drawerOpen,        setDrawerOpen]        = useState(false)
  const [activeKpi,         setActiveKpi]         = useState<KpiType>(null)
  const [showMarketplace,   setShowMarketplace]   = useState(false)

  function openDrawer(loan: Loan) { setActiveKpi(null); setSelectedLoan(loan); setDrawerOpen(true) }
  function openKpi(kpi: KpiType)  { setDrawerOpen(false); setActiveKpi(kpi) }

  const totalPortfolioValue = useMemo(() => loans.reduce((s, l) => s + l.balance * l.ownershipPct, 0), [loans])
  const totalInvested       = useMemo(() => loans.reduce((s, l) => s + l.purchasePrice, 0), [loans])
  const avgRate             = useMemo(() => loans.length ? loans.reduce((s, l) => s + l.nominalRate, 0) / loans.length : 0, [loans])
  const monthlyIncome       = useMemo(() => loans.reduce((s, l) => s + (l.balance * l.ownershipPct * l.nominalRate / 100 / 12), 0), [loans])

  const kpiTiles = isMarket
    ? [
        { label: 'Total Available Value', value: fmt$(totalPortfolioValue), kpi: 'tpv' as KpiType },
        { label: 'Avg Rate',              value: avgRate.toFixed(2) + '%',  kpi: 'rates' as KpiType },
        { label: 'Est. Monthly Income',   value: fmt$(monthlyIncome),       kpi: 'payments' as KpiType },
        { label: 'Loans Available',       value: String(loans.length),      kpi: 'distribution' as KpiType },
      ]
    : [
        { label: 'Total Portfolio Value', value: fmt$(totalPortfolioValue), kpi: 'tpv' as KpiType },
        { label: 'Avg Rate',              value: avgRate.toFixed(2) + '%',  kpi: 'rates' as KpiType },
        { label: 'Monthly Income',        value: fmt$(monthlyIncome),       kpi: 'payments' as KpiType },
        { label: 'Total Invested',        value: fmt$(totalInvested),       kpi: 'distribution' as KpiType },
      ]

  const loanNames = useMemo(() => [...new Set(loans.map(l => l.loanName))].sort(), [loans])
  const schools   = useMemo(() => [...new Set(loans.map(l => l.school))].sort(),   [loans])

  const filtered = useMemo(() => {
    let rows = [...loans]
    if (filterName)   rows = rows.filter(l => l.loanName === filterName)
    if (filterSchool) rows = rows.filter(l => l.school === filterSchool)
    if (filterRate === 'low')  rows = rows.filter(l => l.nominalRate < 5)
    if (filterRate === 'mid')  rows = rows.filter(l => l.nominalRate >= 5 && l.nominalRate <= 8)
    if (filterRate === 'high') rows = rows.filter(l => l.nominalRate > 8)
    if (sortKey === 'purchase_asc')  rows.sort((a, b) => a.purchaseDate.localeCompare(b.purchaseDate))
    if (sortKey === 'purchase_desc') rows.sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate))
    if (sortKey === 'start_asc')     rows.sort((a, b) => a.loanStartDate.localeCompare(b.loanStartDate))
    if (sortKey === 'start_desc')    rows.sort((a, b) => b.loanStartDate.localeCompare(a.loanStartDate))
    if (sortKey === 'amount_asc')    rows.sort((a, b) => a.principal - b.principal)
    if (sortKey === 'amount_desc')   rows.sort((a, b) => b.principal - a.principal)
    if (sortKey === 'rate_asc')      rows.sort((a, b) => a.nominalRate - b.nominalRate)
    if (sortKey === 'rate_desc')     rows.sort((a, b) => b.nominalRate - a.nominalRate)
    return rows
  }, [loans, filterName, filterSchool, filterRate, sortKey])

  function resetFilters() { setFilterName(''); setFilterSchool(''); setFilterRate(''); setSortKey('') }

  if (showMarketplace) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', position: 'relative' }}>
        <TabStrip onMarketplaceClick={() => setShowMarketplace(true)} onHoldingsClick={() => setShowMarketplace(false)} activeTab="marketplace" />
        <div style={{ flex: 1, overflow: 'hidden', padding: '0 24px 20px', boxSizing: 'border-box' }}>
          <img
            src={MARKETPLACE_IMG}
            alt="Marketplace"
            style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'top', display: 'block', borderRadius: 8 }}
          />
        </div>
      </div>
    )
  }

  return (
    // Outer: fixed height, no scroll — everything is flex column
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', position: 'relative' }}>

      <TabStrip onMarketplaceClick={() => setShowMarketplace(true)} onHoldingsClick={() => setShowMarketplace(false)} activeTab="holdings" />

      {/* Top section: fixed, never scrolls */}
      <div style={{ flexShrink: 0, padding: '16px 24px 0', maxWidth: 1600, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>


        {/* Heading row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
              {isMarket ? 'Marketplace – Available Loans' : 'Loan Portfolio – Amortization Schedules'}
            </h1>
            <p style={{ color: 'var(--muted)', fontSize: 13, margin: '4px 0 0' }}>
              {isMarket ? 'Browse loans available for purchase. Click a loan to see its schedule.' : 'Click on a loan to see & export the amortization schedule.'}
            </p>
            <p style={{ color: 'var(--muted)', fontSize: 13, margin: '2px 0 0' }}>
              Current Date: {today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>

        </div>

        {/* KPI tiles */}
        <div style={{ display: 'flex', gap: 12, margin: '16px 0' }}>
          {kpiTiles.map(t => (
            <KpiTile key={t.label} label={t.label} value={t.value} onClick={() => openKpi(t.kpi)} />
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
          <select value={filterName}   onChange={e => setFilterName(e.target.value)}   style={selectStyle}>
            <option value="">Name</option>
            {loanNames.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <select value={filterSchool} onChange={e => setFilterSchool(e.target.value)} style={selectStyle}>
            <option value="">School</option>
            {schools.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filterRate}   onChange={e => setFilterRate(e.target.value)}   style={selectStyle}>
            <option value="">Rate</option>
            <option value="low">Below 5%</option>
            <option value="mid">5% – 8%</option>
            <option value="high">Above 8%</option>
          </select>
          <select value={sortKey}      onChange={e => setSortKey(e.target.value)}       style={selectStyle}>
            <option value="">Sort</option>
            <option value="purchase_asc">Purchase Date ↑</option>
            <option value="purchase_desc">Purchase Date ↓</option>
            <option value="start_asc">Loan Start ↑</option>
            <option value="start_desc">Loan Start ↓</option>
            <option value="amount_asc">Orig Amt ↑</option>
            <option value="amount_desc">Orig Amt ↓</option>
            <option value="rate_asc">Rate ↑</option>
            <option value="rate_desc">Rate ↓</option>
          </select>
          <button onClick={resetFilters} style={selectStyle}>Reset</button>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 500 }}>
              {loading ? 'Loading…' : `${filtered.length} loan${filtered.length !== 1 ? 's' : ''}`}
            </span>
            <button style={btnStyle}>Download CSV</button>
            <button style={btnStyle}>Copy CSV</button>
            <button style={btnStyle}>Print</button>
          </div>
        </div>
      </div>

      {/* Table section: flex: 1, this is the only part that scrolls */}
      <div style={{ flex: 1, overflow: 'hidden', padding: '0 24px 20px', maxWidth: 1600, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        {loading && <div style={{ padding: '40px 0', color: 'var(--muted)', fontSize: 14 }}>Loading loans…</div>}
        {error   && <div style={{ padding: '40px 0', color: '#ef4444',      fontSize: 14 }}>Error loading loans: {error}</div>}
        {!loading && !error && filtered.length === 0 && (
          <div style={{ padding: '40px 0', color: 'var(--muted)', fontSize: 14 }}>
            {isMarket ? 'No loans currently available in the marketplace.' : 'No loans found.'}
          </div>
        )}
        {!loading && !error && filtered.length > 0 && (
          <LoanTable loans={filtered} onRowClick={openDrawer} />
        )}
      </div>

      <LoanDrawer loan={selectedLoan} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <KpiDrawer  kpi={activeKpi}     loans={loans}     onClose={() => setActiveKpi(null)} />
    </div>
  )
}