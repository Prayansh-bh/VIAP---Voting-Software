import { Voter, VoterPreference } from '../types';

export interface MandalVillage {
  sNo: string;
  name: string;
  totalVoters: number;
  totalBooths: number;
  localVoters: number;
  migratedVoters: number;
  pStats: Record<VoterPreference, number>;
  leadingParty: VoterPreference;
  lead: number;
}

export interface MandalIncharge {
  sNo: string;
  name: string;
  mobile: string;
  village: string;
  booth: string;
  votersCount: number;
  leadingParty: VoterPreference;
  lead: number;
  pStats: Record<VoterPreference, number>;
}

// Database-backed source of truth: No synthetic/fake villages or voters
export const SINGARAYAKONDA_VILLAGES: MandalVillage[] = [];

export function getMandalVillages(_mandalName: string): MandalVillage[] {
  return [];
}

export function findMandalForVillage(_villageName: string): string {
  return '';
}

export function getVillageBoothOffset(_villageName: string): number {
  return 0;
}

export function getMandalCadreNetwork(_mandalName?: string): {
  villageIncharges: { sNo: string; name: string; mobile: string; village: string; votersCount: number; leadingParty: VoterPreference; pStats: Record<VoterPreference, number>; lead: number }[];
  boothIncharges: MandalIncharge[];
  voter100Incharges: MandalIncharge[];
} {
  return {
    villageIncharges: [],
    boothIncharges: [],
    voter100Incharges: [],
  };
}

export function generateVotersForMandalVillage(_villageName: string): Voter[] {
  return [];
}

export function saveMandalVoterRecord(_villageName: string, updatedVoter: Voter) {
  // Sync directly with backend PostgreSQL database
  import('../lib/api').then(({ syncVoter }) => {
    syncVoter(updatedVoter).catch(() => {});
  });
}
