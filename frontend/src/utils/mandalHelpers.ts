import { Voter, VoterPreference, VoterStatus, SurveyStatus, TrainingVideo, VoterTask, GroundReport } from '../types';

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

export const SINGARAYAKONDA_VILLAGES: MandalVillage[] = [
  {
    sNo: "#01",
    name: "Kalikivaya",
    totalVoters: 2443,
    totalBooths: 3,
    localVoters: 2150,
    migratedVoters: 293,
    pStats: { TDP: 1462, YSRCP: 862, JSP: 0, BJP: 0, INC: 0, Neutral: 119, OTH: 0 },
    leadingParty: "TDP",
    lead: 600
  },
  {
    sNo: "#02",
    name: "Patha Singarayakonda",
    totalVoters: 2061,
    totalBooths: 2,
    localVoters: 1800,
    migratedVoters: 261,
    pStats: { TDP: 1130, YSRCP: 830, JSP: 0, BJP: 0, INC: 0, Neutral: 101, OTH: 0 },
    leadingParty: "TDP",
    lead: 300
  },
  {
    sNo: "#03",
    name: "Sanampudi",
    totalVoters: 4624,
    totalBooths: 6,
    localVoters: 4070,
    migratedVoters: 554,
    pStats: { TDP: 3049, YSRCP: 1349, JSP: 0, BJP: 0, INC: 0, Neutral: 226, OTH: 0 },
    leadingParty: "TDP",
    lead: 1700
  },
  {
    sNo: "#04",
    name: "Singarayakonda",
    totalVoters: 17200,
    totalBooths: 22,
    localVoters: 15150,
    migratedVoters: 2050,
    pStats: { TDP: 8029, YSRCP: 8329, JSP: 0, BJP: 0, INC: 0, Neutral: 842, OTH: 0 },
    leadingParty: "YSRCP",
    lead: 300
  },
  {
    sNo: "#05",
    name: "Kanumala",
    totalVoters: 2183,
    totalBooths: 3,
    localVoters: 1920,
    migratedVoters: 263,
    pStats: { TDP: 1388, YSRCP: 688, JSP: 0, BJP: 0, INC: 0, Neutral: 107, OTH: 0 },
    leadingParty: "TDP",
    lead: 700
  },
  {
    sNo: "#06",
    name: "Pakala",
    totalVoters: 7530,
    totalBooths: 8,
    localVoters: 6630,
    migratedVoters: 900,
    pStats: { TDP: 3231, YSRCP: 3931, JSP: 0, BJP: 0, INC: 0, Neutral: 368, OTH: 0 },
    leadingParty: "YSRCP",
    lead: 700
  },
  {
    sNo: "#07",
    name: "Woollapalem",
    totalVoters: 4349,
    totalBooths: 5,
    localVoters: 3830,
    migratedVoters: 519,
    pStats: { TDP: 2668, YSRCP: 1468, JSP: 0, BJP: 0, INC: 0, Neutral: 213, OTH: 0 },
    leadingParty: "TDP",
    lead: 1200
  },
  {
    sNo: "#08",
    name: "Binginapalli",
    totalVoters: 2398,
    totalBooths: 3,
    localVoters: 2110,
    migratedVoters: 288,
    pStats: { TDP: 1100, YSRCP: 1180, JSP: 0, BJP: 0, INC: 0, Neutral: 118, OTH: 0 },
    leadingParty: "YSRCP",
    lead: 80
  },
  {
    sNo: "#09",
    name: "Mulagunta Padu",
    totalVoters: 4300,
    totalBooths: 2,
    localVoters: 3800,
    migratedVoters: 500,
    pStats: { TDP: 2944, YSRCP: 1144, JSP: 0, BJP: 0, INC: 0, Neutral: 212, OTH: 0 },
    leadingParty: "TDP",
    lead: 1800
  },
  {
    sNo: "#10",
    name: "Somaraju Palli",
    totalVoters: 5159,
    totalBooths: 6,
    localVoters: 4540,
    migratedVoters: 619,
    pStats: { TDP: 3053, YSRCP: 1853, JSP: 0, BJP: 0, INC: 0, Neutral: 253, OTH: 0 },
    leadingParty: "TDP",
    lead: 1200
  }
];

export const KONDAPI_NAMES = [
  "Peridepi", "Anakarlapudi", "Mupparajupalem", "Ilavara", "K. Uppalapadu",
  "Kondapi", "Muppavaram", "Chodavaram", "Goginenivaripalem", "Mittapalem",
  "Pedakandlagunta", "Chinakandalagunta", "Nennurupadu", "Gurrappadiya",
  "Mugachintala", "Vennuru", "Chinavenkannapalem", "Kattubadipalem", "Petluru"
];

export const MARRIPUDI_NAMES = [
  "Garlapeta", "Vemavaram", "Ayyaparajupalem", "Narasarajupalem", "Thangella",
  "Chimata", "Ramayapalem", "Ravillavaripalem", "Dharmavaram", "Juvvigunta",
  "Venkatakrishna", "Pannuru", "Vallayapalem", "Chilamkuru", "Kakarla",
  "Marripudi", "Regalagedda", "Gundlasamudram", "Ankepalli", "Kuchipudi",
  "Kellampalli"
];

export const PONNALURU_NAMES = [
  "Muppalla", "Singarabhotlapalem", "Vellaturu", "Boganampadu", "Nagireddy Palem",
  "Rajolupadu", "Reddypalem", "Chennipadu", "K. Agraharam", "Kotapadu",
  "Z. Mekapadu", "Choutapalem", "Malepadu", "Ponnaluru", "Cherukur",
  "Mundlamurivari Palem", "Sunkireddy Palem", "Thimmapalem", "Venkupalem",
  "Ravulakollu", "Uppaladinne", "Vempadu", "Ippagunta", "Pedavenkanna Palem"
];

export const TANGUTUR_NAMES = [
  "Alakurapadu", "Tangutur", "Korumugallu", "Karumanchi", "Singanikonda",
  "Ponnaluru Road", "Kandulur", "Nallurur", "Mallavarapu Padu", "Somavarappadu",
  "Surareddypalem", "Vaviletipadu", "Jallapalem", "Ananthavaram", "Kakutur",
  "Throvagunta", "Kondamuru", "Velagapudi"
];

export const ZARUGUMALLI_NAMES = [
  "Zarugumalli", "Kamepalli", "Chintalapalem", "Paletipadu", "Bitragunta",
  "Kommanur", "Naidupalem", "Pedacherlopalli", "Chinacherlopalli", "Narasingolu",
  "Gotlagattu", "Vallurivaripalem", "Pokuru", "Binginapallipadu", "Venkatadripuram",
  "Kalavalla", "Cherukurupadu", "Putchanuthala", "Vikkiralapeta", "Gadevaripalem"
];

export function getMandalVillages(mandalName: string): MandalVillage[] {
  const normMandal = mandalName.trim().toLowerCase();
  
  if (normMandal === 'singarayakonda') {
    return SINGARAYAKONDA_VILLAGES;
  }
  
  let names: string[] = [];
  let baseVoters = 3000;
  let tdpRatio = 0.52;
  let ysrcpRatio = 0.42;
  let neutralRatio = 0.06;
  
  if (normMandal === 'kondapi') {
    names = KONDAPI_NAMES;
    baseVoters = 3370;
    tdpRatio = 0.5228;
    ysrcpRatio = 0.4179;
    neutralRatio = 0.0593;
  } else if (normMandal === 'marripudi') {
    names = MARRIPUDI_NAMES;
    baseVoters = 2780;
    tdpRatio = 0.4807;
    ysrcpRatio = 0.4602;
    neutralRatio = 0.0591;
  } else if (normMandal === 'ponnaluru') {
    names = PONNALURU_NAMES;
    baseVoters = 2870;
    tdpRatio = 0.5283;
    ysrcpRatio = 0.4092;
    neutralRatio = 0.0625;
  } else if (normMandal === 'tangutur') {
    names = TANGUTUR_NAMES;
    baseVoters = 3460;
    tdpRatio = 0.5264;
    ysrcpRatio = 0.4109;
    neutralRatio = 0.0627;
  } else if (normMandal === 'zarugumalli') {
    names = ZARUGUMALLI_NAMES;
    baseVoters = 2960;
    tdpRatio = 0.4628;
    ysrcpRatio = 0.4881;
    neutralRatio = 0.0491;
  } else {
    names = KONDAPI_NAMES;
  }
  
  return names.map((name, i) => {
    const seed = name.length + i + normMandal.length;
    const modifier = (seed % 10) - 5; // -5% to +5% variation
    const vModifier = (seed % 20) - 10; // -10% to +10% variation
    
    const totalVoters = Math.round(baseVoters * (1 + vModifier / 100));
    const totalBooths = Math.max(1, Math.round(totalVoters / 850));
    const localVoters = Math.round(totalVoters * 0.88);
    const migratedVoters = totalVoters - localVoters;
    
    const vTdpRatio = tdpRatio + (modifier / 200);
    const vYsrcpRatio = ysrcpRatio - (modifier / 200);
    const vNeutralRatio = 1 - vTdpRatio - vYsrcpRatio;
    
    const tdp = Math.round(totalVoters * vTdpRatio);
    const ysrcp = Math.round(totalVoters * vYsrcpRatio);
    const neutral = totalVoters - tdp - ysrcp;
    
    const leadingParty = tdp > ysrcp ? 'TDP' : 'YSRCP';
    const lead = Math.abs(tdp - ysrcp);
    
    return {
      sNo: `#${String(i + 1).padStart(2, '0')}`,
      name,
      totalVoters,
      totalBooths,
      localVoters,
      migratedVoters,
      pStats: { TDP: tdp, YSRCP: ysrcp, JSP: 0, BJP: 0, INC: 0, Neutral: neutral, OTH: 0 },
      leadingParty,
      lead
    };
  });
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

export function findMandalForVillage(villageName: string): string {
  const vUpper = villageName.trim().toUpperCase();
  const mandals = ["Singarayakonda", "Kondapi", "Marripudi", "Ponnaluru", "Tangutur", "Zarugumalli"];
  for (const m of mandals) {
    const vList = getMandalVillages(m);
    if (vList.some(v => v.name.trim().toUpperCase() === vUpper)) {
      return m;
    }
  }
  return "Singarayakonda";
}

export function getVillageBoothOffset(villageName: string): number {
  let offset = 224;
  const mandalName = findMandalForVillage(villageName);
  const villages = getMandalVillages(mandalName);
  for (const v of villages) {
    if (v.name.toUpperCase().trim() === villageName.toUpperCase().trim()) {
      return offset;
    }
    offset += v.totalBooths;
  }
  return offset;
}

// Generate deterministic cadre / incharges for Mandal
export function getMandalCadreNetwork(mandalName: string = 'Singarayakonda'): {
  villageIncharges: { sNo: string; name: string; mobile: string; village: string; votersCount: number; leadingParty: VoterPreference; pStats: Record<VoterPreference, number>; lead: number }[];
  boothIncharges: MandalIncharge[];
  voter100Incharges: MandalIncharge[];
} {
  const villages = getMandalVillages(mandalName);
  const villageIncharges = villages.map((v, i) => {
    return {
      sNo: `#${String(i + 1).padStart(2, '0')}`,
      name: getVillageInchargeName(v.name),
      mobile: `91234${10000 + i}`,
      village: v.name,
      votersCount: v.totalVoters,
      leadingParty: v.leadingParty,
      pStats: v.pStats,
      lead: v.lead
    };
  });

  const boothIncharges: MandalIncharge[] = [];
  let bIdx = 1;
  villages.forEach((v) => {
    for (let b = 1; b <= v.totalBooths; b++) {
      const specVoters = Math.round(v.totalVoters / v.totalBooths);
      const tdpV = Math.round(v.pStats.TDP / v.totalBooths);
      const ysrcpV = Math.round(v.pStats.YSRCP / v.totalBooths);
      const jspV = Math.round(v.pStats.JSP / v.totalBooths);
      const bStats: Record<VoterPreference, number> = {
        TDP: tdpV,
        YSRCP: ysrcpV,
        JSP: jspV,
        BJP: Math.round(v.pStats.BJP / v.totalBooths),
        INC: Math.round(v.pStats.INC / v.totalBooths),
        Neutral: Math.round(v.pStats.Neutral / v.totalBooths),
        OTH: Math.round(v.pStats.OTH / v.totalBooths)
      };

      const officialBoothNum = 223 + bIdx;

      boothIncharges.push({
        sNo: `#${String(bIdx).padStart(3, '0')}`,
        name: getBoothInchargeName(v.name, b),
        mobile: `9440${10000 + bIdx}`,
        village: v.name,
        booth: `Booth ${officialBoothNum} (${getBoothLocationPreset(v.name, b)})`,
        votersCount: specVoters,
        leadingParty: tdpV > ysrcpV ? 'TDP' : 'YSRCP',
        lead: Math.abs(tdpV - ysrcpV),
        pStats: bStats
      });
      bIdx++;
    }
  });

  const voter100Incharges: MandalIncharge[] = [];
  let v100Idx = 1;
  villages.forEach((v) => {
    const teamsCount = Math.ceil(v.totalVoters / 1000); // 1 per 1000 voters for overview display
    const offset = getVillageBoothOffset(v.name);
    for (let t = 1; t <= teamsCount; t++) {
      const specVoters = 100;
      const bStats: Record<VoterPreference, number> = {
        TDP: Math.round(v.pStats.TDP / teamsCount / 10),
        YSRCP: Math.round(v.pStats.YSRCP / teamsCount / 10),
        JSP: Math.round(v.pStats.JSP / teamsCount / 10),
        BJP: Math.round(v.pStats.BJP / teamsCount / 10),
        INC: Math.round(v.pStats.INC / teamsCount / 10),
        Neutral: Math.round(v.pStats.Neutral / teamsCount / 10),
        OTH: Math.round(v.pStats.OTH / teamsCount / 10)
      };

      const localBoothIdx = Math.min(v.totalBooths, Math.ceil(t / 2));
      const officialBoothNum = offset + localBoothIdx - 1;

      voter100Incharges.push({
        sNo: `#${String(v100Idx).padStart(4, '0')}`,
        name: getVoterInchargeName(v.name, t),
        mobile: `9848${20000 + v100Idx}`,
        village: v.name,
        booth: `Booth ${officialBoothNum} (Team ${String(t).padStart(2, '0')})`,
        votersCount: specVoters,
        leadingParty: bStats.TDP > bStats.YSRCP ? 'TDP' : 'YSRCP',
        lead: Math.abs(bStats.TDP - bStats.YSRCP),
        pStats: bStats
      });
      v100Idx++;
    }
  });

  return {
    villageIncharges,
    boothIncharges,
    voter100Incharges
  };
}

// Deterministic names
function getVillageInchargeName(vName: string): string {
  const map: Record<string, string> = {
    "SINGARAYAKONDA": "Y. Srinivasa Reddy",
    "PATHA SINGARAYAKONDA": "C. Venkata Subbaiah",
    "MULAGUNTA PADU": "M. Koteswara Rao",
    "PAKALA": "P. Ramaniah",
    "SANAMPUDI": "G. Satyanarayana",
    "KANUMALA": "D. Chenchuramaiah",
    "BINGINI PALLI": "K. Adi Narayana",
    "BINGINAPALLI": "K. Adi Narayana",
    "KALIKIVAYA": "B. Lakshmamma",
    "SOMARAJU PALLI": "S. Yedukondalu",
    "WOOLLAPALEM": "T. Ramana Rao",
    // Compatibility aliases
    "SINGARAYA KONDA": "Y. Srinivasa Reddy",
    "KANUMALLA": "D. Chenchuramaiah",
    "MULAGUNTAPADU": "M. Koteswara Rao",
    "SOMARAJUPALLI": "S. Yedukondalu"
  };
  return map[vName.toUpperCase()] || map[vName] || "K. Rajesh";
}

function getBoothInchargeName(vName: string, bNum: number): string {
  const names = [
    "P. Venkatrao", "G. Lakshmamma", "S. Chenchaiah", "M. Krishnaiah",
    "Ch. Venkaiah", "T. Ramanamma", "B. Koteswara Rao", "Y. Satyanarayana",
    "D. Hari Babu", "R. Vasudeva Rao", "S. Yedukondalu", "V. Ramanaiah", "P. Srinivasa Rao"
  ];
  const idx = (vName.charCodeAt(0) + bNum) % names.length;
  return names[idx];
}

function getVoterInchargeName(vName: string, tNum: number): string {
  const names = [
    "K. Srinivasa Rao", "Ch. Rama Devi", "S. Anusha", "V. Koteswara Rao", 
    "D. Prasada Rao", "R. Siva Prasad", "K. Venkata Ramana", "G. Subba Rao", 
    "M. Lakshmi", "P. Raghavulu", "S. Chenchuramaiah", "T. Mastan Rao"
  ];
  const idx = (vName.charCodeAt(0) + tNum) % names.length;
  return names[idx];
}

function getBoothLocationPreset(vName: string, bNum: number): string {
  const locations = ["ZPHS South", "ZPHS North", "MPPS East", "MPPS West", "Community Hall", "Panchayat Office", "Govt Junior College", "Co-operative Bank"];
  return locations[(vName.charCodeAt(0) + bNum) % locations.length];
}

const mandalVoterMemoryCache = new Map<string, Voter[]>();

// Generate the 500-voter high-fidelity subset for any Singarayakonda village
export function generateVotersForMandalVillage(villageName: string): Voter[] {
  const cacheKey = `mandal_voters_${villageName.replace(/\s+/g, '_')}`;
  if (mandalVoterMemoryCache.has(cacheKey)) {
    return mandalVoterMemoryCache.get(cacheKey)!;
  }

  // Generate deterministic pool
  const resolvedMandal = findMandalForVillage(villageName);
  const villages = getMandalVillages(resolvedMandal);
  const villageSpec = villages.find(v => v.name === villageName) || villages[0];
  const poolSize = 500; // Optimized size for high performance & quota safety
  const voters: Voter[] = [];

  const firstNames = [
    "Srinivasa Rao", "Venkateswarlu", "Ramanaiah", "Subba Rao", "Lakshmi Prasanna",
    "Ramanamma", "Koteswara Rao", "Prasad", "Sivaiah", "Satyanarayana",
    "Anjali Devi", "Suresh Babu", "Rajesh", "Rama Devi", "Venkata Krishna",
    "Chenchaiah", "Krishnaiah", "Malyadri", "Saraswathi", "Gopalakrishna",
    "Adinarayana", "Bhavani", "Chandra Sekhar", "Durga Rao", "Hari Babu",
    "Jagadeesh", "Kalyani", "Nageswara Rao", "Padmavathi", "Ranga Rao",
    "Sambasiva Rao", "Triveni", "Vasudeva Rao", "Yedukondalu", "Sreenu"
  ];

  const lastNames = [
    "Gaddipati", "Marella", "Bollineni", "Chundi", "Yeluri",
    "Damarla", "Nelaturi", "Ravipudi", "Dara", "Mupparaju",
    "Nalamothu", "Kolla", "Myneni", "Kakumanu", "Gorantla",
    "Talluri", "Polavarapu", "Vasireddy", "Kondragunta", "Repalle"
  ];

  const casteDistribution = [
    { name: "Madiga", subCaste: "Adi Andhra" },
    { name: "Mala", subCaste: "Adi Dravida" },
    { name: "Kamma", subCaste: "Chowdary" },
    { name: "Chakali", subCaste: "Rajaka" },
    { name: "Yanadi", subCaste: "None" },
    { name: "Yerukula", subCaste: "None" },
    { name: "Yadava", subCaste: "Golla" },
    { name: "Reddy", subCaste: "Reddy" },
    { name: "Muslim", subCaste: "Shaik" },
    { name: "Dommara", subCaste: "None" },
    { name: "Mangali", subCaste: "Nayee" },
    { name: "Banda", subCaste: "None" },
    { name: "Kamsali", subCaste: "Achari" },
    { name: "Vysya", subCaste: "Setty" },
    { name: "Brahmin", subCaste: "Sastri" },
    { name: "Dudekula", subCaste: "Pinjari" }
  ];

  const professions = [
    "Farmer", "Private Job", "Government Employee", "Business", 
    "Daily Wage", "Homemaker", "Student", "Others"
  ];

  let seed = 0;
  for (let i = 0; i < villageName.length; i++) seed += villageName.charCodeAt(i);

  const random = () => {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  };

  const getPreference = (idx: number): VoterPreference => {
    // Distribute according to village stats
    const r = random();
    const stats = villageSpec.pStats;
    const total = Object.values(stats).reduce((a, b) => a + b, 0);
    
    let running = 0;
    for (const [p, val] of Object.entries(stats)) {
      running += val / total;
      if (r <= running) return p as VoterPreference;
    }
    return 'Neutral';
  };

  for (let i = 1; i <= poolSize; i++) {
    const gender = random() > 0.51 ? 'Male' : 'Female';
    const first = firstNames[Math.floor(random() * firstNames.length)];
    const last = lastNames[Math.floor(random() * lastNames.length)];
    const voterName = `${last} ${first}`;
    
    const isMarriedFemale = gender === 'Female' && random() > 0.4;
    const relationType = isMarriedFemale ? 'Husband' : 'Father';
    const relFirst = firstNames[Math.floor(random() * firstNames.length)];
    const relLast = last;
    const fatherHusbandName = `${relLast} ${relFirst}`;

    const offset = getVillageBoothOffset(villageSpec.name);
    const bNumLocal = Math.floor(random() * villageSpec.totalBooths) + 1;
    const bNum = offset + bNumLocal - 1;
    const epicNum = `KDP${8000000 + Math.floor(random() * 1999999)}`;
    const age = Math.floor(random() * 62) + 18;
    const hNoNum = Math.floor(random() * 250) + 1;
    const hNoSec = Math.floor(random() * 12) + 1;
    const houseNumber = `${hNoSec}-${hNoNum}`;

    // Optionally assign mobile (about 70% have mobile, the rest don't)
    const hasMobile = random() > 0.3;
    const mobileNumber = hasMobile ? "9" + Math.floor(100000000 + random() * 900000000) : "";

    const pref = getPreference(i);
    const localStatus = random() > 0.12 ? 'Local' : 'Migrated';
    const vStatus = random() > 0.95 ? 'Fake' : (random() > 0.97 ? 'Duplicate' : (random() > 0.98 ? 'Shifted' : 'Active'));

    const casteObj = casteDistribution[Math.floor(random() * casteDistribution.length)];
    const caste = casteObj.name;
    const subCaste = casteObj.subCaste;
    const profession = professions[Math.floor(random() * professions.length)];

    voters.push({
      id: `VOTER-MND-${villageSpec.name.substring(0,3)}-${1000 + i}`,
      serialNumber: i,
      epicNumber: epicNum,
      name: voterName,
      fatherHusbandName,
      relationType,
      houseNumber,
      age,
      gender,
      mobileNumber,
      assemblyConstituency: "Kondapi",
      mandal: resolvedMandal,
      village: villageSpec.name,
      boothNumber: `Booth ${bNum} (${getBoothLocationPreset(villageSpec.name, bNumLocal)})`,
      assignedVoterGroup: `Team ${String(Math.ceil(bNumLocal / 2)).padStart(2, '0')}`,
      assignedInchargeId: `100-INC-${4592 + (i % 13)}`,
      politicalPreference: pref,
      voterStatus: vStatus,
      surveyStatus: 'Verified',
      notes: pref === 'TDP' ? 'Assured support for Cycle mark' : 'Under assessment',
      lastUpdated: '2026-07-28',
      updatedBy: 'Voter Incharge',
      voterLocationStatus: localStatus as any,
      voteStatus: random() > 0.4 ? 'VOTE DONE' : 'NOT VOTED',
      voteDoneTime: '2026-07-29 09:30 AM',
      inchargeAssessment: pref,
      caste,
      subCaste,
      profession
    });
  }

  mandalVoterMemoryCache.set(cacheKey, voters);
  return voters;
}

export function saveMandalVoterRecord(villageName: string, updatedVoter: Voter) {
  const cacheKey = `mandal_voters_${villageName.replace(/\s+/g, '_')}`;
  if (mandalVoterMemoryCache.has(cacheKey)) {
    const voters = mandalVoterMemoryCache.get(cacheKey)!;
    const updated = voters.map(v => v.id === updatedVoter.id ? updatedVoter : v);
    mandalVoterMemoryCache.set(cacheKey, updated);
  }

  // Sync directly with backend PostgreSQL database
  import('../lib/api').then(({ syncVoter }) => {
    syncVoter(updatedVoter).catch(() => {});
  });
}
