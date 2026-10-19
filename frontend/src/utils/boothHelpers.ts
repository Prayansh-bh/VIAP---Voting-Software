import { Voter, VoterPreference, TrainingVideo, VoterTask } from '../types';

export const TOTAL_BOOTH_VOTERS = 0;

export interface InchargeDetail {
  id: string;
  name: string;
  mobile: string;
  group: string;
  offset: number;
  votersCount: number;
  booth: string;
}

export const INCHARGES: InchargeDetail[] = [];

export function getPreferenceForVoter(_absoluteIndex: number): VoterPreference {
  return 'Neutral';
}

export function generateInitialVotersForTeam(
  _inchargeId: string, 
  _mandal: string, 
  _village: string, 
  _booth: string, 
  _group: string,
  _offset: number,
  _count: number = 0
): Voter[] {
  return [];
}

export function loadVotersForIncharge(_inchargeId: string, _boothName: string = ''): Voter[] {
  return [];
}

export function loadAllBoothVoters(_boothName: string = ''): Voter[] {
  return [];
}

export function getBoothForIncharge(_inchargeId: string): string {
  return '';
}

export function loadAllVillageVoters(): Voter[] {
  return [];
}

export function saveVoterRecord(voter: Voter) {
  // Asynchronously persist to backend PostgreSQL database
  import('../lib/api').then(({ syncVoter }) => {
    syncVoter(voter).catch(() => {});
  });
}

export const TRAINING_VIDEOS: TrainingVideo[] = [
  {
    id: "vid-1",
    title: "Booth Incharge – Roles & Responsibilities",
    description: "Walkthrough of your essential leadership duties, daily targets, and standard operating protocols.",
    category: "Operations",
    duration: "12 mins",
    thumbnailUrl: "https://images.unsplash.com/photo-1450133064473-71024230f91b?w=600&auto=format&fit=crop&q=80",
    youtubeId: "dQw4w9WgXcQ"
  },
  {
    id: "vid-2",
    title: "Managing 100 Voter Incharges & Cadre Network",
    description: "Insights into assigning tasks, tracking progress, and coordinating with your Sector/Cadre Incharges.",
    category: "Cadre Management",
    duration: "15 mins",
    thumbnailUrl: "https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=600&auto=format&fit=crop&q=80",
    youtubeId: "dQw4w9WgXcQ"
  },
  {
    id: "vid-3",
    title: "Voter Profiles, Political Preference & Data Updating",
    description: "Best practices for auditing elector preferences, managing caste statistics, and flagging fake or deceased registrations.",
    category: "Data & Audit",
    duration: "18 mins",
    thumbnailUrl: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&auto=format&fit=crop&q=80",
    youtubeId: "dQw4w9WgXcQ"
  },
  {
    id: "vid-4",
    title: "Election Day Live Voter Tracking",
    description: "Guide to monitoring hourly voting turnout, tagging voted citizens, and mobilizing remaining supporters.",
    category: "Election Day",
    duration: "10 mins",
    thumbnailUrl: "https://images.unsplash.com/photo-1540910419892-4a36d2c3266c?w=600&auto=format&fit=crop&q=80",
    youtubeId: "dQw4w9WgXcQ"
  },
  {
    id: "vid-5",
    title: "Booth-Level Voter, Caste & Demographic Analysis",
    description: "Deep dive into demographic breakdowns, caste-wise voting patterns, and visual data intelligence tools.",
    category: "Analytics",
    duration: "14 mins",
    thumbnailUrl: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&auto=format&fit=crop&q=80",
    youtubeId: "dQw4w9WgXcQ"
  },
  {
    id: "vid-6",
    title: "Election Day Booth Management & Reporting",
    description: "Final checklist for managing polling agents, lodging complaints, and reporting emergency updates to the command center.",
    category: "Compliance",
    duration: "16 mins",
    thumbnailUrl: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=600&auto=format&fit=crop&q=80",
    youtubeId: "dQw4w9WgXcQ"
  }
];

export const INITIAL_BOOTH_TASKS: VoterTask[] = [];
