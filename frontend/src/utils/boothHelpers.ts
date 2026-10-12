import { Voter, VoterPreference, VoterStatus, SurveyStatus, TrainingVideo, VoterTask } from '../types';

export const TOTAL_BOOTH_VOTERS = 1247;

const INCHARGE_NAMES = [
  "K. Srinivasa Rao", "P. Venkatrao", "G. Lakshmamma", "S. Chenchaiah", "M. Krishnaiah",
  "Ch. Venkaiah", "T. Ramanamma", "B. Koteswara Rao", "Y. Satyanarayana", "D. Hari Babu",
  "R. Vasudeva Rao", "S. Yedukondalu", "V. Ramanaiah",
  "P. Subbarayudu", "K. Rajeswari", "M. Ankama Rao", "T. Narayana", "G. Venkateswara Rao",
  "Ch. Rama Devi", "S. Anusha", "V. Koteswara Rao", "D. Prasada Rao", "R. Siva Prasad",
  "K. Venkata Ramana", "G. Subba Rao", "M. Lakshmi",
  "P. Raghavulu", "S. Chenchuramaiah", "T. Mastan Rao", "B. Adilakshmi", "Y. Venkateswarlu",
  "D. Srinivasulu", "R. Ramanamma", "K. Chenchaiah", "G. Narayana Swamy", "M. Veerabhadra Rao",
  "P. Venkata Subbaiah", "S. Ramanjaneyulu"
];

const INCHARGE_MOBILES = [
  "9440261145", "9848556677", "9966112233", "9177889900", "9848011223",
  "9441122334", "9000123456", "9123456789", "9345678901", "9456789012",
  "9567890123", "9678901234", "9789012345", "9890123456", "9901234567",
  "9012345678", "9123456780", "9234567891", "9345678912", "9456789123",
  "9567891234", "9678912345", "9789123456", "9890123457", "9901234568",
  "9012345679", "9123456781", "9234567892", "9345678913", "9456789124",
  "9567891235", "9678912346", "9789123457", "9890123458", "9901234569",
  "9012345680", "9123456782", "9234567893"
];

export interface InchargeDetail {
  id: string;
  name: string;
  mobile: string;
  group: string;
  offset: number;
  votersCount: number;
  booth: string;
}

const BOOTH_SPECS = [
  { booth: "Booth 145", totalVoters: 1247, count: 13 },
  { booth: "Booth 146", totalVoters: 1210, count: 12 },
  { booth: "Booth 147", totalVoters: 1183, count: 12 }
];

export const INCHARGES: InchargeDetail[] = [];

let overallInchargeIndex = 0;
BOOTH_SPECS.forEach(spec => {
  for (let index = 0; index < spec.count; index++) {
    const teamNum = String(index + 1).padStart(2, '0');
    const votersCount = (overallInchargeIndex === 36) ? 40 : 100;
    const offset = overallInchargeIndex * 100;
    
    INCHARGES.push({
      id: `100-INC-${4592 + overallInchargeIndex}`,
      name: INCHARGE_NAMES[overallInchargeIndex] || `Incharge ${teamNum}`,
      mobile: INCHARGE_MOBILES[overallInchargeIndex] || `9440${5000 + overallInchargeIndex}`,
      group: `Team ${teamNum}`,
      offset,
      votersCount,
      booth: spec.booth
    });
    overallInchargeIndex++;
  }
});

let cachedVillagePrefs: VoterPreference[] | null = null;

export function getPreferenceForVoter(absoluteIndex: number): VoterPreference {
  if (!cachedVillagePrefs) {
    const prefs145: VoterPreference[] = [];
    const targets145 = { TDP: 620, YSRCP: 320, JSP: 110, BJP: 50, INC: 30, Neutral: 87, OTH: 30 };
    (Object.keys(targets145) as VoterPreference[]).forEach(p => {
      for (let i = 0; i < targets145[p]; i++) prefs145.push(p);
    });
    
    const prefs146: VoterPreference[] = [];
    const targets146 = { TDP: 400, YSRCP: 480, JSP: 120, BJP: 50, INC: 30, Neutral: 93, OTH: 37 };
    (Object.keys(targets146) as VoterPreference[]).forEach(p => {
      for (let i = 0; i < targets146[p]; i++) prefs146.push(p);
    });
    
    const prefs147: VoterPreference[] = [];
    const targets147 = { TDP: 630, YSRCP: 180, JSP: 150, BJP: 50, INC: 40, Neutral: 100, OTH: 33 };
    (Object.keys(targets147) as VoterPreference[]).forEach(p => {
      for (let i = 0; i < targets147[p]; i++) prefs147.push(p);
    });
    
    // Deterministically shuffle each array using a simple seed
    const shuffle = (arr: VoterPreference[], seed: number) => {
      let currentSeed = seed;
      const random = () => {
        const x = Math.sin(currentSeed++) * 10000;
        return x - Math.floor(x);
      };
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        const temp = arr[i];
        arr[i] = arr[j];
        arr[j] = temp;
      }
    };
    
    shuffle(prefs145, 145);
    shuffle(prefs146, 146);
    shuffle(prefs147, 147);
    
    cachedVillagePrefs = [...prefs145, ...prefs146, ...prefs147];
  }
  
  return cachedVillagePrefs[absoluteIndex] || 'Neutral';
}

const TELUGU_FIRST_NAMES = [
  "Srinivasa Rao", "Venkateswarlu", "Ramanaiah", "Subba Rao", "Lakshmi Prasanna",
  "Ramanamma", "Koteswara Rao", "Prasad", "Sivaiah", "Satyanarayana",
  "Anjali Devi", "Suresh Babu", "Rajesh", "Rama Devi", "Venkata Krishna",
  "Chenchaiah", "Krishnaiah", "Malyadri", "Saraswathi", "Gopalakrishna",
  "Adinarayana", "Bhavani", "Chandra Sekhar", "Durga Rao", "Hari Babu",
  "Jagadeesh", "Kalyani", "Nageswara Rao", "Padmavathi", "Ranga Rao",
  "Sambasiva Rao", "Triveni", "Vasudeva Rao", "Yedukondalu", "Sreenu"
];

const TELUGU_LAST_NAMES = [
  "Gaddipati", "Marella", "Bollineni", "Chundi", "Yeluri",
  "Damarla", "Nelaturi", "Ravipudi", "Dara", "Mupparaju",
  "Nalamothu", "Kolla", "Myneni", "Kakumanu", "Gorantla",
  "Talluri", "Polavarapu", "Vasireddy", "Kondragunta", "Repalle"
];

const COMMON_CASTES = [
  "Madiga", "Mala", "Reddy", "Kamma", "Yanadi", "Yerukula", "Dommara", "Yadava",
  "Chakali", "Mangali", "Banda", "Kamsali", "Vysya", "Brahmin", "Muslim", "Dudekula", "Other"
];
const COMMON_SUB_CASTES = [
  "Adi Andhra", "Adi Dravida", "Reddy", "Chowdary", "None", "Golla", "Rajaka", "Nayee", "Achari", "Setty", "Sastri", "Shaik", "Pinjari"
];

function getCasteForIndex(index: number): { caste: string, subCaste: string } {
  const distribution = [
    { name: "Madiga", count: 550, subCaste: "Adi Andhra" },
    { name: "Mala", count: 500, subCaste: "Adi Dravida" },
    { name: "Kamma", count: 450, subCaste: "Chowdary" },
    { name: "Chakali", count: 380, subCaste: "Rajaka" },
    { name: "Yanadi", count: 340, subCaste: "None" },
    { name: "Yerukula", count: 300, subCaste: "None" },
    { name: "Yadava", count: 280, subCaste: "Golla" },
    { name: "Reddy", count: 200, subCaste: "Reddy" },
    { name: "Muslim", count: 180, subCaste: "Shaik" },
    { name: "Dommara", count: 70, subCaste: "None" },
    { name: "Mangali", count: 70, subCaste: "Nayee" },
    { name: "Banda", count: 60, subCaste: "None" },
    { name: "Kamsali", count: 60, subCaste: "Achari" },
    { name: "Vysya", count: 50, subCaste: "Setty" },
    { name: "Brahmin", count: 50, subCaste: "Sastri" },
    { name: "Dudekula", count: 50, subCaste: "Pinjari" },
    { name: "Other", count: 50, subCaste: "None" }
  ];

  let cumulative = 0;
  for (const item of distribution) {
    cumulative += item.count;
    if (index < cumulative) {
      return { caste: item.name, subCaste: item.subCaste };
    }
  }
  return { caste: "Other", subCaste: "None" };
}
const PROFESSION_PRESETS = [
  "Agriculture", "Farmer", "Agricultural Labour", "Government Employee",
  "Private Employee", "Business", "Self Employed", "Student", "Homemaker",
  "Daily Wage Worker", "Driver", "Teacher", "Retired", "Unemployed"
];

export function generateInitialVotersForTeam(
  inchargeId: string, 
  mandal: string, 
  village: string, 
  booth: string, 
  group: string,
  offset: number,
  count: number = 100
): Voter[] {
  const voters: Voter[] = [];
  
  const inchargeIndex = INCHARGES.findIndex(inc => inc.id === inchargeId);
  let globalOffset = 0;
  if (inchargeIndex !== -1) {
    for (let j = 0; j < inchargeIndex; j++) {
      globalOffset += INCHARGES[j].votersCount;
    }
  } else {
    globalOffset = offset;
  }
  
  // Deterministic seed based on incharge ID to keep data consistent
  let seed = 0;
  for (let i = 0; i < inchargeId.length; i++) {
    seed += inchargeId.charCodeAt(i);
  }

  const random = () => {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  };

  const getRandomElement = <T,>(arr: T[]): T => {
    return arr[Math.floor(random() * arr.length)];
  };

  const statuses: VoterStatus[] = Array(count).fill('Active');
  if (count > 8) statuses[8] = 'Shifted';
  if (count > 22) statuses[22] = 'Deceased';
  if (count > 41) statuses[41] = 'Duplicate';
  if (count > 59) statuses[59] = 'Fake';
  if (count > 71) statuses[71] = 'Doubtful';
  if (count > 83) statuses[83] = 'Doubtful';

  const surveyStatuses: SurveyStatus[] = Array(count).fill('Surveyed');
  // 12% Not Surveyed, 12% Verified, 76% Surveyed
  const notSurveyedCount = Math.round(count * 0.12);
  const verifiedCount = Math.round(count * 0.12);
  for (let i = 0; i < notSurveyedCount; i++) {
    surveyStatuses[i] = 'Not Surveyed';
  }
  for (let i = count - verifiedCount; i < count; i++) {
    if (i >= 0 && i < count) {
      surveyStatuses[i] = 'Verified';
    }
  }

  // Vote status for Live Voter Track (e.g. 60% completed Vote Done)
  // We'll mark approximately 60% voters as VOTE DONE
  const voteStatuses: ('VOTE DONE' | 'NOT VOTED')[] = Array(count).fill('NOT VOTED');
  for (let i = 0; i < count; i++) {
    if ((i * 17) % 10 < 6) { // ~60% turnout
      voteStatuses[i] = 'VOTE DONE';
    }
  }

  for (let i = 1; i <= count; i++) {
    const globalSerial = offset + i;
    const lastName = getRandomElement(TELUGU_LAST_NAMES);
    const firstName = getRandomElement(TELUGU_FIRST_NAMES);
    const middleName = getRandomElement(TELUGU_FIRST_NAMES);
    
    const name = `${lastName} ${firstName}`;
    const fatherHusbandName = `${lastName} ${middleName}`;
    const gender = random() > 0.48 ? 'Male' as const : 'Female' as const;
    const relationType = gender === 'Female' && random() > 0.5 ? 'Husband' as const : 'Father' as const;
    
    const age = Math.floor(18 + random() * 65);
    const houseNo = `${Math.floor(1 + random() * 5)}-${Math.floor(10 + random() * 150)}`;
    const epicNum = "KDP" + Math.floor(1000000 + random() * 9000000);
    const mobileNo = "9" + Math.floor(100000000 + random() * 900000000);
    
    const absoluteVoterIndex = globalOffset + i - 1;
    const pref = getPreferenceForVoter(absoluteVoterIndex);
    const status = statuses[i - 1] || 'Active';
    const survStatus = surveyStatuses[i - 1] || 'Surveyed';
    const voteStatus = voteStatuses[i - 1] || 'NOT VOTED';

    const shuffledIndex = (absoluteVoterIndex * 157) % 3640;
    const { caste: seededCaste, subCaste: seededSubCaste } = getCasteForIndex(shuffledIndex);
    const seededProfession = getRandomElement(PROFESSION_PRESETS);

    let notes = "";
    if (status === 'Fake') notes = "Reported suspicious: voter is not resident of this booth.";
    else if (status === 'Shifted') notes = "Migrated to Hyderabad 2 years ago for work.";
    else if (status === 'Deceased') notes = "Voter passed away in late 2025.";
    else if (pref === 'TDP') notes = "Strong TDP supporter.";
    else if (pref === 'Neutral') notes = "Uncommitted. Waiting for campaign visits.";

    // Determine an incharge assessment for live tracking (Vote Done only)
    // Most follow their political preference, but some might change or be Unknown
    let inchargeAssessment: VoterPreference | 'Unknown' = 'Unknown';
    if (voteStatus === 'VOTE DONE') {
      inchargeAssessment = (random() > 0.15) ? pref : 'Unknown';
    }

    const isMigrated = (absoluteVoterIndex % 91) < 11;
    const voterLocationStatus = isMigrated ? 'Migrated' as const : 'Local' as const;
    const migrationLocations = ["Hyderabad", "Bengaluru", "Chennai", "Vijayawada", "Guntur", "Ongole", "Other State", "Abroad"];
    const currentLocation = isMigrated ? migrationLocations[absoluteVoterIndex % migrationLocations.length] : undefined;

    voters.push({
      id: `${inchargeId}-voter-${i}`,
      serialNumber: globalSerial,
      epicNumber: epicNum,
      name,
      fatherHusbandName,
      relationType,
      houseNumber: houseNo,
      age,
      gender,
      mobileNumber: mobileNo,
      assemblyConstituency: "Kondapi Assembly Constituency",
      mandal,
      village,
      boothNumber: booth,
      assignedVoterGroup: group,
      assignedInchargeId: inchargeId,
      politicalPreference: pref,
      voterStatus: status,
      surveyStatus: survStatus,
      notes,
      lastUpdated: new Date(Date.now() - (i * 3600000 * 4)).toISOString().split('T')[0],
      updatedBy: inchargeId,
      caste: seededCaste,
      subCaste: seededSubCaste,
      profession: seededProfession,
      voteStatus,
      voteDoneTime: voteStatus === 'VOTE DONE' ? `${Math.floor(7 + (i % 11))} : ${String(10 + (i % 50)).padStart(2, '0')} ${i % 2 === 0 ? 'AM' : 'PM'}` : undefined,
      inchargeAssessment,
      voterLocationStatus,
      currentLocation
    });
  }

  return voters;
}

const voterMemoryCache = new Map<string, Voter[]>();

export function loadVotersForIncharge(inchargeId: string, boothName: string = "Booth 145"): Voter[] {
  const inc = INCHARGES.find(i => i.id === inchargeId);
  const cacheKey = `voters_${inchargeId}`;
  if (voterMemoryCache.has(cacheKey)) {
    return voterMemoryCache.get(cacheKey)!;
  }

  if (!inc) {
    const seeded = generateInitialVotersForTeam(inchargeId, 'Ponnaluru Mandal', 'Ponnaluru', boothName, 'Team 01', 0, 100);
    voterMemoryCache.set(cacheKey, seeded);
    return seeded;
  }

  const seeded = generateInitialVotersForTeam(inc.id, 'Ponnaluru Mandal', 'Ponnaluru', inc.booth, inc.group, inc.offset, inc.votersCount);
  voterMemoryCache.set(cacheKey, seeded);
  return seeded;
}

export function loadAllBoothVoters(boothName: string): Voter[] {
  let allVoters: Voter[] = [];
  const parsedBoothName = boothName.includes('145') ? 'Booth 145' : boothName.includes('146') ? 'Booth 146' : 'Booth 147';
  const boothIncharges = INCHARGES.filter(inc => inc.booth === parsedBoothName);
  
  boothIncharges.forEach((inc) => {
    const teamVoters = loadVotersForIncharge(inc.id, inc.booth);
    allVoters = allVoters.concat(teamVoters);
  });
  return allVoters;
}

export function getBoothForIncharge(inchargeId: string): string {
  const inc = INCHARGES.find(i => i.id === inchargeId);
  return inc ? inc.booth : "Booth 145";
}

export function loadAllVillageVoters(): Voter[] {
  let allVoters: Voter[] = [];
  INCHARGES.forEach((inc) => {
    const teamVoters = loadVotersForIncharge(inc.id, inc.booth);
    allVoters = allVoters.concat(teamVoters);
  });
  return allVoters;
}

export function saveVoterRecord(voter: Voter) {
  const inchargeId = voter.assignedInchargeId;
  const cacheKey = `voters_${inchargeId}`;
  if (voterMemoryCache.has(cacheKey)) {
    const teamVoters = voterMemoryCache.get(cacheKey)!;
    const updated = teamVoters.map(v => v.id === voter.id ? voter : v);
    voterMemoryCache.set(cacheKey, updated);
  }

  // Asynchronously persist to backend PostgreSQL database
  import('../lib/api').then(({ syncVoter }) => {
    syncVoter(voter).catch(() => {});
  });
}

export const TRAINING_VIDEOS: TrainingVideo[] = [
  {
    id: "vid-1",
    title: "Booth Incharge – Roles & Responsibilities",
    description: "Comprehensive walkthrough of your essential leadership duties, daily targets, and standard operating protocols.",
    category: "Operations",
    duration: "12 mins",
    thumbnailUrl: "https://images.unsplash.com/photo-1450133064473-71024230f91b?w=600&auto=format&fit=crop&q=80",
    youtubeId: "dQw4w9WgXcQ"
  },
  {
    id: "vid-2",
    title: "Managing 100 Voter Incharges & Cadre Network",
    description: "Strategic insights into assigning tasks, tracking progress, and coordinating with your 13 Sector/Cadre Incharges.",
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

export const INITIAL_BOOTH_TASKS: VoterTask[] = [
  {
    id: "booth-task-1",
    title: "100% Door-to-Door Slip Distribution",
    instructions: "Ensure all 4 teams distribute printed voter slips with QR codes to every family in the booth jurisdiction by Friday.",
    assignedBy: "Booth Incharge",
    priority: "Urgent",
    assignedDate: "2026-07-28",
    dueDate: "2026-08-01",
    status: "In Progress",
    assignedTo: "100-INC-4592" // Assigned to Team A
  },
  {
    id: "booth-task-2",
    title: "Verify Shifted Voter Physical Status",
    instructions: "Physically verify whether voters flagged as Shifted/Migrated are living in town or have permanently registered elsewhere.",
    assignedBy: "Booth Incharge",
    priority: "High",
    assignedDate: "2026-07-26",
    dueDate: "2026-07-31",
    status: "Pending",
    assignedTo: "100-INC-4594" // Assigned to Team C
  }
];
