import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  Database,
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  BarChart2,
  RefreshCw,
  FolderTree,
  X,
  Sliders,
  ChevronDown,
  ChevronUp,
  Eye,
  Users,
  Download,
  ShieldCheck,
  Key,
  Phone,
  FileUp,
  Search,
  Check,
  Layers,
  ShieldAlert,
  FileText,
} from 'lucide-react';
import { AppInstance, ApplicationSummary } from '../types';
import {
  fetchApplicationSummary,
  fetchVotersList,
  importVoterRolls,
  uploadVoterCsvStream,
  fetchImportJobStatus,
  fetchInchargeRosterPreview,
  provisionInchargesApi,
  downloadInchargeRosterCsv,
  fetchInchargeRosterSlots,
  downloadInchargeRosterTemplate,
  uploadInchargeRosterSpreadsheet,
  submitManualInchargeRoster,
  CadreRosterSlotsResponse,
  CadreSlotItem,
  ManualRosterEntry,
} from '../lib/api';

interface DataIngestionProps {
  currentApp: AppInstance | null;
  apps?: AppInstance[];
  onSelectApp?: (app: AppInstance) => void;
}

const MAX_EXCEL_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25MB
const MAX_CSV_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100MB
const ALLOWED_EXTENSIONS = ['.xlsx', '.xls', '.csv'];

// ── Target System Field Definitions ──
export interface TargetSystemField {
  key: string;
  label: string;
  required: boolean;
  description: string;
  aliases: string[];
}

export const TARGET_SYSTEM_FIELDS: TargetSystemField[] = [
  {
    key: 'serialNumber',
    label: 'Serial Number / Sl. No',
    required: false,
    description: 'Electoral roll voter serial number',
    aliases: ['serialno', 'serialnumber', 'slno', 'newserialno', 'oldserialno', 'voterserialno', 'srno', 'sno', 'serial'],
  },
  {
    key: 'epicNumber',
    label: 'Voter ID / EPIC',
    required: true,
    description: 'Unique voter card number (e.g. AP01234567)',
    aliases: ['epicno', 'epicnumber', 'epic', 'voterid', 'voteridno', 'voteridnumber', 'voteridcard', 'cardno', 'slno', 'idno', 'id', 'electorsno', 'epicid', 'epicidno'],
  },
  {
    key: 'fullName',
    label: 'Voter Full Name',
    required: true,
    description: 'Citizen legal full name',
    aliases: ['fullname', 'votername', 'electorname', 'citizenname', 'name', 'candidatename', 'personname', 'applicantname', 'voterfullname'],
  },
  {
    key: 'relativeName',
    label: 'Father / Husband Name',
    required: false,
    description: 'Father, husband, or guardian name',
    aliases: ['relativename', 'fatherhusbandname', 'fathername', 'husbandname', 'guardianname', 'relationname', 'parentname', 'careof', 'fatherorhusbandname', 'fname', 'hname'],
  },
  {
    key: 'relationType',
    label: 'Relation Type',
    required: false,
    description: 'FATHER, HUSBAND, MOTHER, or OTHER',
    aliases: ['relationtype', 'relationship', 'relation', 'reltype'],
  },
  {
    key: 'age',
    label: 'Age',
    required: true,
    description: 'Voter legal age (must be >= 18)',
    aliases: ['age', 'voterage', 'citizenage', 'ageinyears', 'years'],
  },
  {
    key: 'gender',
    label: 'Gender',
    required: true,
    description: 'MALE, FEMALE, or OTHER',
    aliases: ['gender', 'sex', 'gendertype'],
  },
  {
    key: 'voterStatus',
    label: 'Voter Status (Active/Deleted)',
    required: false,
    description: 'ACTIVE, DELETED, SHIFTED, or EXPIRED',
    aliases: ['voterstatus', 'status', 'activedelete', 'activedeleted', 'recordstatus', 'deletionstatus'],
  },
  {
    key: 'houseNumber',
    label: 'House / Door No',
    required: false,
    description: 'Residential address / door number',
    aliases: ['housenumber', 'houseno', 'doorno', 'doornumber', 'dno', 'hno', 'address', 'residentialaddress', 'flatno', 'buildingno'],
  },
  {
    key: 'constituency',
    label: 'Constituency',
    required: false,
    description: 'Assembly Constituency name or code',
    aliases: ['constituency', 'constituencyname', 'assemblyconstituency', 'ac', 'acname', 'acno', 'constituencycode'],
  },
  {
    key: 'mandal',
    label: 'Mandal',
    required: true,
    description: 'Sub-district / administrative Mandal name',
    aliases: ['mandal', 'mandalname', 'tehsil', 'taluka', 'block', 'mandalblock'],
  },
  {
    key: 'village',
    label: 'Village / Ward',
    required: true,
    description: 'Revenue Village, Panchayat, or Urban Ward',
    aliases: ['village', 'villagename', 'panchayat', 'ward', 'town', 'habitation', 'locality', 'grampanchayat', 'villageward'],
  },
  {
    key: 'pollingStation',
    label: 'Polling Station Name',
    required: false,
    description: 'Polling station building or premises name',
    aliases: ['pollingstation', 'pollingstationname', 'psname', 'stationname', 'buildingname'],
  },
  {
    key: 'boothNumber',
    label: 'Booth Number',
    required: true,
    description: 'Assigned polling booth or part number',
    aliases: ['boothnumber', 'boothno', 'booth', 'pollingstationno', 'pollingstationnumber', 'psno', 'psnumber', 'partno', 'partnumber', 'stationno', 'boothcode'],
  },
  {
    key: 'voterGroup',
    label: '100-Voter Group',
    required: false,
    description: 'Cluster / micro-incharge group name or number',
    aliases: ['votergroup', '100votergroup', 'cluster', 'group', 'votergroupno', 'votercluster', 'unit'],
  },
  {
    key: 'mobileNumber',
    label: 'Mobile Number',
    required: false,
    description: '10-digit citizen contact number',
    aliases: ['mobilenumber', 'mobile', 'mobileno', 'phone', 'phonenumber', 'contact', 'contactno', 'cell', 'cellno', 'whatsapp'],
  },
  {
    key: 'caste',
    label: 'Caste / Category',
    required: false,
    description: 'Demographic caste or social group',
    aliases: ['caste', 'community', 'socialcategory', 'category', 'subcaste'],
  },
  {
    key: 'profession',
    label: 'Profession',
    required: false,
    description: 'Primary occupation / livelihood',
    aliases: ['profession', 'occupation', 'employment', 'job'],
  },
  {
    key: 'politicalPreference',
    label: 'Political Preference',
    required: false,
    description: 'Party leaning or neutral inclination',
    aliases: ['politicalpreference', 'preference', 'partypreference', 'leaning', 'affiliation', 'party'],
  },
];

// Helper to normalize strings for robust fuzzy key matching
function normalizeKey(str: string): string {
  return String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Check if a cell value strongly resembles voter data rather than a column header
function isVoterDataCell(val: any): { isEpic: boolean; isAge: boolean; isGender: boolean } {
  const str = String(val ?? '').trim();
  const isEpic = /^[a-zA-Z]{2,4}\d{6,8}$/i.test(str) || (str.length >= 8 && /\d{6,}/.test(str));
  const num = parseInt(str, 10);
  const isAge = !isNaN(num) && num >= 18 && num <= 110;
  const lower = str.toLowerCase();
  const isGender = ['m', 'f', 'male', 'female', 'o', 'other'].includes(lower);
  return { isEpic, isAge, isGender };
}

interface SheetAnalysisResult {
  headers: string[];
  dataRows: any[][];
  hasDetectedHeaders: boolean;
  detectedHeaderIndex: number;
  initialMapping: Record<string, string>;
  warningNote?: string;
}

// Analyze raw spreadsheet matrix to distinguish header rows from voter data
function analyzeSheetGrid(rawGrid: any[][]): SheetAnalysisResult {
  const nonEmptyRows = rawGrid.filter(
    (row) => Array.isArray(row) && row.some((cell) => cell !== undefined && cell !== null && String(cell).trim() !== '')
  );

  if (nonEmptyRows.length === 0) {
    return {
      headers: [],
      dataRows: [],
      hasDetectedHeaders: false,
      detectedHeaderIndex: -1,
      initialMapping: {},
      warningNote: 'The uploaded spreadsheet is empty.',
    };
  }

  // Inspect first 3 candidate rows
  let headerIndex = -1;
  const maxCandidateRows = Math.min(3, nonEmptyRows.length);

  for (let r = 0; r < maxCandidateRows; r++) {
    const candidateRow = nonEmptyRows[r];
    let matchedAliasesCount = 0;
    let voterDataSignalCount = 0;

    for (const cell of candidateRow) {
      const norm = normalizeKey(String(cell ?? ''));
      if (!norm) continue;

      // Check if matches known aliases
      const matchedField = TARGET_SYSTEM_FIELDS.find((f) => f.aliases.includes(norm) || normalizeKey(f.label) === norm);
      if (matchedField) {
        matchedAliasesCount++;
      }

      // Check if resembles voter data
      const { isEpic, isAge, isGender } = isVoterDataCell(cell);
      if (isEpic || isAge || isGender) {
        voterDataSignalCount++;
      }
    }

    // If row has strong voter data signals, it is definitely voter data, NOT headers
    if (voterDataSignalCount >= 2) {
      break;
    }

    // If row matches at least 2 system field headers and has minimal data signals
    if (matchedAliasesCount >= 2 && voterDataSignalCount === 0) {
      headerIndex = r;
      break;
    }
  }

  let headers: string[] = [];
  let dataRows: any[][] = [];
  let hasDetectedHeaders = false;
  let warningNote: string | undefined = undefined;

  const colCount = nonEmptyRows.slice(0, 50).reduce((max, r) => Math.max(max, r.length), 1);

  if (headerIndex >= 0) {
    hasDetectedHeaders = true;
    const rawHeaderRow = nonEmptyRows[headerIndex];
    headers = Array.from({ length: colCount }, (_, idx) => {
      const val = rawHeaderRow[idx];
      const strVal = String(val ?? '').trim();
      return strVal || `Column ${String.fromCharCode(65 + (idx % 26))}${idx >= 26 ? Math.floor(idx / 26) : ''}`;
    });
    dataRows = nonEmptyRows.slice(headerIndex + 1);
  } else {
    // No headers detected: row 0 is preserved as Voter 1!
    hasDetectedHeaders = false;
    headers = Array.from({ length: colCount }, (_, idx) => {
      return `Column ${String.fromCharCode(65 + (idx % 26))}${idx >= 26 ? Math.floor(idx / 26) : ''}`;
    });
    dataRows = nonEmptyRows;
    warningNote = 'No header row detected in the spreadsheet. The first row appears to be voter data and has been preserved as Voter #1. Please map each column to its corresponding voter field below.';
  }

  // Derive initial mapping using normalized aliases
  const initialMapping: Record<string, string> = {};
  const mappedKeys = new Set<string>();

  headers.forEach((hdr) => {
    const norm = normalizeKey(hdr);
    // Generic column names like "Column A" or "A" or "__EMPTY" are left unmapped
    if (/^col(umn)?[a-z0-9]*$/i.test(norm) || /^[a-z]$/i.test(norm) || norm.startsWith('empty')) {
      initialMapping[hdr] = '';
      return;
    }

    const matchedField = TARGET_SYSTEM_FIELDS.find(
      (f) => !mappedKeys.has(f.key) && (f.aliases.includes(norm) || normalizeKey(f.label) === norm)
    );
    if (matchedField) {
      initialMapping[hdr] = matchedField.key;
      mappedKeys.add(matchedField.key);
    } else {
      initialMapping[hdr] = '';
    }
  });

  return {
    headers,
    dataRows,
    hasDetectedHeaders,
    detectedHeaderIndex: headerIndex,
    initialMapping,
    warningNote,
  };
}

export default function DataIngestion({ currentApp, apps, onSelectApp }: DataIngestionProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'parsing' | 'uploading' | 'processing' | 'success' | 'partial' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [uploadPercentage, setUploadPercentage] = useState<number>(0);
  const [processingStats, setProcessingStats] = useState<{
    valid: number;
    imported: number;
    updated: number;
    failed: number;
    total: number;
  } | null>(null);
  const [uploadErrors, setUploadErrors] = useState<Array<{ rowNumber?: number; field?: string; errorMessage: string; value?: string }>>([]);
  const [showErrorDetails, setShowErrorDetails] = useState(false);

  // Real DB states
  const [summary, setSummary] = useState<ApplicationSummary | null>(null);
  const [voters, setVoters] = useState<any[]>([]);
  const [totalVotersCount, setTotalVotersCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  // Incharge Roster States & Real Number Cadre Allocation
  const [rosterSummary, setRosterSummary] = useState<any>(null);
  const [rosterSlotsData, setRosterSlotsData] = useState<CadreRosterSlotsResponse | null>(null);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [provisionMessage, setProvisionMessage] = useState<string | null>(null);

  // Cadre Allocation UI Mode ('spreadsheet' | 'manual')
  const [allocationMode, setAllocationMode] = useState<'spreadsheet' | 'manual'>('spreadsheet');
  const [activeCadreTab, setActiveCadreTab] = useState<'mandals' | 'pollingStations' | 'booths' | 'groups'>('mandals');
  const [cadreSearchQuery, setCadreSearchQuery] = useState('');
  const [onlyUnassignedFilter, setOnlyUnassignedFilter] = useState(false);

  // Manual Section-wise Number Inputs: keyed by slotCode -> { inchargeName, mobileNumber }
  const [manualInputs, setManualInputs] = useState<Record<string, { inchargeName: string; mobileNumber: string }>>({});
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);
  const [manualSubmitMessage, setManualSubmitMessage] = useState<string | null>(null);
  const [manualSubmitError, setManualSubmitError] = useState<string | null>(null);

  // Bulk Spreadsheet Upload states
  const [rosterSpreadsheetFile, setRosterSpreadsheetFile] = useState<File | null>(null);
  const [isUploadingRoster, setIsUploadingRoster] = useState(false);
  const [rosterUploadSuccess, setRosterUploadSuccess] = useState<string | null>(null);
  const [rosterUploadError, setRosterUploadError] = useState<string | null>(null);
  const [rosterPasscode, setRosterPasscode] = useState('123456');

  // Column Mapping & Pre-Commit Preview Modal States
  const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);
  const [sheetHeaders, setSheetHeaders] = useState<string[]>([]);
  const [sheetDataRows, setSheetDataRows] = useState<any[][]>([]);
  const [sheetRowObjects, setSheetRowObjects] = useState<Record<string, any>[]>([]);
  const [hasDetectedHeaders, setHasDetectedHeaders] = useState(true);
  const [mappingWarning, setMappingWarning] = useState<string | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [isCommitting, setIsCommitting] = useState(false);

  const loadLiveData = async () => {
    if (!currentApp) return;
    setLoading(true);
    try {
      const [sum, vList] = await Promise.all([
        fetchApplicationSummary(currentApp.id),
        fetchVotersList({ appId: currentApp.id, limit: 15 }),
      ]);
      setSummary(sum);
      setVoters(vList.items);
      setTotalVotersCount(sum?.totalVoters ?? vList.total);

      if (sum?.constituencyId) {
        setIsLoadingSlots(true);
        try {
          const [rPrev, slots] = await Promise.all([
            fetchInchargeRosterPreview(sum.constituencyId).catch(() => null),
            fetchInchargeRosterSlots(sum.constituencyId).catch(() => null),
          ]);
          setRosterSummary(rPrev?.summary || null);
          if (slots) {
            setRosterSlotsData(slots);
          }
        } catch {
          setRosterSummary(null);
        } finally {
          setIsLoadingSlots(false);
        }
      } else {
        setRosterSummary(null);
        setRosterSlotsData(null);
      }
    } catch (err) {
      console.warn('Failed to load live ingestion summary from DB:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadTemplate = async (format: 'xlsx' | 'csv' = 'xlsx') => {
    if (!summary?.constituencyId) {
      alert('Please ingest voter rolls first before downloading the roster template.');
      return;
    }
    try {
      await downloadInchargeRosterTemplate(summary.constituencyId, format);
    } catch (err: any) {
      alert(err?.message || 'Failed to download roster template');
    }
  };

  const handleUploadRosterFile = async () => {
    if (!summary?.constituencyId || !rosterSpreadsheetFile) {
      alert('Please select a filled roster spreadsheet (.xlsx or .csv) to upload.');
      return;
    }
    setIsUploadingRoster(true);
    setRosterUploadSuccess(null);
    setRosterUploadError(null);
    try {
      const res = await uploadInchargeRosterSpreadsheet(
        summary.constituencyId,
        rosterSpreadsheetFile,
        currentApp?.partyCode || currentApp?.name,
        rosterPasscode
      );
      const s = res?.summary;
      setRosterUploadSuccess(
        `Registered ${s?.totalUsersProvisioned || 0} authentic incharge logins into database! ` +
        `(${s?.mandalsProvisioned || 0} Mandals, ${s?.villagesProvisioned || 0} Polling Stations, ` +
        `${s?.boothsProvisioned || 0} Booths, ${s?.groupsProvisioned || 0} 100-Voter Groups)`
      );
      setRosterSpreadsheetFile(null);
      await loadLiveData();
    } catch (err: any) {
      setRosterUploadError(err?.message || 'Failed to upload and register roster spreadsheet');
    } finally {
      setIsUploadingRoster(false);
    }
  };

  const handleManualInputChange = (slotCode: string, field: 'inchargeName' | 'mobileNumber', value: string) => {
    setManualInputs((prev) => ({
      ...prev,
      [slotCode]: {
        inchargeName: field === 'inchargeName' ? value : (prev[slotCode]?.inchargeName || ''),
        mobileNumber: field === 'mobileNumber' ? value : (prev[slotCode]?.mobileNumber || ''),
      },
    }));
  };

  const handleSubmitManualSection = async () => {
    if (!summary?.constituencyId) {
      alert('No constituency found.');
      return;
    }
    const currentSectionSlots = rosterSlotsData?.sections[activeCadreTab] || [];
    const entriesToSubmit: ManualRosterEntry[] = [];
    const validationErrors: string[] = [];

    for (const slot of currentSectionSlots) {
      const input = manualInputs[slot.slotCode];
      if (input && input.mobileNumber.trim()) {
        const cleanPhone = input.mobileNumber.replace(/\D/g, '').slice(-10);
        if (cleanPhone.length !== 10) {
          validationErrors.push(`${slot.slotCode}: Mobile number must be 10 digits.`);
        } else if (/^910[1-4]\d{6}$/.test(cleanPhone)) {
          validationErrors.push(`${slot.slotCode}: Mock/synthetic dummy numbers (9101-9104) are strictly prohibited.`);
        } else if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
          validationErrors.push(`${slot.slotCode}: Mobile number must start with 6, 7, 8, or 9.`);
        } else {
          entriesToSubmit.push({
            slotCode: slot.slotCode,
            inchargeName: input.inchargeName.trim() || undefined,
            mobileNumber: cleanPhone,
          });
        }
      }
    }

    if (validationErrors.length > 0) {
      setManualSubmitError(validationErrors.slice(0, 3).join(' | '));
      return;
    }

    if (entriesToSubmit.length === 0) {
      alert('Please enter at least one real 10-digit mobile number before submitting.');
      return;
    }

    setIsSubmittingManual(true);
    setManualSubmitMessage(null);
    setManualSubmitError(null);

    try {
      await submitManualInchargeRoster(
        summary.constituencyId,
        entriesToSubmit,
        currentApp?.partyCode || currentApp?.name,
        rosterPasscode
      );
      setManualSubmitMessage(
        `Successfully registered ${entriesToSubmit.length} real mobile numbers for ${activeCadreTab} into PostgreSQL database!`
      );
      setManualInputs((prev) => {
        const next = { ...prev };
        for (const e of entriesToSubmit) {
          delete next[e.slotCode];
        }
        return next;
      });
      await loadLiveData();
    } catch (err: any) {
      setManualSubmitError(err?.message || 'Failed to submit manual roster numbers');
    } finally {
      setIsSubmittingManual(false);
    }
  };

  const handleDownloadRoster = async () => {
    if (!summary?.constituencyId) {
      alert('No constituency found to download roster for.');
      return;
    }
    try {
      await downloadInchargeRosterCsv(summary.constituencyId);
    } catch (err: any) {
      alert(err?.message || 'Failed to download roster CSV');
    }
  };

  useEffect(() => {
    loadLiveData();
  }, [currentApp?.id]);

  // Compute Instant Pre-Commit Validation & Preview
  const preCommitValidation = useMemo(() => {
    if (!sheetRowObjects || sheetRowObjects.length === 0) {
      return { total: 0, valid: 0, invalid: 0, sampleErrors: [], previewRows: [], isEpicMapped: false, isNameMapped: false };
    }

    const epicHeader = Object.keys(columnMapping).find((h) => columnMapping[h] === 'epicNumber');
    const nameHeader = Object.keys(columnMapping).find((h) => columnMapping[h] === 'fullName');
    const ageHeader = Object.keys(columnMapping).find((h) => columnMapping[h] === 'age');
    const genderHeader = Object.keys(columnMapping).find((h) => columnMapping[h] === 'gender');
    const boothHeader = Object.keys(columnMapping).find((h) => columnMapping[h] === 'boothNumber');
    const mandalHeader = Object.keys(columnMapping).find((h) => columnMapping[h] === 'mandal');
    const villageHeader = Object.keys(columnMapping).find((h) => columnMapping[h] === 'village');

    const sampleErrors: Array<{ rowNumber: number; message: string }> = [];
    const seenEpics = new Set<string>();
    let validCount = 0;
    let invalidCount = 0;

    const mappedPreviewRows: any[] = [];

    sheetRowObjects.forEach((row, idx) => {
      const rowNum = idx + 1;
      const reasons: string[] = [];

      const rawEpic = epicHeader ? String(row[epicHeader] ?? '').trim() : '';
      const rawName = nameHeader ? String(row[nameHeader] ?? '').trim() : '';
      const rawAgeStr = ageHeader ? String(row[ageHeader] ?? '').trim() : '';
      const rawAge = parseInt(rawAgeStr, 10);
      const rawGender = genderHeader ? String(row[genderHeader] ?? '').trim() : '';

      if (!epicHeader) {
        reasons.push('Voter ID / EPIC column is not mapped');
      } else if (!rawEpic) {
        reasons.push('Missing EPIC / Voter ID');
      } else if (seenEpics.has(rawEpic.toUpperCase())) {
        reasons.push(`Duplicate EPIC '${rawEpic}' in file`);
      } else {
        seenEpics.add(rawEpic.toUpperCase());
      }

      if (!nameHeader) {
        reasons.push('Voter Full Name column is not mapped');
      } else if (!rawName) {
        reasons.push('Missing Voter Full Name');
      }

      if (ageHeader && rawAgeStr && (isNaN(rawAge) || rawAge < 18 || rawAge > 120)) {
        reasons.push(`Invalid age '${rawAgeStr}' (must be 18–120)`);
      }

      if (reasons.length > 0) {
        invalidCount++;
        if (sampleErrors.length < 5) {
          sampleErrors.push({ rowNumber: rowNum, message: reasons.join('; ') });
        }
      } else {
        validCount++;
      }

      if (idx < 5) {
        mappedPreviewRows.push({
          rowNum,
          epic: rawEpic || '—',
          name: rawName || '—',
          age: rawAgeStr || '—',
          gender: rawGender || '—',
          booth: boothHeader ? String(row[boothHeader] ?? '—') : '—',
          mandal: mandalHeader ? String(row[mandalHeader] ?? '—') : '—',
          village: villageHeader ? String(row[villageHeader] ?? '—') : '—',
          isValid: reasons.length === 0,
        });
      }
    });

    return {
      total: sheetRowObjects.length,
      valid: validCount,
      invalid: invalidCount,
      sampleErrors,
      previewRows: mappedPreviewRows,
      isEpicMapped: Boolean(epicHeader),
      isNameMapped: Boolean(nameHeader),
    };
  }, [sheetRowObjects, columnMapping]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentApp) return;

    // Reset input value so re-selecting same file triggers onChange
    e.target.value = '';

    // 1. Check file extension
    const lowerName = file.name.toLowerCase();
    const isAllowedExt = ALLOWED_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
    if (!isAllowedExt) {
      setUploadStatus('error');
      setStatusMessage('Invalid file format. Only spreadsheet files (.xlsx, .xls, .csv) are supported.');
      setUploadErrors([]);
      return;
    }

    // 2. Check file size limit
    const isCsv = lowerName.endsWith('.csv');
    const maxBytes = isCsv ? MAX_CSV_FILE_SIZE_BYTES : MAX_EXCEL_FILE_SIZE_BYTES;
    const maxMb = isCsv ? 100 : 25;
    if (file.size > maxBytes) {
      setUploadStatus('error');
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      setStatusMessage(`File size (${sizeMb} MB) exceeds maximum permitted upload limit of ${maxMb} MB.`);
      setUploadErrors([]);
      return;
    }

    setSelectedFile(file);
    setUploadStatus('parsing');
    setStatusMessage(isCsv ? 'Reading CSV sample headers...' : 'Reading spreadsheet and analyzing column headers...');
    setUploadErrors([]);

    try {
      let rawGrid: any[][];

      if (isCsv) {
        // Sample first 64KB to extract headers and preview rows without freezing browser on large files
        const slice = file.slice(0, 65536);
        const text = await slice.text();
        const workbook = XLSX.read(text, { type: 'string' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        rawGrid = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          blankrows: false,
          defval: '',
        });
        // Discard possibly truncated last line from the slice
        if (rawGrid.length > 2 && file.size > 65536) {
          rawGrid.pop();
        }
      } else {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array', sheetRows: 50 });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // Read raw 2D array grid without pre-assuming row 0 is header
        rawGrid = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          blankrows: false,
          defval: '',
        });
      }

      const analysis = analyzeSheetGrid(rawGrid);

      if (analysis.dataRows.length === 0) {
        setUploadStatus('error');
        setStatusMessage(analysis.warningNote || 'No valid data rows found in selected file.');
        return;
      }

      // Build row objects based on detected headers
      const rowObjects = analysis.dataRows.map((row) => {
        const obj: Record<string, any> = {};
        analysis.headers.forEach((h, i) => {
          obj[h] = row[i] !== undefined && row[i] !== null ? String(row[i]).trim() : '';
        });
        return obj;
      });

      setSheetHeaders(analysis.headers);
      setSheetDataRows(analysis.dataRows);
      setSheetRowObjects(rowObjects);
      setHasDetectedHeaders(analysis.hasDetectedHeaders);
      setMappingWarning(analysis.warningNote || null);
      setColumnMapping(analysis.initialMapping);

      setUploadStatus('idle');
      setStatusMessage('');
      setIsMappingModalOpen(true);
    } catch (err: any) {
      setUploadStatus('error');
      setStatusMessage(err?.message || 'Failed to read spreadsheet file. Please check that the file is not corrupted.');
      setUploadErrors([]);
    }
  };

  const handleMappingChange = (header: string, targetKey: string) => {
    setColumnMapping((prev) => {
      const updated = { ...prev };
      // If another column was mapped to this targetKey (for single-value keys), unmap it to prevent conflicts
      if (targetKey) {
        Object.keys(updated).forEach((h) => {
          if (h !== header && updated[h] === targetKey) {
            updated[h] = '';
          }
        });
      }
      updated[header] = targetKey;
      return updated;
    });
  };

  const handleCommitImport = async () => {
    if (!currentApp || !selectedFile || sheetRowObjects.length === 0) return;
    if (!preCommitValidation.isEpicMapped || !preCommitValidation.isNameMapped) {
      alert('Mandatory identity fields (Voter ID / EPIC and Voter Full Name) must be mapped before importing.');
      return;
    }
    if (preCommitValidation.valid === 0) {
      alert('Cannot commit: 0 valid records found in preview. Please check your column mappings.');
      return;
    }

    // ── Unified Streaming Import via Background Worker (handles .csv, .xlsx, .xls) ──
    setIsMappingModalOpen(false);
    setIsCommitting(true);
    setUploadStatus('uploading');
    setUploadPercentage(0);
    setStatusMessage('Streaming file upload to server (multipart/form-data)...');
    setUploadErrors([]);
    setProcessingStats(null);

    try {
      const uploadRes = await uploadVoterCsvStream(
        currentApp.id,
        selectedFile,
        {
          targetConstituencyId: summary?.constituencyId,
          importMode: 'APPEND',
          columnMapping,
        },
        (pct) => {
          setUploadPercentage(pct);
          if (pct < 100) {
            setStatusMessage(`Uploading file... ${pct}%`);
          } else {
            setStatusMessage('Upload complete (100%). Finalizing file and creating job record...');
          }
        }
      );

      const jobId = uploadRes?.jobId || uploadRes?.id;
      if (!jobId) {
        throw new Error('Server did not return a valid job identifier.');
      }

      setUploadStatus('processing');
      setStatusMessage('File received by server. Queued in PostgreSQL-backed worker...');

      // Poll job status until COMPLETED, PARTIAL_SUCCESS, or FAILED
      let pollCount = 0;
      const pollTimer = setInterval(async () => {
        try {
          pollCount++;
          const job = await fetchImportJobStatus(currentApp.id, jobId);
          const status = job?.status;
          const total = Number(job?.totalRecords || 0);
          const imported = Number(job?.importedRecords ?? job?.importedCount ?? 0);
          const updated = Number(job?.updatedRecords ?? job?.updatedCount ?? 0);
          const failed = Number(job?.failedRecords ?? job?.failedCount ?? job?.errorCount ?? 0);
          const processed = Number(job?.validRecords ?? job?.processedRecords ?? (imported + updated));

          setProcessingStats({
            valid: imported + updated,
            imported,
            updated,
            failed,
            total,
          });

          if (status === 'PROCESSING') {
            const pct = total > 0 ? Math.round((processed / total) * 100) : 0;
            setStatusMessage(
              `Processing voter records: ${processed.toLocaleString('en-IN')} / ${total.toLocaleString('en-IN')} (${pct}%) — batch size: 500 rows...`
            );
          } else if (status === 'COMPLETED' || status === 'SUCCESS') {
            clearInterval(pollTimer);
            setUploadStatus('success');
            const totalCommitted = imported + updated;
            setStatusMessage(
              `Import completed successfully: ${totalCommitted.toLocaleString('en-IN')} voter records committed into PostgreSQL database.`
            );
            setIsCommitting(false);
            await loadLiveData();
          } else if (status === 'PARTIAL_SUCCESS') {
            clearInterval(pollTimer);
            setUploadStatus('partial');
            const totalCommitted = imported + updated;
            setStatusMessage(
              `Partial import completed: ${totalCommitted.toLocaleString('en-IN')} records committed successfully, ${failed.toLocaleString('en-IN')} record${failed === 1 ? '' : 's'} skipped (failed validation).`
            );
            if (Array.isArray(job.errors)) {
              setUploadErrors(job.errors);
              setShowErrorDetails(true);
            }
            setIsCommitting(false);
            await loadLiveData();
          } else if (status === 'FAILED') {
            clearInterval(pollTimer);
            setUploadStatus('error');
            const reason = job?.failureReason || 'Import failed';
            if (reason === 'SOURCE_FILE_LOST_REUPLOAD_REQUIRED') {
              setStatusMessage(
                'Import failed: The temporary source file was lost due to a container restart or sleep. On $0 ephemeral hosting (/tmp), please re-upload your file.'
              );
            } else if (reason.includes('BULK_REPLACE_DISABLED')) {
              setStatusMessage(
                'Bulk REPLACE mode is disabled to protect existing election turnouts and cross-constituency data integrity. Please use APPEND mode.'
              );
            } else {
              setStatusMessage(`Import failed: ${reason}`);
            }
            if (Array.isArray(job.errors)) {
              setUploadErrors(job.errors);
            }
            setIsCommitting(false);
            await loadLiveData();
          }
        } catch (pollErr: any) {
          console.warn('Job polling error:', pollErr);
          if (pollCount > 300) {
            clearInterval(pollTimer);
            setUploadStatus('error');
            setStatusMessage('Job monitoring timed out. Please check Import History to see final status.');
            setIsCommitting(false);
          }
        }
      }, 2000);

    } catch (err: any) {
      setUploadStatus('error');
      setStatusMessage(err?.message || 'Streaming upload failed.');
      setIsCommitting(false);
    }
  };

  const totalMandals = summary?.totalMandals ?? 0;
  const totalBooths = summary?.totalBooths ?? 0;
  const totalVoters = summary?.totalVoters ?? totalVotersCount;
  const totalConstituencies = summary?.totalConstituencies ?? 0;

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-slate-900 border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-cyan-400" />
            <h1 className="text-xl font-bold text-white">Data Ingestion & Geographic Rolls</h1>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Ingest and map electoral rolls, polling station boundaries, and voter demographics for{' '}
            <span className="text-amber-400 font-bold">{currentApp?.name || 'Selected Application'}</span>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
          {apps && apps.length > 0 && (
            <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700">
              <span className="text-[11px] font-bold text-slate-300">Party Tenant:</span>
              <select
                value={currentApp?.id || ''}
                onChange={(e) => {
                  const target = apps.find((a) => a.id === e.target.value);
                  if (target && onSelectApp) onSelectApp(target);
                }}
                className="bg-slate-900 border border-slate-700 text-amber-400 text-xs font-bold rounded-lg px-2.5 py-1 focus:outline-none focus:border-cyan-400 cursor-pointer"
              >
                {apps.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name || a.party || a.partyCode || a.id}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={loadLiveData}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Refresh database metrics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync DB</span>
          </button>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>PostgreSQL Active</span>
          </div>
        </div>
      </div>

      {/* Upload Box */}
      <div className="p-8 rounded-3xl bg-slate-900 border-2 border-dashed border-slate-700/80 hover:border-cyan-500/50 transition flex flex-col items-center justify-center text-center relative overflow-hidden">
        <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mb-3">
          <UploadCloud className="w-8 h-8" />
        </div>

        <h3 className="text-base font-bold text-white mb-1">
          Upload Official Electoral Roll (CSV, XLSX, XLS)
        </h3>
        <p className="text-xs text-slate-400 max-w-md mb-2">
          Recommended: <strong>CSV format</strong> for large electorates up to 100MB (250,000+ voters). Small files (XLSX/CSV &lt; 25MB) are also supported.
        </p>
        <p className="text-[11px] text-slate-500 max-w-md mb-4">
          Select your voter roll file. If headers are missing or non-standard, the interactive mapping engine will let you map columns with live pre-commit validation.
        </p>

        <label className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition cursor-pointer flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4" />
          <span>Browse File from Computer</span>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            className="hidden"
          />
        </label>

        {uploadStatus === 'parsing' && (
          <div className="mt-4 flex items-center gap-2 text-xs text-amber-400 font-semibold animate-pulse">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>{statusMessage}</span>
          </div>
        )}

        {uploadStatus === 'uploading' && (
          <div className="mt-4 w-full max-w-md space-y-2">
            <div className="flex justify-between text-xs font-semibold text-cyan-400">
              <span>{statusMessage}</span>
              <span>{uploadPercentage}%</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden border border-slate-700">
              <div
                className="bg-cyan-500 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${uploadPercentage}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-500">
              Streaming file directly to temporary storage. Zero whole-file memory buffering.
            </p>
          </div>
        )}

        {uploadStatus === 'processing' && (
          <div className="mt-4 w-full max-w-lg space-y-2.5 p-4 rounded-2xl bg-cyan-950/20 border border-cyan-500/30 text-left">
            <div className="flex items-center justify-between text-xs font-semibold text-cyan-400">
              <span className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-cyan-400 shrink-0" />
                <span>{statusMessage}</span>
              </span>
              {processingStats && processingStats.total > 0 && (
                <span className="shrink-0 font-mono">
                  {Math.round(((processingStats.valid + processingStats.failed) / processingStats.total) * 100)}%
                </span>
              )}
            </div>
            {processingStats && processingStats.total > 0 && (
              <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden border border-slate-700">
                <div
                  className="bg-emerald-500 h-2.5 rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, Math.round(((processingStats.valid + processingStats.failed) / processingStats.total) * 100))}%`,
                  }}
                />
              </div>
            )}
            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
              <span>Committed: <strong className="text-emerald-400">{processingStats?.valid?.toLocaleString('en-IN') || 0}</strong></span>
              <span>Errors: <strong className="text-red-400">{processingStats?.failed?.toLocaleString('en-IN') || 0}</strong></span>
              <span>Total: <strong className="text-white">{processingStats?.total?.toLocaleString('en-IN') || 0}</strong></span>
            </div>
            <div className="text-[10px] text-amber-400/90 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20">
              <strong>Notice ($0 Hosting):</strong> Processing executes via in-process background worker. If the server container restarts or goes to sleep, temporary files in /tmp are removed and the file will need to be re-uploaded.
            </div>
          </div>
        )}

        {uploadStatus === 'success' && (
          <div className="mt-4 px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-2 shadow-sm">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {uploadStatus === 'partial' && (
          <div className="mt-4 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm w-full max-w-2xl">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
              <span>{statusMessage}</span>
            </div>
            {uploadErrors.length > 0 && (
              <button
                onClick={() => setShowErrorDetails(!showErrorDetails)}
                className="text-[11px] underline hover:text-white transition flex items-center gap-1 cursor-pointer shrink-0"
              >
                <span>{showErrorDetails ? 'Hide Error Details' : `View ${uploadErrors.length} Failed Rows`}</span>
                {showErrorDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            )}
          </div>
        )}

        {uploadStatus === 'error' && (
          <div className="mt-4 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm w-full max-w-2xl">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{statusMessage}</span>
            </div>
            {uploadErrors.length > 0 && (
              <button
                onClick={() => setShowErrorDetails(!showErrorDetails)}
                className="text-[11px] underline hover:text-white transition flex items-center gap-1 cursor-pointer shrink-0"
              >
                <span>{showErrorDetails ? 'Hide Error Details' : `View ${uploadErrors.length} Row Errors`}</span>
                {showErrorDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Actionable Error Breakdown Panel */}
      {showErrorDetails && uploadErrors.length > 0 && (
        <div className="p-5 rounded-3xl bg-red-950/20 border border-red-500/30 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-red-400 font-bold text-xs">
              <AlertCircle className="w-4 h-4" />
              <span>Row-Level Ingestion Errors ({uploadErrors.length} records)</span>
            </div>
            <button
              onClick={() => setShowErrorDetails(false)}
              className="text-xs text-slate-400 hover:text-white transition cursor-pointer"
            >
              Close
            </button>
          </div>
          <p className="text-[11px] text-slate-400">
            The following records were rejected because they failed mandatory identity validation or unique constraint rules.
          </p>
          <div className="max-h-60 overflow-y-auto rounded-xl border border-red-900/40 bg-slate-950/60">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 text-slate-400 font-semibold border-b border-red-900/40 sticky top-0">
                <tr>
                  <th className="p-2.5 w-16 text-center">Row</th>
                  <th className="p-2.5 w-32">Field</th>
                  <th className="p-2.5 w-36">Value</th>
                  <th className="p-2.5">Error Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                {uploadErrors.map((err, idx) => (
                  <tr key={idx} className="hover:bg-red-500/5">
                    <td className="p-2.5 text-center text-amber-400">{err.rowNumber || idx + 1}</td>
                    <td className="p-2.5 text-slate-300 font-sans">{err.field || 'voter'}</td>
                    <td className="p-2.5 text-slate-400 truncate max-w-xs">{err.value || '—'}</td>
                    <td className="p-2.5 text-red-400 font-sans">{err.errorMessage}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Column Mapping & Pre-Commit Preview Modal */}
      {isMappingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto animate-in fade-in duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <span>Column Mapping & Pre-Commit Preview</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-normal">
                      {selectedFile?.name}
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Map your spreadsheet columns to system fields and review validation before committing.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsMappingModalOpen(false)}
                disabled={isCommitting}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {/* Header Detection Status Banner */}
              {mappingWarning ? (
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
                  <div>
                    <div className="font-bold">Missing or Ambiguous Header Row Detected</div>
                    <div className="text-[11px] text-amber-200/80 mt-0.5">{mappingWarning}</div>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 shrink-0 text-cyan-400" />
                  <div>
                    <div className="font-bold">Headers Recognized Automatically</div>
                    <div className="text-[11px] text-cyan-200/80">
                      Standard column headers detected. Verify the mappings below or adjust any unmapped fields.
                    </div>
                  </div>
                </div>
              )}

              {/* Validation Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Sample Preview Rows</div>
                  <div className="text-xl font-bold text-white mt-1">
                    {preCommitValidation.total.toLocaleString('en-IN')} Sampled
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    High-speed sample for column verification
                  </div>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Sample Status</div>
                  <div className="text-xl font-bold text-emerald-400 mt-1">
                    {preCommitValidation.valid.toLocaleString('en-IN')} / {preCommitValidation.total} Valid
                  </div>
                  <div className="text-[10px] text-emerald-500/80 mt-0.5">
                    {preCommitValidation.valid === preCommitValidation.total && preCommitValidation.total > 0
                      ? '100% of sample rows valid'
                      : `${preCommitValidation.invalid} missing mandatory fields in sample`}
                  </div>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Full Ingestion Target</div>
                  <div className="text-xl font-bold text-amber-400 mt-1">
                    Entire Spreadsheet
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    All 2,40,000+ rows streamed to server on commit
                  </div>
                </div>
              </div>

              {/* Mandatory Field Warnings */}
              {(!preCommitValidation.isEpicMapped || !preCommitValidation.isNameMapped) && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>
                    Mandatory requirement: You must map both <strong>Voter ID / EPIC</strong> and <strong>Voter Full Name</strong> before committing.
                  </span>
                </div>
              )}

              {/* Interactive Column Mapping Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200 text-xs">Spreadsheet Column Mapping</span>
                  <span className="text-[11px] text-slate-400">
                    Fields marked with <span className="text-red-400 font-bold">*</span> are mandatory
                  </span>
                </div>

                <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950">
                  <table className="w-full text-left">
                    <thead className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800 text-[11px]">
                      <tr>
                        <th className="p-3 w-1/3">Spreadsheet Column</th>
                        <th className="p-3 w-1/3">Sample Value (Row 1)</th>
                        <th className="p-3 w-1/3">Map to VIAP System Field</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 text-xs">
                      {sheetHeaders.map((header, idx) => {
                        const sampleVal = sheetDataRows[0]?.[idx] !== undefined ? String(sheetDataRows[0][idx]) : '—';
                        const currentMappedKey = columnMapping[header] || '';

                        return (
                          <tr key={idx} className="hover:bg-slate-900/40">
                            <td className="p-3 font-semibold text-white">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-cyan-400">{header}</span>
                                {!hasDetectedHeaders && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                                    Col {idx + 1}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="p-3 text-slate-400 font-mono text-[11px] truncate max-w-xs">
                              {sampleVal || <span className="text-slate-600">empty</span>}
                            </td>
                            <td className="p-3">
                              <select
                                value={currentMappedKey}
                                onChange={(e) => handleMappingChange(header, e.target.value)}
                                className={`w-full p-2 rounded-xl text-xs bg-slate-900 border transition cursor-pointer ${
                                  currentMappedKey
                                    ? 'border-cyan-500/60 text-white font-semibold'
                                    : 'border-slate-700 text-slate-400'
                                }`}
                              >
                                <option value="">-- Ignore / Do Not Import --</option>
                                <optgroup label="Mandatory Identity Fields">
                                  {TARGET_SYSTEM_FIELDS.filter((f) => f.required).map((f) => (
                                    <option key={f.key} value={f.key}>
                                      {f.label} *
                                    </option>
                                  ))}
                                </optgroup>
                                <optgroup label="Demographic & Hierarchy Fields">
                                  {TARGET_SYSTEM_FIELDS.filter((f) => !f.required).map((f) => (
                                    <option key={f.key} value={f.key}>
                                      {f.label}
                                    </option>
                                  ))}
                                </optgroup>
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Sample Mapped Records Preview Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                    <Eye className="w-4 h-4 text-cyan-400" />
                    <span>Mapped Data Preview (First 5 Rows)</span>
                  </span>
                  <span className="text-[11px] text-slate-500">Live mapped output</span>
                </div>

                <div className="border border-slate-800 rounded-2xl overflow-x-auto bg-slate-950">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800">
                      <tr>
                        <th className="p-2.5">Row</th>
                        <th className="p-2.5">EPIC No.</th>
                        <th className="p-2.5">Voter Name</th>
                        <th className="p-2.5">Age / Sex</th>
                        <th className="p-2.5">Booth No.</th>
                        <th className="p-2.5">Mandal</th>
                        <th className="p-2.5">Village</th>
                        <th className="p-2.5 text-right">Pre-Check</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 font-mono text-[11px]">
                      {preCommitValidation.previewRows.map((row: any) => (
                        <tr key={row.rowNum} className="hover:bg-slate-900/40 text-slate-300">
                          <td className="p-2.5 text-slate-500">{row.rowNum}</td>
                          <td className="p-2.5 font-bold text-cyan-400">{row.epic}</td>
                          <td className="p-2.5 text-white font-sans">{row.name}</td>
                          <td className="p-2.5">{row.age} / {row.gender}</td>
                          <td className="p-2.5">{row.booth}</td>
                          <td className="p-2.5 font-sans">{row.mandal}</td>
                          <td className="p-2.5 font-sans">{row.village}</td>
                          <td className="p-2.5 text-right font-sans">
                            {row.isValid ? (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                Valid
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                                Incomplete
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Representative Validation Errors */}
              {preCommitValidation.sampleErrors.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <div className="font-bold text-slate-300 text-xs">Representative Validation Warnings</div>
                  <ul className="space-y-1 text-[11px] text-red-400">
                    {preCommitValidation.sampleErrors.map((err, i) => (
                      <li key={i} className="flex items-center gap-1.5">
                        <span className="font-mono text-amber-400">Row {err.rowNumber}:</span>
                        <span>{err.message}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t border-slate-800 bg-slate-900 flex items-center justify-between gap-3">
              <button
                onClick={() => setIsMappingModalOpen(false)}
                disabled={isCommitting}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition cursor-pointer disabled:opacity-50"
              >
                Cancel / Choose Another File
              </button>

              <button
                onClick={handleCommitImport}
                disabled={
                  isCommitting ||
                  !preCommitValidation.isEpicMapped ||
                  !preCommitValidation.isNameMapped ||
                  preCommitValidation.valid === 0
                }
                className="px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isCommitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Streaming & Ingesting to PostgreSQL...</span>
                  </>
                ) : (
                  <>
                    <Database className="w-4 h-4" />
                    <span>
                      Commit & Ingest Entire File ({selectedFile ? `${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB` : 'Spreadsheet'}) to Database
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Jurisdiction Hierarchy Counts — Derived directly from live PostgreSQL database */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Constituencies</div>
          <div className="text-2xl font-black text-white mt-1">
            {totalConstituencies} {totalConstituencies === 1 ? 'Constituency' : 'Constituencies'}
          </div>
          <div className="text-[11px] text-slate-500 truncate">
            {currentApp?.jurisdiction || currentApp?.name || 'Active Platform Tenant'}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Mandals / Blocks</div>
          <div className="text-2xl font-black text-white mt-1">
            {totalMandals} {totalMandals === 1 ? 'Mandal' : 'Mandals'}
          </div>
          <div className="text-[11px] text-slate-500">
            {totalMandals > 0 ? 'Boundary Mapped in DB' : '0 Mandals in DB'}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Polling Booths</div>
          <div className="text-2xl font-black text-white mt-1">
            {totalBooths} {totalBooths === 1 ? 'Booth' : 'Booths'}
          </div>
          <div className="text-[11px] text-emerald-400 font-bold">
            {totalBooths > 0 ? 'Geocoded & Synchronized' : '0 Booths in DB'}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Enrolled Voters</div>
          <div className="text-2xl font-black text-white mt-1">
            {totalVoters.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-cyan-400 font-bold">
            {totalVoters > 0 ? 'PostgreSQL Live Records' : '0 Enrolled Voters'}
          </div>
        </div>
      </div>

      {/* Cadre Incharge Logins & Credential Roster Center */}
      {(() => {
        const mandalSlots = rosterSlotsData?.sections?.mandals || [];
        const psSlots = rosterSlotsData?.sections?.pollingStations || [];
        const boothSlots = rosterSlotsData?.sections?.booths || [];
        const groupSlots = rosterSlotsData?.sections?.groups || [];

        const mCount = rosterSlotsData?.summary?.mandalCount ?? (mandalSlots.length || totalMandals);
        const psCount = rosterSlotsData?.summary?.pollingStationCount ?? (psSlots.length || rosterSummary?.pollingStationsCount || 0);
        const bCount = rosterSlotsData?.summary?.boothCount ?? (boothSlots.length || totalBooths);
        const gCount = rosterSlotsData?.summary?.groupCount ?? (groupSlots.length || rosterSummary?.groupsCount || 0);

        const mAssigned = mandalSlots.filter((s) => s.assignedUser).length;
        const psAssigned = psSlots.filter((s) => s.assignedUser).length;
        const bAssigned = boothSlots.filter((s) => s.assignedUser).length;
        const gAssigned = groupSlots.filter((s) => s.assignedUser).length;

        const totalRequiredSlots = mCount + psCount + bCount + gCount;
        const totalAssignedSlots = mAssigned + psAssigned + bAssigned + gAssigned;
        const overallPct = totalRequiredSlots > 0 ? Math.round((totalAssignedSlots / totalRequiredSlots) * 100) : 0;

        const currentSlots = rosterSlotsData?.sections?.[activeCadreTab] || [];
        const filteredSlots = currentSlots.filter((slot) => {
          if (onlyUnassignedFilter && slot.assignedUser) return false;
          if (!cadreSearchQuery.trim()) return true;
          const q = cadreSearchQuery.toLowerCase();
          return (
            slot.slotCode.toLowerCase().includes(q) ||
            slot.title.toLowerCase().includes(q) ||
            (slot.subtitle && slot.subtitle.toLowerCase().includes(q)) ||
            (slot.mandalName && slot.mandalName.toLowerCase().includes(q)) ||
            (slot.villageName && slot.villageName.toLowerCase().includes(q)) ||
            (slot.assignedUser?.name && slot.assignedUser.name.toLowerCase().includes(q)) ||
            (slot.assignedUser?.mobileNumber && slot.assignedUser.mobileNumber.includes(q))
          );
        });

        const activeFilledCount = currentSlots.filter((slot) => {
          const input = manualInputs[slot.slotCode];
          return input && input.mobileNumber.trim().replace(/\D/g, '').length === 10;
        }).length;

        const getValidation = (raw: string) => {
          const trimmed = (raw || '').trim();
          if (!trimmed) return { status: 'empty', label: '' };
          const clean = trimmed.replace(/\D/g, '').slice(-10);
          if (clean.length < 10) return { status: 'invalid', label: `${10 - clean.length} more digits` };
          if (/^910[1-4]\d{6}$/.test(clean)) return { status: 'mock', label: 'Synthetic 9101-9104 blocked' };
          if (!/^[6-9]\d{9}$/.test(clean)) return { status: 'invalid', label: 'Starts with 6-9' };
          return { status: 'valid', label: 'Valid 10-digit Mobile' };
        };

        return (
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-6">
            {/* Header & Controls */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-white">Cadre Incharge Logins & Number Allocation</h2>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                      {currentApp?.name || 'Party'} Tenant
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Allocate authentic 10-digit mobile numbers for field incharges. Each booth's voters are chunked strictly into 100-voter groups (e.g. B1-V1, B1-V2).
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={loadLiveData}
                  disabled={isLoadingSlots}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700 transition cursor-pointer flex items-center gap-1.5"
                  title="Refresh slots"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSlots ? 'animate-spin text-cyan-400' : ''}`} />
                  <span>Refresh</span>
                </button>

                <button
                  onClick={handleDownloadRoster}
                  disabled={!summary?.constituencyId}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 transition cursor-pointer flex items-center gap-2 disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Download Live Credential Roster (.CSV)</span>
                </button>
              </div>
            </div>

            {/* Anti-Mock Security Directive Banner */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-slate-900 to-cyan-500/10 border border-amber-500/30 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
              <div className="flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-amber-300">Anti-Mock Protection Active: Real 10-Digit Mobile Numbers Required</div>
                  <div className="text-slate-400 mt-0.5">
                    Field incharges authenticate directly via Mobile OTP or mobile + passcode. Synthetic dummy ranges (<code className="text-amber-400">9101...</code>, <code className="text-amber-400">9104...</code>) are strictly blocked. Feed real numbers via Option A (Spreadsheet) or Option B (Manual Grid).
                  </div>
                </div>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                <div className="px-3 py-1 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] font-mono text-slate-300">
                  Progress: <strong className="text-emerald-400">{totalAssignedSlots}</strong> / {totalRequiredSlots} ({overallPct}%)
                </div>
              </div>
            </div>

            {/* 4 Incharge Hierarchy Tier Cards (Reflecting Real DB Counts) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Tier 1: Mandals */}
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">1. Mandal Incharge</span>
                  <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded-full ${mAssigned === mCount && mCount > 0 ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-slate-800 text-slate-300'}`}>
                    {mAssigned} / {mCount} Logins
                  </span>
                </div>
                <div className="text-xs text-slate-300 font-mono">
                  UserCode: <span className="text-cyan-400">MDL-&lt;SLUG&gt;</span>
                </div>
                <div className="text-[11px] text-slate-400">
                  Unit: <strong>Mandal Administrative Incharge</strong>
                </div>
                <div className="text-[11px] text-slate-500">
                  Status: <strong className={mAssigned > 0 ? 'text-emerald-400' : 'text-amber-400'}>{mAssigned > 0 ? `${mAssigned} Active in DB` : 'Pending Allocation'}</strong>
                </div>
              </div>

              {/* Tier 2: Polling Stations */}
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">2. Polling Station Incharge</span>
                  <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded-full ${psAssigned === psCount && psCount > 0 ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-slate-800 text-slate-300'}`}>
                    {psAssigned} / {psCount} Logins
                  </span>
                </div>
                <div className="text-xs text-slate-300 font-mono">
                  UserCode: <span className="text-cyan-400">VIL-&lt;001..151&gt;</span>
                </div>
                <div className="text-[11px] text-slate-400">
                  Unit: <strong>Polling Station / Village Campus</strong>
                </div>
                <div className="text-[11px] text-slate-500">
                  Status: <strong className={psAssigned > 0 ? 'text-emerald-400' : 'text-amber-400'}>{psAssigned > 0 ? `${psAssigned} Active in DB` : 'Pending Allocation'}</strong>
                </div>
              </div>

              {/* Tier 3: Booths */}
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">3. Booth Incharge</span>
                  <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded-full ${bAssigned === bCount && bCount > 0 ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-slate-800 text-slate-300'}`}>
                    {bAssigned} / {bCount} Logins
                  </span>
                </div>
                <div className="text-xs text-slate-300 font-mono">
                  UserCode: <span className="text-cyan-400">BTH-&lt;001..283&gt;</span>
                </div>
                <div className="text-[11px] text-slate-400">
                  Unit: <strong>Electoral Part / Booth Incharge</strong>
                </div>
                <div className="text-[11px] text-slate-500">
                  Status: <strong className={bAssigned > 0 ? 'text-emerald-400' : 'text-amber-400'}>{bAssigned > 0 ? `${bAssigned} Active in DB` : 'Pending Allocation'}</strong>
                </div>
              </div>

              {/* Tier 4: 100-Voter Groups */}
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400">4. 100-Voter Incharge</span>
                  <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded-full ${gAssigned === gCount && gCount > 0 ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-slate-800 text-slate-300'}`}>
                    {gAssigned} / {gCount} Logins
                  </span>
                </div>
                <div className="text-xs text-slate-300 font-mono">
                  UserCode: <span className="text-cyan-400">B&lt;Part&gt;-V&lt;Group&gt;</span>
                </div>
                <div className="text-[11px] text-slate-400">
                  Partition: <strong>Strict Max 100 Electors Chunk</strong>
                </div>
                <div className="text-[11px] text-slate-500">
                  Status: <strong className={gAssigned > 0 ? 'text-emerald-400' : 'text-amber-400'}>{gAssigned > 0 ? `${gAssigned} Active in DB` : 'Pending Allocation'}</strong>
                </div>
              </div>
            </div>

            {/* Input Method Selector (Option A vs Option B) */}
            <div className="flex items-center justify-between flex-wrap gap-3 pt-2">
              <div className="flex items-center bg-slate-950 p-1 rounded-2xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setAllocationMode('spreadsheet')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${allocationMode === 'spreadsheet' ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20' : 'text-slate-400 hover:text-white'}`}
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Option A: Roster Spreadsheet Upload & Template</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAllocationMode('manual')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${allocationMode === 'manual' ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20' : 'text-slate-400 hover:text-white'}`}
                >
                  <Layers className="w-4 h-4" />
                  <span>Option B: Section-wise Manual Number Input Grid</span>
                </button>
              </div>

              {/* Default Passcode Configuration */}
              <div className="flex items-center gap-2 bg-slate-950/80 px-3.5 py-1.5 rounded-xl border border-slate-800 text-xs">
                <Key className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-slate-400 font-semibold">Initial Passcode:</span>
                <input
                  type="text"
                  value={rosterPasscode}
                  onChange={(e) => setRosterPasscode(e.target.value)}
                  placeholder="123456"
                  className="w-20 bg-slate-900 border border-slate-700 text-emerald-400 font-mono font-bold text-xs rounded-lg px-2 py-0.5 text-center focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            {/* Option A: Spreadsheet Upload & Template */}
            {allocationMode === 'spreadsheet' && (
              <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Step 1: Download Pre-filled Template */}
                  <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                      <Download className="w-4 h-4" />
                      <span>Step 1: Download Pre-filled Roster Template</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Download the template containing all required slots ({mCount} Mandals, {psCount} Polling Stations, {bCount} Booths, {gCount} 100-Voter Groups). Simply fill in Incharge Name and 10-digit Mobile Number.
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleDownloadTemplate('xlsx')}
                        className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 transition cursor-pointer flex items-center gap-2"
                      >
                        <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                        <span>Download Template (.XLSX)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDownloadTemplate('csv')}
                        className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 transition cursor-pointer flex items-center gap-2"
                      >
                        <FileText className="w-4 h-4 text-cyan-400" />
                        <span>Download (.CSV)</span>
                      </button>
                    </div>
                  </div>

                  {/* Step 2: Upload Filled Roster */}
                  <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-cyan-400">
                      <FileUp className="w-4 h-4" />
                      <span>Step 2: Upload Filled Roster Spreadsheet</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Select your filled spreadsheet. Real mobile numbers will be validated and registered into PostgreSQL with active login accounts.
                    </p>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
                      <label className="flex-1 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-medium border border-slate-700 cursor-pointer flex items-center justify-between truncate">
                        <span className="truncate">{rosterSpreadsheetFile ? rosterSpreadsheetFile.name : 'Choose .xlsx or .csv file...'}</span>
                        <input
                          type="file"
                          accept=".xlsx,.xls,.csv"
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              setRosterSpreadsheetFile(e.target.files[0]);
                              setRosterUploadSuccess(null);
                              setRosterUploadError(null);
                            }
                          }}
                          className="hidden"
                        />
                      </label>

                      <button
                        type="button"
                        onClick={handleUploadRosterFile}
                        disabled={!rosterSpreadsheetFile || isUploadingRoster}
                        className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 shrink-0"
                      >
                        {isUploadingRoster ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                        <span>{isUploadingRoster ? 'Registering...' : 'Upload & Register into DB'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {rosterUploadSuccess && (
                  <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
                    <span>{rosterUploadSuccess}</span>
                  </div>
                )}

                {rosterUploadError && (
                  <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-semibold flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
                    <span>{rosterUploadError}</span>
                  </div>
                )}
              </div>
            )}

            {/* Option B: Section-wise Manual Input Grid */}
            {allocationMode === 'manual' && (
              <div className="space-y-4">
                {/* Section Sub-Tabs */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-1.5 overflow-x-auto">
                    {[
                      { key: 'mandals', label: '1. Mandals', count: mCount, assigned: mAssigned },
                      { key: 'pollingStations', label: '2. Polling Stations', count: psCount, assigned: psAssigned },
                      { key: 'booths', label: '3. Booths', count: bCount, assigned: bAssigned },
                      { key: 'groups', label: '4. 100-Voter Groups', count: gCount, assigned: gAssigned },
                    ].map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => {
                          setActiveCadreTab(tab.key as any);
                          setManualSubmitMessage(null);
                          setManualSubmitError(null);
                        }}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shrink-0 ${activeCadreTab === tab.key ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:text-white bg-slate-950/60 border border-slate-800'}`}
                      >
                        <span>{tab.label}</span>
                        <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${tab.assigned === tab.count && tab.count > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                          {tab.assigned}/{tab.count}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Search and Unassigned Filter */}
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={cadreSearchQuery}
                        onChange={(e) => setCadreSearchQuery(e.target.value)}
                        placeholder="Search slot code or name..."
                        className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl pl-8 pr-3 py-1.5 focus:outline-none focus:border-cyan-400 w-48 sm:w-56"
                      />
                    </div>

                    <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={onlyUnassignedFilter}
                        onChange={(e) => setOnlyUnassignedFilter(e.target.checked)}
                        className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                      />
                      <span>Only Unassigned</span>
                    </label>
                  </div>
                </div>

                {/* Feedback Alerts */}
                {manualSubmitMessage && (
                  <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
                    <span>{manualSubmitMessage}</span>
                  </div>
                )}

                {manualSubmitError && (
                  <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-semibold flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
                    <span>{manualSubmitError}</span>
                  </div>
                )}

                {/* Slots Grid */}
                <div className="max-h-[500px] overflow-y-auto space-y-2.5 pr-1">
                  {filteredSlots.length > 0 ? (
                    filteredSlots.map((slot) => {
                      const input = manualInputs[slot.slotCode] || { inchargeName: '', mobileNumber: '' };
                      const val = getValidation(input.mobileNumber);
                      const isAssignedInDb = Boolean(slot.assignedUser);

                      return (
                        <div
                          key={slot.slotIdentifier}
                          className={`p-3.5 rounded-2xl border transition flex flex-col md:flex-row md:items-center justify-between gap-3 ${isAssignedInDb ? 'bg-slate-950/40 border-slate-800/60' : 'bg-slate-950 border-slate-800'}`}
                        >
                          {/* Slot Info */}
                          <div className="min-w-0 md:w-5/12 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shrink-0">
                                {slot.slotCode}
                              </span>
                              <span className="text-xs font-bold text-white truncate">{slot.title}</span>
                            </div>
                            <div className="text-[11px] text-slate-400 truncate flex items-center gap-2">
                              <span>{slot.subtitle}</span>
                              {slot.voterRange && (
                                <span className="font-mono text-[10px] text-purple-400 px-1.5 py-0.2 rounded bg-purple-500/10 border border-purple-500/20">
                                  Electors: {slot.voterRange} ({slot.voterCount})
                                </span>
                              )}
                            </div>
                            {isAssignedInDb && (
                              <div className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1.5 pt-0.5">
                                <Check className="w-3.5 h-3.5" />
                                <span>Assigned in DB: <strong>{slot.assignedUser?.name}</strong> (+91 {slot.assignedUser?.mobileNumber})</span>
                              </div>
                            )}
                          </div>

                          {/* Inputs: Incharge Name & Real Mobile */}
                          <div className="flex flex-col sm:flex-row items-center gap-2 md:w-7/12">
                            <input
                              type="text"
                              value={input.inchargeName}
                              onChange={(e) => handleManualInputChange(slot.slotCode, 'inchargeName', e.target.value)}
                              placeholder={isAssignedInDb ? slot.assignedUser?.name : 'Incharge Full Name (optional)'}
                              className="w-full sm:w-1/2 bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-cyan-400"
                            />

                            <div className="w-full sm:w-1/2 relative">
                              <input
                                type="tel"
                                maxLength={10}
                                value={input.mobileNumber}
                                onChange={(e) => handleManualInputChange(slot.slotCode, 'mobileNumber', e.target.value)}
                                placeholder={isAssignedInDb ? slot.assignedUser?.mobileNumber : '10-Digit Real Mobile'}
                                className={`w-full bg-slate-900 border text-xs font-mono rounded-xl px-3 py-2 pr-8 focus:outline-none ${val.status === 'valid' ? 'border-emerald-500/60 text-emerald-300' : val.status === 'mock' || (val.status === 'invalid' && input.mobileNumber.length >= 10) ? 'border-red-500/60 text-red-300' : 'border-slate-700 text-slate-200 focus:border-cyan-400'}`}
                              />
                              {val.status === 'valid' && (
                                <CheckCircle2 className="w-4 h-4 text-emerald-400 absolute right-2.5 top-2.5" />
                              )}
                              {val.status === 'mock' && (
                                <span title="Mock prefix 9101-9104 prohibited" className="absolute right-2.5 top-2.5">
                                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-8 text-center text-slate-500 rounded-2xl bg-slate-950/40 border border-slate-800">
                      <Users className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                      <p className="font-bold text-slate-300">No slots match filter in this section.</p>
                      <p className="text-xs text-slate-500 mt-1">Try clearing your search query or unchecking 'Only Unassigned'.</p>
                    </div>
                  )}
                </div>

                {/* Manual Section Submit Bar */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-xs text-slate-400">
                    <strong className="text-cyan-400 font-mono">{activeFilledCount}</strong> valid mobile {activeFilledCount === 1 ? 'number' : 'numbers'} filled for this section.
                  </div>

                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setManualInputs((prev) => {
                          const next = { ...prev };
                          for (const s of currentSlots) {
                            delete next[s.slotCode];
                          }
                          return next;
                        });
                      }}
                      className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white font-semibold text-xs transition cursor-pointer"
                    >
                      Clear Section Inputs
                    </button>

                    <button
                      type="button"
                      onClick={handleSubmitManualSection}
                      disabled={isSubmittingManual || activeFilledCount === 0}
                      className="px-6 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isSubmittingManual ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      <span>Register {activeFilledCount > 0 ? `(${activeFilledCount})` : ''} into Database</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Preview Table — Sourced directly from PostgreSQL database */}
      <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-bold text-white">Electoral Roll Records Preview</h2>
          </div>
          <span className="text-[10px] font-bold text-slate-500">Live Database Records ({voters.length})</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="p-3">EPIC No.</th>
                <th className="p-3">Voter Name</th>
                <th className="p-3">Age / Sex</th>
                <th className="p-3">Polling Booth</th>
                <th className="p-3">Village / Ward</th>
                <th className="p-3">Mandal</th>
                <th className="p-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {voters.length > 0 ? (
                voters.map((row, idx) => {
                  const epic = row.epicNumber || row.epic || row.voterId || row.id || '—';
                  const name = row.name || row.fullName || row.voterName || '—';
                  const age = row.age ? `${row.age} / ${row.gender || '-'}` : (row.gender || '—');
                  const booth = row.boothNumber || row.booth?.name || row.booth || '—';
                  const village = row.village?.name || row.village || '—';
                  const mandal = row.mandal?.name || row.mandal || '—';
                  const status = row.surveyStatus || row.voterStatus || 'Active';

                  return (
                    <tr key={row.id || idx} className="hover:bg-slate-800/40 text-slate-300">
                      <td className="p-3 font-mono font-bold text-cyan-400">{epic}</td>
                      <td className="p-3 font-semibold text-white">{name}</td>
                      <td className="p-3">{age}</td>
                      <td className="p-3">{booth}</td>
                      <td className="p-3">{village}</td>
                      <td className="p-3">{mandal}</td>
                      <td className="p-3 text-right">
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    <FolderTree className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                    <p className="font-bold text-slate-300">No voter records enrolled in database yet.</p>
                    <p className="text-xs text-slate-500 mt-1">Upload an official electoral roll file (.xlsx, .csv) above to ingest live voter rolls.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
