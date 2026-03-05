import type { EventType } from '../components/EventBadge'


export interface Loan {
  loanId: string;
  loanName: string;
  school: string;
  loanStartDate: string;
  purchaseDate: string;
  principal: number;
  purchasePrice: number;
  nominalRate: number;
  termYears: number;
  graceYears: number;
  balance: number;
  ownershipPct: number;
  events: { type: EventType }[];
  loanColor: string;
}

export const SAMPLE_LOANS: Loan[] = [
  { loanId: 'L7IM1YE0Q8', loanName: 'TTCH 2025 10.0', school: 'Texas Tech University',   loanStartDate: '2025-09-30', purchaseDate: '2025-11-24', principal: 10000, purchasePrice: 10000, nominalRate: 10.00, termYears: 10, graceYears: 0,   balance: 9700.93,  ownershipPct: 1.00, events: [],                       loanColor: '#6366f1' },
  { loanId: '7EO4B3SHJY', loanName: 'PSU 2024 8.83',  school: 'Penn State',               loanStartDate: '2024-01-30', purchaseDate: '2024-02-06', principal: 11000, purchasePrice: 9900,  nominalRate: 8.83, termYears: 10, graceYears: 0,   balance: 3503.08,  ownershipPct: 1.00, events: [{ type: 'prepayment' }],  loanColor: '#f59e0b' },
  { loanId: 'C0RAT4N23A', loanName: 'OSU 2024 8.00',  school: 'Ohio State',               loanStartDate: '2024-01-31', purchaseDate: '2024-01-31', principal: 7500,  purchasePrice: 3750,  nominalRate: 8.00, termYears: 8,  graceYears: 0.5, balance: 4224.37,  ownershipPct: 0.50, events: [{ type: 'deferral' }, { type: 'prepayment' }], loanColor: '#10b981' },
  { loanId: 'HCZB8N2L8Z', loanName: 'PIT 2024 8.25',  school: 'Pitt',                     loanStartDate: '2024-03-14', purchaseDate: '2024-04-09', principal: 12000, purchasePrice: 6000,  nominalRate: 8.25, termYears: 12, graceYears: 1.5, balance: 12274.16, ownershipPct: 0.50, events: [{ type: 'prepayment' }],  loanColor: '#ef4444' },
  { loanId: 'QVGKDMCI3U', loanName: 'UCLA 2025 7.30', school: 'UCLA',                     loanStartDate: '2025-01-30', purchaseDate: '2025-02-12', principal: 7500,  purchasePrice: 7500,  nominalRate: 7.30, termYears: 5,  graceYears: 0,   balance: 5872.60,  ownershipPct: 1.00, events: [],                       loanColor: '#0ea5e9' },
  { loanId: 'BZV8U2T3WU', loanName: 'USC 2025 7.90',  school: 'USC',                      loanStartDate: '2025-02-09', purchaseDate: '2025-02-19', principal: 9000,  purchasePrice: 9000,  nominalRate: 7.90, termYears: 7,  graceYears: 0.5, balance: 7687.85,  ownershipPct: 1.00, events: [],                       loanColor: '#8b5cf6' },
  { loanId: 'HXLBADG3MP', loanName: 'PSU 2025 8.10',  school: 'Penn State',               loanStartDate: '2025-02-28', purchaseDate: '2025-05-31', principal: 8500,  purchasePrice: 6500,  nominalRate: 8.10, termYears: 9,  graceYears: 1,   balance: 9165.74,  ownershipPct: 0.50, events: [],                       loanColor: '#f97316' },
  { loanId: 'X0S5QZ4WHE', loanName: 'NYU 2025 8.70',  school: 'NYU',                      loanStartDate: '2025-04-04', purchaseDate: '2025-09-23', principal: 8200,  purchasePrice: 4100,  nominalRate: 8.70, termYears: 10, graceYears: 1,   balance: 8942.55,  ownershipPct: 0.50, events: [],                       loanColor: '#14b8a6' },
  { loanId: 'EOJYIFL33F', loanName: 'PSU 2024 9.00',  school: 'Penn State',               loanStartDate: '2024-12-31', purchaseDate: '2025-02-04', principal: 7000,  purchasePrice: 7000,  nominalRate: 9.00, termYears: 10, graceYears: 2,   balance: 7830.22,  ownershipPct: 1.00, events: [],                       loanColor: '#ec4899' },
  { loanId: 'BHH0A15A7A', loanName: 'USC 2025 7.90',  school: 'USC',                      loanStartDate: '2025-02-09', purchaseDate: '2025-02-09', principal: 9000,  purchasePrice: 9000,  nominalRate: 7.90, termYears: 7,  graceYears: 0.5, balance: 8721.21,  ownershipPct: 1.00, events: [],                       loanColor: '#06b6d4' },
];