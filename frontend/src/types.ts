/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type RoleType = 
  | 'SUPER_ADMIN'
  | 'STATE_ADMIN'
  | 'ZONE_INCHARGE'
  | 'PARLIAMENT_INCHARGE'
  | 'CONSTITUENCY_INCHARGE'
  | 'MANDAL_INCHARGE'
  | 'VILLAGE_INCHARGE'
  | 'BOOTH_PRESIDENT'
  | 'VOTER_100_INCHARGE'
  | 'POLLING_AGENT'
  | 'VIEWER';

export interface CommandRole {
  id: RoleType;
  name: string;
  subtitle: string;
  description: string;
  path: string;
  iconName: string;
}

export interface UserSession {
  userName: string;
  mobileNumber: string;
  role: RoleType;
  unitId: string;
  assignedState?: string;
  assignedZone?: string;
  assignedParliament?: string;
  assignedConstituency?: string;
  assignedMandal?: string;
  assignedVillage?: string;
  assignedBooth?: string;
  assignedVoterGroup?: string;
  userId: string;
  accountStatus: 'Active' | 'Pending' | 'Suspended';
  organisationId?: string;
  organisation?: { id: string; name: string; code: string };
}

export interface MandalData {
  name: string;
  villages: {
    name: string;
    booths: {
      number: string;
      voterGroups: string[];
    }[];
  }[];
}

// Hierarchy Data representing actual Kondapi Constituency Mandals and major villages/booths
export const KONDAPI_HIERARCHY: MandalData[] = [
  {
    name: "Kondapi",
    villages: [
      {
        name: "Kondapi Village",
        booths: [
          { number: "Booth 145 (ZPHS North)", voterGroups: ["Team A (Voters 1-100)", "Team B (Voters 101-200)"] },
          { number: "Booth 146 (ZPHS South)", voterGroups: ["Team C (Voters 201-300)", "Team D (Voters 301-400)"] }
        ]
      },
      {
        name: "Chinna Venkanna Palem",
        booths: [
          { number: "Booth 147 (MPPS)", voterGroups: ["Team Alpha (Voters 1-110)", "Team Beta (Voters 111-215)"] }
        ]
      },
      {
        name: "Mupparajuvari Palem",
        booths: [
          { number: "Booth 148 (Community Hall)", voterGroups: ["Team A", "Team B"] }
        ]
      }
    ]
  },
  {
    name: "Singarayakonda",
    villages: [
      {
        name: "Singarayakonda Village",
        booths: [
          { number: "Booth 182 (MPPS West)", voterGroups: ["Team 1 (Voters 1-100)", "Team 2 (Voters 101-200)"] },
          { number: "Booth 183 (MPPS East)", voterGroups: ["Team 3 (Voters 201-300)", "Team 4 (Voters 301-400)"] }
        ]
      },
      {
        name: "Somarajupalli",
        booths: [
          { number: "Booth 184 (ZPH School)", voterGroups: ["Team Somaraju A", "Team Somaraju B"] }
        ]
      },
      {
        name: "Pakala",
        booths: [
          { number: "Booth 185 (MPPS pakala)", voterGroups: ["Team Pakala 1", "Team Pakala 2"] },
          { number: "Booth 186 (Panchayat Office)", voterGroups: ["Team Pakala 3"] }
        ]
      }
    ]
  },
  {
    name: "Tangutur",
    villages: [
      {
        name: "Tangutur Town",
        booths: [
          { number: "Booth 102 (ZPHS Boys)", voterGroups: ["Team TG-1", "Team TG-2"] },
          { number: "Booth 103 (ZPHS Girls)", voterGroups: ["Team TG-3", "Team TG-4"] }
        ]
      },
      {
        name: "Alakurapadu",
        booths: [
          { number: "Booth 104 (Panchayat Office)", voterGroups: ["Team AK-1", "Team AK-2"] }
        ]
      },
      {
        name: "Kondamuru",
        booths: [
          { number: "Booth 105 (MPPS)", voterGroups: ["Team KM-1"] }
        ]
      }
    ]
  },
  {
    name: "Jarugumalli",
    villages: [
      {
        name: "Jarugumalli Village",
        booths: [
          { number: "Booth 76 (ZPH School)", voterGroups: ["Team JM-A", "Team JM-B"] }
        ]
      },
      {
        name: "Kamepalli",
        booths: [
          { number: "Booth 77 (MPPS)", voterGroups: ["Team KP-1", "Team KP-2"] }
        ]
      }
    ]
  },
  {
    name: "Ponnaluru",
    villages: [
      {
        name: "Ponnaluru Village",
        booths: [
          { number: "Booth 52 (MPPS Center)", voterGroups: ["Team PL-A", "Team PL-B"] }
        ]
      },
      {
        name: "Vellalacheruvu",
        booths: [
          { number: "Booth 53 (ZPHS)", voterGroups: ["Team VC-1", "Team VC-2"] }
        ]
      }
    ]
  },
  {
    name: "Marripudi",
    villages: [
      {
        name: "Marripudi Village",
        booths: [
          { number: "Booth 21 (Govt. Jr College)", voterGroups: ["Team MP-A", "Team MP-B"] }
        ]
      },
      {
        name: "Chimata",
        booths: [
          { number: "Booth 22 (MPPS)", voterGroups: ["Team CM-1", "Team CM-2"] }
        ]
      }
    ]
  }
];

export type VoterPreference = 'TDP' | 'YSRCP' | 'JSP' | 'BJP' | 'INC' | 'Neutral' | 'OTH';

export type VoterStatus = 'Active' | 'Shifted' | 'Deceased' | 'Duplicate' | 'Fake' | 'Doubtful' | 'Unknown';

export type SurveyStatus = 'Not Surveyed' | 'Surveyed' | 'Verified';

export interface Voter {
  id: string;
  serialNumber: number;
  epicNumber: string;
  name: string;
  fatherHusbandName: string;
  relationType: 'Father' | 'Husband' | 'Mother' | 'Other';
  houseNumber: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  mobileNumber: string;
  // Location
  assemblyConstituency: string;
  mandal: string;
  village: string;
  boothNumber: string;
  assignedVoterGroup: string;
  // Assignment
  assignedInchargeId: string;
  // Survey Information
  politicalPreference: VoterPreference;
  voterStatus: VoterStatus;
  surveyStatus: SurveyStatus;
  notes: string;
  lastUpdated: string;
  updatedBy: string;
  otherPreferenceRemarks?: string;
  caste?: string;
  subCaste?: string;
  profession?: string;
  voterLocationStatus?: 'Local' | 'Migrated';
  currentLocation?: string;
  // Live Voter Track fields
  voteStatus?: 'NOT VOTED' | 'VOTE DONE';
  voteDoneTime?: string;
  inchargeAssessment?: VoterPreference | 'Unknown';
  liveTrackCreatedTime?: string;
  liveTrackLastUpdatedTime?: string;
}

export interface GroundReport {
  id: string;
  inchargeId: string;
  inchargeName: string;
  constituency: string;
  mandal: string;
  village: string;
  booth: string;
  unitId?: string;
  createdById?: string;
  hierarchyLevel?: string;
  title?: string;
  date: string;
  time: string;
  reportType: 'General Update' | 'Complaint / Issue';
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  description: string;
  status: 'Pending' | 'Resolved' | 'In Progress';
  // Extra fields for Complaint
  issueCategory?: string;
  affectedVotersCount?: number;
  location?: string;
}

export interface VoterTask {
  id: string;
  title: string;
  instructions: string;
  assignedBy: string;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  assignedDate: string;
  dueDate: string;
  status: 'Pending' | 'In Progress' | 'Completed';
  assignedTo?: string;
  assigneeId?: string;
  sourceUnitId?: string;
  targetUnitId?: string;
  targetRole?: RoleType;
  sourceHierarchyLevel?: string;
  targetHierarchyLevel?: string;
}

export interface ChildAnalyticsItem {
  id: string;
  name: string;
  code?: string;
  totalVoters: number;
  votedCount: number;
  turnoutPercentage: number;
  totalBooths?: number;
  totalVillages?: number;
  totalMandals?: number;
  totalConstituencies?: number;
  items?: any[];
}

export interface TrainingVideo {
  id: string;
  title: string;
  description: string;
  category: string;
  duration: string;
  thumbnailUrl: string;
  youtubeId?: string;
}


