'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Layers,
  Database,
  Search,
  Filter,
  ArrowRight,
  Clock,
  ChevronRight,
  ShieldCheck,
  FileText,
  Trash2,
  Eye,
  Info,
  ArrowLeft,
  Check,
  X,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  fetchCmsApplications,
  fetchApplicationConfig,
  fetchApplicationHierarchy,
  fetchApplicationConstituencies,
  fetchColumnMappingSuggestions,
  validateApplicationData,
  importApplicationData,
  fetchDataImports,
  fetchDataImportErrors,
  ApplicationConfig,
  ConstituencyItem,
  ValidationReport,
  ImportSummary,
  DataImportRecord,
} from '../../lib/api/applications.api';
import { useCms } from '../../context/CmsContext';

interface AssignDataModuleProps {
  initialAppId?: string;
  onNavigateToIncharges?: (appId: string) => void;
  onClose?: () => void;
}

export default function AssignDataModule({
  initialAppId,
  onNavigateToIncharges,
  onClose,
}: AssignDataModuleProps) {
  const { config: globalConfig } = useCms();

  // Navigation & View Mode
  // 'list': Assembly/Constituency table & hierarchy overview
  // 'upload': Multi-step Excel ingestion modal for selected target constituency
  // 'history': Full import history table with filters & error downloads
  const [activeTab, setActiveTab] = useState<'list' | 'history'>('list');

  // Application State
  const [applications, setApplications] = useState<any[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<string>(initialAppId || 'default');
  const [appConfig, setAppConfig] = useState<ApplicationConfig | null>(null);
  const [hierarchyLevels, setHierarchyLevels] = useState<string[]>([]);
  const [hierarchyLabels, setHierarchyLabels] = useState<Record<string, string>>({});
  const [loadingApp, setLoadingApp] = useState(false);

  // Target Filter States for Cascading Selection
  const [selectedStateId, setSelectedStateId] = useState<string>('ALL');
  const [selectedZoneId, setSelectedZoneId] = useState<string>('ALL');
  const [selectedParliamentId, setSelectedParliamentId] = useState<string>('ALL');
  const [constituencies, setConstituencies] = useState<ConstituencyItem[]>([]);
  const [loadingConstituencies, setLoadingConstituencies] = useState(false);
  const [acSearch, setAcSearch] = useState('');
  const [acStatusFilter, setAcStatusFilter] = useState<'ALL' | 'SUCCESS' | 'PENDING' | 'PARTIAL_SUCCESS' | 'FAILED'>('ALL');

  // Active Target for Upload Flow
  const [targetConstituency, setTargetConstituency] = useState<ConstituencyItem | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadStep, setUploadStep] = useState<'upload' | 'mapping' | 'preview' | 'importing' | 'summary'>('upload');

  // Excel & Ingestion States
  const [file, setFile] = useState<File | null>(null);
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [systemFieldsCatalog, setSystemFieldsCatalog] = useState<Array<{ key: string; label: string; required: boolean; description: string }>>([]);

  // Validation States
  const [validating, setValidating] = useState(false);
  const [validationReport, setValidationReport] = useState<ValidationReport | null>(null);
  const [showValidationErrorsOnly, setShowValidationErrorsOnly] = useState(false);

  // Import Execution States
  const [importMode, setImportMode] = useState<'APPEND' | 'REPLACE'>('APPEND');
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false);
  const [clusterSize, setClusterSize] = useState<number>(100);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // Import History States
  const [historyItems, setHistoryItems] = useState<DataImportRecord[]>([]);
  const [historyPagination, setHistoryPagination] = useState({ total: 0, page: 1, limit: 15, totalPages: 1 });
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyStatusFilter, setHistoryStatusFilter] = useState<string>('ALL');
  const [historySearch, setHistorySearch] = useState('');
  const [historyConstituencyFilter, setHistoryConstituencyFilter] = useState<string>('ALL');

  // View Error Details Modal
  const [selectedHistoryForErrors, setSelectedHistoryForErrors] = useState<DataImportRecord | null>(null);
  const [historyErrors, setHistoryErrors] = useState<any[]>([]);
  const [loadingErrors, setLoadingErrors] = useState(false);

  // 1. Initial Load: Applications
  useEffect(() => {
    async function loadApplications() {
      setLoadingApp(true);
      try {
        const apps = await fetchCmsApplications();
        setApplications(apps);
        if (apps.length > 0) {
          const match = apps.find((a) => a.id === selectedAppId || a.configKey === selectedAppId) || apps[0];
          setSelectedAppId(match.id || match.configKey || 'default');
        }
      } catch (err) {
        console.error('Failed to load CMS applications:', err);
      } finally {
        setLoadingApp(false);
      }
    }
    loadApplications();
  }, []);

  // 2. Load Selected Application Configuration & Hierarchy
  useEffect(() => {
    if (!selectedAppId) return;

    async function loadConfigAndHierarchy() {
      setLoadingApp(true);
      try {
        const [cfg, hier] = await Promise.all([
          fetchApplicationConfig(selectedAppId).catch(() => null),
          fetchApplicationHierarchy(selectedAppId).catch(() => null),
        ]);

        if (cfg) {
          setAppConfig(cfg);
          setHierarchyLabels(cfg.hierarchyLabels || {});
          setHierarchyLevels(cfg.activeHierarchyLevels || ['STATE', 'ZONE', 'PARLIAMENT', 'CONSTITUENCY', 'MANDAL', 'VILLAGE', 'BOOTH', 'VOTER_GROUP']);
        } else if (hier) {
          setHierarchyLabels(hier.hierarchyLabels || {});
          setHierarchyLevels(hier.activeHierarchyLevels || []);
        }

        loadConstituencies();
      } catch (err) {
        console.error('Failed to load application config:', err);
      } finally {
        setLoadingApp(false);
      }
    }

    loadConfigAndHierarchy();
  }, [selectedAppId]);

  // 3. Load Scoped Constituencies
  const loadConstituencies = async () => {
    if (!selectedAppId) return;
    setLoadingConstituencies(true);
    try {
      const filters: any = {};
      if (selectedStateId !== 'ALL') filters.stateId = selectedStateId;
      if (selectedZoneId !== 'ALL') filters.zoneId = selectedZoneId;
      if (selectedParliamentId !== 'ALL') filters.parliamentId = selectedParliamentId;

      const list = await fetchApplicationConstituencies(selectedAppId, filters);
      setConstituencies(list);
    } catch (err) {
      console.error('Failed to load constituencies:', err);
    } finally {
      setLoadingConstituencies(false);
    }
  };

  useEffect(() => {
    loadConstituencies();
  }, [selectedStateId, selectedZoneId, selectedParliamentId]);

  // 4. Load History on Tab Switch
  useEffect(() => {
    if (activeTab === 'history' && selectedAppId) {
      loadHistory(1);
    }
  }, [activeTab, selectedAppId, historyStatusFilter, historyConstituencyFilter]);

  const loadHistory = async (page = 1) => {
    setLoadingHistory(true);
    try {
      const res = await fetchDataImports(selectedAppId, {
        status: historyStatusFilter,
        constituencyId: historyConstituencyFilter,
        page,
        limit: 15,
      });
      setHistoryItems(res.items || []);
      setHistoryPagination(res.pagination || { total: 0, page: 1, limit: 15, totalPages: 1 });
    } catch (err) {
      console.error('Failed to load import history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Open Ingestion Drawer for a specific target constituency
  const handleOpenUploadForTarget = (ac: ConstituencyItem) => {
    setTargetConstituency(ac);
    setFile(null);
    setRawRows([]);
    setFileHeaders([]);
    setColumnMapping({});
    setValidationReport(null);
    setImportSummary(null);
    setImportError(null);
    setUploadStep('upload');
    setIsUploadModalOpen(true);
  };

  // Handle File Selection & Parsing
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pickedFile = e.target.files?.[0];
    if (!pickedFile) return;

    // Check extension
    const nameLower = pickedFile.name.toLowerCase();
    if (!nameLower.endsWith('.xlsx') && !nameLower.endsWith('.xls')) {
      setImportError('Invalid file format. Only Excel spreadsheets (.xlsx, .xls) are supported.');
      return;
    }

    setFile(pickedFile);
    setIsParsing(true);
    setImportError(null);
    setValidationReport(null);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          throw new Error('Spreadsheet has no sheets');
        }
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonRows: any[] = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

        if (jsonRows.length === 0) {
          throw new Error('Spreadsheet sheet is empty or has no data rows');
        }

        const headers = Object.keys(jsonRows[0] || {});
        setFileHeaders(headers);
        setRawRows(jsonRows);
        setIsParsing(false);

        // Fetch suggested auto-mappings from backend
        const mapSuggestions = await fetchColumnMappingSuggestions(selectedAppId, headers);
        setColumnMapping(mapSuggestions.suggestions || {});
        setSystemFieldsCatalog(mapSuggestions.systemFields || []);
      } catch (err: any) {
        setIsParsing(false);
        setImportError(`Failed to parse Excel file: ${err.message}`);
      }
    };
    reader.readAsBinaryString(pickedFile);
  };

  // Run Validate-Only (Does not write to DB)
  const handleValidateOnly = async () => {
    if (!rawRows || rawRows.length === 0) {
      setImportError('Please upload an Excel file first.');
      return;
    }

    setValidating(true);
    setImportError(null);
    try {
      const rep = await validateApplicationData(selectedAppId, 'VOTER', rawRows, {
        targetConstituencyId: targetConstituency?.id,
        columnMapping,
        fileName: file?.name,
      });
      setValidationReport(rep);
    } catch (err: any) {
      setImportError(`Validation failed: ${err.message}`);
    } finally {
      setValidating(false);
    }
  };

  // Download Sample Excel Template
  const handleDownloadSampleExcel = () => {
    const sampleHeaders = [
      {
        'Voter ID / EPIC': 'AP01009823',
        'Voter Name': 'Ravi Kumar',
        'Father / Husband Name': 'Venkata Rao',
        'Relation Type': 'FATHER',
        Age: '34',
        Gender: 'MALE',
        'Mobile Number': '9876543210',
        'House No': '4-12/A',
        Mandal: targetConstituency?.name ? `${targetConstituency.name} Mandal` : 'Kondapi Mandal',
        'Village / Ward': 'Ponnaluru',
        'Booth Number': '101',
        '100-Voter Group': 'Group 1',
        Caste: 'BC-A',
        Profession: 'Agriculture',
        'Political Preference': 'TDP',
      },
      {
        'Voter ID / EPIC': 'AP01009824',
        'Voter Name': 'Lakshmi Devi',
        'Father / Husband Name': 'Ravi Kumar',
        'Relation Type': 'HUSBAND',
        Age: '31',
        Gender: 'FEMALE',
        'Mobile Number': '9876543211',
        'House No': '4-12/A',
        Mandal: targetConstituency?.name ? `${targetConstituency.name} Mandal` : 'Kondapi Mandal',
        'Village / Ward': 'Ponnaluru',
        'Booth Number': '101',
        '100-Voter Group': 'Group 1',
        Caste: 'BC-A',
        Profession: 'Homemaker',
        'Political Preference': 'TDP',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(sampleHeaders);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sample_Voters');
    XLSX.writeFile(wb, `${targetConstituency?.name || 'Constituency'}_Sample_Voter_Template.xlsx`);
  };

  // Check required field mappings
  const unmappedRequiredFields = useMemo(() => {
    const requiredKeys = ['epicNumber', 'fullName', 'age', 'gender', 'mandal', 'village', 'boothNumber'];
    const mappedValues = new Set(Object.values(columnMapping));
    return requiredKeys.filter((key) => !mappedValues.has(key));
  }, [columnMapping]);

  // Execute Final Ingestion (Append or Replace)
  const executeImport = async () => {
    if (!targetConstituency) return;
    setImporting(true);
    setUploadStep('importing');
    setImportProgress(10);
    setImportError(null);

    const progressTimer = setInterval(() => {
      setImportProgress((prev) => {
        if (prev < 90) return prev + Math.floor(Math.random() * 15) + 5;
        return prev;
      });
    }, 400);

    try {
      const summary = await importApplicationData(selectedAppId, {
        level: 'VOTER',
        rows: rawRows,
        targetConstituencyId: targetConstituency.id,
        columnMapping,
        importMode,
        voterGroupSize: clusterSize,
        fileName: file?.name || 'import.xlsx',
        fileSize: file?.size || 0,
      });

      clearInterval(progressTimer);
      setImportProgress(100);
      setImportSummary(summary);
      setUploadStep('summary');

      // Refresh constituency table
      loadConstituencies();
    } catch (err: any) {
      clearInterval(progressTimer);
      setImportError(`Import failed: ${err.message}`);
      setUploadStep('preview');
    } finally {
      setImporting(false);
    }
  };

  // Download Error Report CSV for an import
  const handleDownloadErrors = (errorsList: any[], filename = 'errors.csv') => {
    if (!errorsList || errorsList.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(errorsList);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Errors');
    XLSX.writeFile(wb, filename);
  };

  // Filtered constituencies in list view
  const filteredConstituencies = useMemo(() => {
    return constituencies.filter((c) => {
      const matchStatus = acStatusFilter === 'ALL' || c.importStatus === acStatusFilter;
      const matchSearch =
        acSearch === '' ||
        c.name.toLowerCase().includes(acSearch.toLowerCase()) ||
        c.code.toLowerCase().includes(acSearch.toLowerCase()) ||
        c.parliamentName.toLowerCase().includes(acSearch.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [constituencies, acSearch, acStatusFilter]);

  return (
    <div id="assign-data-root" className="min-h-screen bg-slate-900/95 text-slate-100 p-3 sm:p-6 font-sans flex justify-center items-start">
      <div className="w-full max-w-7xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden text-slate-900 flex flex-col">
        {/* Header Ribbon */}
        <div className="bg-slate-950 text-white px-6 py-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/20">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-amber-400">
                  CMS Operations Studio
                </span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-950">
                  Assign Data
                </span>
              </div>
              <h1 className="text-xl font-black tracking-tight text-white">
                Assign Data & Hierarchy Roll Ingestion
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Application Selector */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl px-3 py-1.5 flex items-center gap-2 shadow-inner">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                App:
              </span>
              <select
                value={selectedAppId}
                onChange={(e) => setSelectedAppId(e.target.value)}
                className="bg-transparent text-amber-400 font-black text-xs focus:outline-none cursor-pointer"
              >
                {applications.map((app) => (
                  <option key={app.id || app.configKey} value={app.id || app.configKey} className="bg-slate-900 text-white">
                    {app.appName || app.name || app.organisationName}
                  </option>
                ))}
              </select>
            </div>

            {/* Incharges Navigation */}
            {onNavigateToIncharges && (
              <button
                onClick={() => onNavigateToIncharges(selectedAppId)}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                <span>Assign Incharges</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Close Button */}
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Dynamic Hierarchy Visual Strip */}
        <div className="bg-slate-900 border-b border-slate-800 px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 overflow-x-auto py-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              Scope:
            </span>
            <span className="px-2.5 py-1 rounded-lg text-[11px] font-black uppercase tracking-wider bg-amber-400/10 text-amber-400 border border-amber-400/20">
              {appConfig?.appScope || 'PARLIAMENT_MP'}
            </span>

            <span className="text-slate-600 font-bold mx-1">|</span>

            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Hierarchy:
            </span>
            <div className="flex items-center gap-1.5 overflow-x-auto text-[11px] font-medium text-slate-300">
              {hierarchyLevels.map((lvl, idx) => (
                <React.Fragment key={lvl}>
                  <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 font-semibold text-slate-300 whitespace-nowrap">
                    {hierarchyLabels[lvl] || lvl}
                  </span>
                  {idx < hierarchyLevels.length - 1 && (
                    <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('list')}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer ${
                activeTab === 'list'
                  ? 'bg-amber-400 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Constituency List
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'history'
                  ? 'bg-amber-400 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              Import History
            </button>
          </div>
        </div>

        {/* Tab 1: Assembly / Constituency Table (List Mode) */}
        {activeTab === 'list' && (
          <div className="p-6 space-y-5">
            {/* Cascading Target Scope Selectors */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Target Filter:
                </span>
                <select
                  value={selectedParliamentId}
                  onChange={(e) => setSelectedParliamentId(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  <option value="ALL">All Parliaments</option>
                  {Array.from(new Set(constituencies.map((c) => c.parliamentName))).map((pName) => (
                    <option key={pName} value={constituencies.find((c) => c.parliamentName === pName)?.id}>
                      {pName}
                    </option>
                  ))}
                </select>

                <select
                  value={acStatusFilter}
                  onChange={(e: any) => setAcStatusFilter(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="SUCCESS">Success</option>
                  <option value="PARTIAL_SUCCESS">Partial Success</option>
                  <option value="PENDING">Pending (No Data)</option>
                  <option value="FAILED">Failed</option>
                </select>
              </div>

              {/* Search */}
              <div className="relative w-full md:w-72">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search Assembly / Constituency..."
                  value={acSearch}
                  onChange={(e) => setAcSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            </div>

            {/* Constituencies Table */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-4 w-12 text-center">S.No</th>
                      <th className="py-3 px-4">Assembly / Constituency</th>
                      <th className="py-3 px-4">Parliament</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Mandals</th>
                      <th className="py-3 px-4 text-right">Booths</th>
                      <th className="py-3 px-4 text-right">Voters</th>
                      <th className="py-3 px-4">Last Imported</th>
                      <th className="py-3 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {loadingConstituencies ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-slate-400">
                          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-500" />
                          Loading Assembly Constituencies...
                        </td>
                      </tr>
                    ) : filteredConstituencies.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-slate-400">
                          No Assembly Constituencies match the selected filters.
                        </td>
                      </tr>
                    ) : (
                      filteredConstituencies.map((ac, idx) => (
                        <tr key={ac.id} className="hover:bg-amber-50/40 transition">
                          <td className="py-3.5 px-4 text-center text-slate-400 font-bold">{idx + 1}</td>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900">{ac.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{ac.code}</div>
                          </td>
                          <td className="py-3.5 px-4 text-slate-600">{ac.parliamentName}</td>
                          <td className="py-3.5 px-4 text-center">
                            {ac.importStatus === 'SUCCESS' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800">
                                <CheckCircle2 className="w-3 h-3" /> Success
                              </span>
                            ) : ac.importStatus === 'PARTIAL_SUCCESS' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800">
                                <AlertTriangle className="w-3 h-3" /> Partial
                              </span>
                            ) : ac.importStatus === 'FAILED' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800">
                                <XCircle className="w-3 h-3" /> Failed
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-600">
                                <Clock className="w-3 h-3" /> Pending
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-slate-700">{ac.mandalsCount}</td>
                          <td className="py-3.5 px-4 text-right font-mono text-slate-700">{ac.boothsCount}</td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                            {ac.importedRecords > 0 ? ac.importedRecords.toLocaleString() : '—'}
                          </td>
                          <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                            {ac.lastImported ? new Date(ac.lastImported).toLocaleDateString() : 'Never'}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <button
                              onClick={() => handleOpenUploadForTarget(ac)}
                              className="px-3.5 py-1.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-sm transition active:scale-95 cursor-pointer flex items-center gap-1.5 mx-auto"
                            >
                              <Upload className="w-3.5 h-3.5" />
                              <span>Upload Data</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Import History */}
        {activeTab === 'history' && (
          <div className="p-6 space-y-5">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Filter:</span>
                <select
                  value={historyStatusFilter}
                  onChange={(e) => setHistoryStatusFilter(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 shadow-sm focus:outline-none"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="SUCCESS">Success</option>
                  <option value="PARTIAL_SUCCESS">Partial Success</option>
                  <option value="FAILED">Failed</option>
                  <option value="PROCESSING">Processing</option>
                </select>

                <select
                  value={historyConstituencyFilter}
                  onChange={(e) => setHistoryConstituencyFilter(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 shadow-sm focus:outline-none"
                >
                  <option value="ALL">All Constituencies</option>
                  {constituencies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => loadHistory(1)}
                className="px-3 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? 'animate-spin' : ''}`} />
                Refresh History
              </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-4">Import ID</th>
                      <th className="py-3 px-4">Constituency</th>
                      <th className="py-3 px-4">File Name</th>
                      <th className="py-3 px-4">Uploaded By</th>
                      <th className="py-3 px-4">Upload Date</th>
                      <th className="py-3 px-4 text-right">Total</th>
                      <th className="py-3 px-4 text-right">Imported</th>
                      <th className="py-3 px-4 text-right">Failed</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {loadingHistory ? (
                      <tr>
                        <td colSpan={10} className="py-12 text-center text-slate-400">
                          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-500" />
                          Loading Import History...
                        </td>
                      </tr>
                    ) : historyItems.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-12 text-center text-slate-400">
                          No import history records found.
                        </td>
                      </tr>
                    ) : (
                      historyItems.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50 transition">
                          <td className="py-3.5 px-4 font-mono text-[10px] text-slate-500">
                            {item.id.slice(0, 8)}...
                          </td>
                          <td className="py-3.5 px-4 font-bold text-slate-900">{item.constituencyName}</td>
                          <td className="py-3.5 px-4 text-slate-600 font-mono text-[11px] truncate max-w-[150px]">
                            {item.fileName}
                          </td>
                          <td className="py-3.5 px-4 text-slate-600">{item.uploadedBy}</td>
                          <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                            {new Date(item.createdAt).toLocaleString()}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-slate-700">{item.totalRecords}</td>
                          <td className="py-3.5 px-4 text-right font-mono text-emerald-600 font-bold">
                            {item.importedRecords}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-rose-600 font-bold">
                            {item.failedRecords}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                item.status === 'SUCCESS'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : item.status === 'PARTIAL_SUCCESS'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {item.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {item.failedRecords > 0 && (
                                <button
                                  onClick={async () => {
                                    setSelectedHistoryForErrors(item);
                                    setLoadingErrors(true);
                                    const errs = await fetchDataImportErrors(item.id);
                                    setHistoryErrors(errs);
                                    setLoadingErrors(false);
                                  }}
                                  className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                  title="View Errors"
                                >
                                  <AlertCircle className="w-4 h-4" />
                                </button>
                              )}
                              <a
                                href={`/api/applications/${selectedAppId}/data/imports/${item.id}/error-report`}
                                download
                                className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                                title="Download Error Report CSV"
                              >
                                <Download className="w-4 h-4" />
                              </a>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Upload Drawer / Modal Flow for Target Constituency */}
        {isUploadModalOpen && targetConstituency && (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
            <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden text-slate-900 flex flex-col my-auto max-h-[90vh]">
              {/* Modal Header */}
              <div className="bg-slate-950 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[10px] font-mono text-amber-400 uppercase font-bold tracking-widest">
                      TARGET ASSEMBLY INGESTION
                    </div>
                    <div className="text-base font-black text-white">
                      {targetConstituency.name} ({targetConstituency.parliamentName})
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setIsUploadModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Progress Steps Header */}
              <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 font-bold">
                  <span className={`px-2.5 py-1 rounded-lg ${uploadStep === 'upload' ? 'bg-amber-500 text-slate-950' : 'bg-slate-200 text-slate-600'}`}>
                    1. Upload & Validate
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  <span className={`px-2.5 py-1 rounded-lg ${uploadStep === 'mapping' ? 'bg-amber-500 text-slate-950' : 'bg-slate-200 text-slate-600'}`}>
                    2. Column Mapping
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  <span className={`px-2.5 py-1 rounded-lg ${uploadStep === 'preview' ? 'bg-amber-500 text-slate-950' : 'bg-slate-200 text-slate-600'}`}>
                    3. Preview & Import
                  </span>
                </div>

                <button
                  onClick={handleDownloadSampleExcel}
                  className="flex items-center gap-1.5 text-xs font-bold text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-xl transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Sample Excel
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-5 flex-1">
                {importError && (
                  <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs font-medium flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                    <span>{importError}</span>
                  </div>
                )}

                {/* STEP 1: Upload & Validate Only */}
                {uploadStep === 'upload' && (
                  <div className="space-y-6">
                    {/* Drag & Drop File Zone */}
                    <div className="border-2 border-dashed border-slate-300 hover:border-amber-500 rounded-3xl p-8 text-center transition cursor-pointer bg-slate-50/50 relative">
                      <input
                        type="file"
                        accept=".xlsx, .xls"
                        onChange={handleFileChange}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                      <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-3 shadow-inner">
                        <FileSpreadsheet className="w-7 h-7" />
                      </div>
                      <div className="text-sm font-bold text-slate-900 mb-1">
                        {file ? file.name : 'Click or Drag Excel file to upload'}
                      </div>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto">
                        Supports <span className="font-semibold text-slate-700">.xlsx</span> and{' '}
                        <span className="font-semibold text-slate-700">.xls</span> formats. File will be validated before final ingestion.
                      </p>
                      {file && (
                        <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                          <Check className="w-3.5 h-3.5" /> {(file.size / 1024).toFixed(1)} KB loaded ({rawRows.length} rows)
                        </div>
                      )}
                    </div>

                    {/* Validate Only Trigger */}
                    {file && rawRows.length > 0 && (
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-slate-100 rounded-2xl border border-slate-200">
                        <div>
                          <div className="text-xs font-bold text-slate-800">Pre-flight Data Validation</div>
                          <div className="text-[11px] text-slate-500">
                            Inspect rows, detect duplicates, and verify hierarchy alignment without modifying database.
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleValidateOnly}
                            disabled={validating}
                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <ShieldCheck className="w-4 h-4 text-amber-400" />
                            <span>{validating ? 'Validating...' : 'Validate Only'}</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Validation Report Card */}
                    {validationReport && (
                      <div className="space-y-4 border border-slate-200 rounded-2xl p-4 bg-white shadow-sm">
                        <div className="flex items-center justify-between">
                          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            Validation Summary
                          </div>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                              validationReport.invalidRows === 0
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {validationReport.invalidRows === 0 ? 'All Rows Valid' : `${validationReport.invalidRows} Issues Found`}
                          </span>
                        </div>

                        {/* Summary Metrics */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                            <div className="text-xl font-black text-slate-900">{validationReport.totalRows}</div>
                            <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Total Rows</div>
                          </div>
                          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-center">
                            <div className="text-xl font-black text-emerald-700">{validationReport.validRows}</div>
                            <div className="text-[10px] uppercase tracking-wider font-bold text-emerald-600">Valid</div>
                          </div>
                          <div className="p-3 bg-rose-50 rounded-xl border border-rose-100 text-center">
                            <div className="text-xl font-black text-rose-700">{validationReport.invalidRows}</div>
                            <div className="text-[10px] uppercase tracking-wider font-bold text-rose-600">Invalid</div>
                          </div>
                          <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-center">
                            <div className="text-xl font-black text-amber-700">{validationReport.duplicateCount}</div>
                            <div className="text-[10px] uppercase tracking-wider font-bold text-amber-600">Duplicates</div>
                          </div>
                        </div>

                        {/* Validation Errors List Table */}
                        {validationReport.errors.length > 0 && (
                          <div className="space-y-2 pt-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-700">Error Inspection Table:</span>
                              <button
                                onClick={() => handleDownloadErrors(validationReport.errors, 'validation_errors.csv')}
                                className="text-[11px] font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1 cursor-pointer"
                              >
                                <Download className="w-3 h-3" /> Download CSV
                              </button>
                            </div>
                            <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl">
                              <table className="w-full text-left text-[11px]">
                                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold sticky top-0">
                                  <tr>
                                    <th className="py-2 px-3 w-16">Row</th>
                                    <th className="py-2 px-3">Field</th>
                                    <th className="py-2 px-3">Error Message</th>
                                    <th className="py-2 px-3">Suggestion</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium">
                                  {validationReport.errors.map((err, i) => (
                                    <tr key={i} className="hover:bg-rose-50/30">
                                      <td className="py-2 px-3 font-mono font-bold text-slate-500">#{err.rowNumber}</td>
                                      <td className="py-2 px-3 font-semibold text-slate-800">{err.field}</td>
                                      <td className="py-2 px-3 text-rose-700 font-bold">{err.message}</td>
                                      <td className="py-2 px-3 text-slate-500">{err.suggestion}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* STEP 2: Column Mapping Interface */}
                {uploadStep === 'mapping' && (
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs">
                      <div>
                        <span className="font-bold">Column Mapping:</span> Map Excel spreadsheet columns on the left to official platform fields on the right.
                      </div>
                      {unmappedRequiredFields.length > 0 && (
                        <span className="px-2 py-0.5 rounded bg-rose-200 text-rose-900 font-bold text-[10px]">
                          {unmappedRequiredFields.length} Required Fields Unmapped
                        </span>
                      )}
                    </div>

                    <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-96 overflow-y-auto shadow-sm">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] sticky top-0">
                          <tr>
                            <th className="py-3 px-4">Excel Column Header</th>
                            <th className="py-3 px-4">Sample Row Data</th>
                            <th className="py-3 px-4 w-64">System Field</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium">
                          {fileHeaders.map((header) => {
                            const currentTarget = columnMapping[header] || '';
                            const sampleVal = rawRows[0]?.[header];

                            return (
                              <tr key={header} className="hover:bg-slate-50">
                                <td className="py-3 px-4 font-bold text-slate-800">{header}</td>
                                <td className="py-3 px-4 text-slate-500 font-mono text-[11px] truncate max-w-xs">
                                  {sampleVal !== undefined && sampleVal !== '' ? String(sampleVal) : '—'}
                                </td>
                                <td className="py-3 px-4">
                                  <select
                                    value={currentTarget}
                                    onChange={(e) => {
                                      setColumnMapping((prev) => ({
                                        ...prev,
                                        [header]: e.target.value,
                                      }));
                                    }}
                                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                                  >
                                    <option value="">— Ignore this column —</option>
                                    {systemFieldsCatalog.map((sf) => (
                                      <option key={sf.key} value={sf.key}>
                                        {sf.label} {sf.required ? '*' : ''}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* STEP 3: Data Preview & Import Configuration */}
                {uploadStep === 'preview' && (
                  <div className="space-y-5">
                    {/* Mode & Configuration Selection */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Import Ingestion Mode:
                        </label>
                        <div className="flex items-center gap-3 mt-1.5">
                          <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                            <input
                              type="radio"
                              name="importMode"
                              value="APPEND"
                              checked={importMode === 'APPEND'}
                              onChange={() => setImportMode('APPEND')}
                              className="text-amber-500 focus:ring-amber-400"
                            />
                            <span>Append Data (Keep existing)</span>
                          </label>
                          <label className="flex items-center gap-2 text-xs font-bold text-rose-700 cursor-pointer">
                            <input
                              type="radio"
                              name="importMode"
                              value="REPLACE"
                              checked={importMode === 'REPLACE'}
                              onChange={() => setImportMode('REPLACE')}
                              className="text-rose-600 focus:ring-rose-500"
                            />
                            <span>Replace Data (Wipe AC voters first)</span>
                          </label>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Cluster Size (Voters per 100-Group):
                        </label>
                        <select
                          value={clusterSize}
                          onChange={(e) => setClusterSize(parseInt(e.target.value, 10))}
                          className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 shadow-sm focus:outline-none"
                        >
                          <option value={50}>50 Voters</option>
                          <option value={100}>100 Voters (Standard)</option>
                          <option value={150}>150 Voters</option>
                          <option value={200}>200 Voters</option>
                        </select>
                      </div>
                    </div>

                    {/* Preview Table of First 50 Mapped Records */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700">
                          Data Preview (First {Math.min(50, rawRows.length)} Records):
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium">
                          Total {rawRows.length} records ready to import into {targetConstituency.name}
                        </span>
                      </div>

                      <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-64 overflow-y-auto shadow-sm">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] sticky top-0">
                            <tr>
                              <th className="py-2.5 px-3">#</th>
                              <th className="py-2.5 px-3">EPIC Number</th>
                              <th className="py-2.5 px-3">Full Name</th>
                              <th className="py-2.5 px-3">Age / Gender</th>
                              <th className="py-2.5 px-3">Mandal</th>
                              <th className="py-2.5 px-3">Village</th>
                              <th className="py-2.5 px-3">Booth</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-medium text-[11px]">
                            {rawRows.slice(0, 50).map((row, idx) => {
                              const epic = row[Object.keys(columnMapping).find((k) => columnMapping[k] === 'epicNumber') || ''] || row.epicNumber || row['Voter ID'] || '—';
                              const name = row[Object.keys(columnMapping).find((k) => columnMapping[k] === 'fullName') || ''] || row.fullName || row['Voter Name'] || '—';
                              const age = row[Object.keys(columnMapping).find((k) => columnMapping[k] === 'age') || ''] || row.age || '—';
                              const gender = row[Object.keys(columnMapping).find((k) => columnMapping[k] === 'gender') || ''] || row.gender || '—';
                              const mandal = row[Object.keys(columnMapping).find((k) => columnMapping[k] === 'mandal') || ''] || row.mandal || '—';
                              const village = row[Object.keys(columnMapping).find((k) => columnMapping[k] === 'village') || ''] || row.village || '—';
                              const booth = row[Object.keys(columnMapping).find((k) => columnMapping[k] === 'boothNumber') || ''] || row.boothNumber || '—';

                              return (
                                <tr key={idx} className="hover:bg-slate-50">
                                  <td className="py-2 px-3 text-slate-400 font-bold">{idx + 1}</td>
                                  <td className="py-2 px-3 font-mono font-bold text-slate-800">{epic}</td>
                                  <td className="py-2 px-3 font-semibold text-slate-900">{name}</td>
                                  <td className="py-2 px-3 text-slate-600">{age} / {gender}</td>
                                  <td className="py-2 px-3 text-slate-600">{mandal}</td>
                                  <td className="py-2 px-3 text-slate-600">{village}</td>
                                  <td className="py-2 px-3 font-mono font-bold text-amber-700">{booth}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 4: Importing Live Progress */}
                {uploadStep === 'importing' && (
                  <div className="py-12 px-6 text-center space-y-5">
                    <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto shadow-inner animate-pulse">
                      <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-base font-black text-slate-900">
                        Ingesting {rawRows.length.toLocaleString()} Records into {targetConstituency.name}
                      </h3>
                      <p className="text-xs text-slate-500">
                        Automatically mapping Mandals, creating missing Booths, and grouping voters into 100-clusters...
                      </p>
                    </div>

                    <div className="w-full max-w-md mx-auto space-y-2">
                      <div className="w-full bg-slate-100 rounded-full h-3.5 overflow-hidden border border-slate-200">
                        <div
                          className="bg-gradient-to-r from-amber-400 to-amber-500 h-full rounded-full transition-all duration-300 shadow-sm"
                          style={{ width: `${importProgress}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[11px] font-bold text-slate-500">
                        <span>Progress</span>
                        <span>{importProgress}%</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 5: Final Import Summary */}
                {uploadStep === 'summary' && importSummary && (
                  <div className="space-y-6 text-center py-6">
                    <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-md">
                      <CheckCircle2 className="w-9 h-9" />
                    </div>
                    <div className="space-y-1.5">
                      <h3 className="text-lg font-black text-slate-900">
                        Import Completed Successfully!
                      </h3>
                      <p className="text-xs text-slate-500">
                        Voter roll and polling booths have been registered into the {targetConstituency.name} hierarchy.
                      </p>
                    </div>

                    {/* Summary KPI grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto">
                      <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-center">
                        <div className="text-2xl font-black text-slate-900">{importSummary.totalRows}</div>
                        <div className="text-[10px] font-bold uppercase text-slate-500">Total Rows</div>
                      </div>
                      <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 text-center">
                        <div className="text-2xl font-black text-emerald-700">{importSummary.successCount}</div>
                        <div className="text-[10px] font-bold uppercase text-emerald-600">Imported</div>
                      </div>
                      <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-center">
                        <div className="text-2xl font-black text-amber-700">{importSummary.boothsCount || 0}</div>
                        <div className="text-[10px] font-bold uppercase text-amber-600">Booths Mapped</div>
                      </div>
                      <div className="p-3 bg-blue-50 rounded-2xl border border-blue-200 text-center">
                        <div className="text-2xl font-black text-blue-700">{importSummary.voterGroupsCount || 0}</div>
                        <div className="text-[10px] font-bold uppercase text-blue-600">100-Groups</div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
                      <button
                        onClick={() => {
                          setIsUploadModalOpen(false);
                          setActiveTab('list');
                        }}
                        className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
                      >
                        Back to Constituencies
                      </button>
                      <button
                        onClick={() => {
                          setIsUploadModalOpen(false);
                          setActiveTab('history');
                        }}
                        className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl text-xs font-black transition shadow-sm cursor-pointer flex items-center gap-1.5"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        View in Import History
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer Navigation */}
              {uploadStep !== 'importing' && uploadStep !== 'summary' && (
                <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex items-center justify-between">
                  {uploadStep === 'upload' ? (
                    <button
                      onClick={() => setIsUploadModalOpen(false)}
                      className="px-4 py-2 border border-slate-300 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      Cancel
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        if (uploadStep === 'mapping') setUploadStep('upload');
                        if (uploadStep === 'preview') setUploadStep('mapping');
                      }}
                      className="px-4 py-2 border border-slate-300 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> Back
                    </button>
                  )}

                  <div className="flex items-center gap-3">
                    {uploadStep === 'upload' && (
                      <button
                        onClick={() => setUploadStep('mapping')}
                        disabled={!file || rawRows.length === 0}
                        className="px-5 py-2 bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-slate-950 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        <span>Configure Column Mapping</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {uploadStep === 'mapping' && (
                      <button
                        onClick={() => setUploadStep('preview')}
                        disabled={unmappedRequiredFields.length > 0}
                        className="px-5 py-2 bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-slate-950 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        <span>Preview Mapped Data</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {uploadStep === 'preview' && (
                      <button
                        onClick={() => {
                          if (importMode === 'REPLACE') {
                            setShowReplaceConfirm(true);
                          } else {
                            executeImport();
                          }
                        }}
                        className={`px-6 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-md ${
                          importMode === 'REPLACE'
                            ? 'bg-rose-600 hover:bg-rose-500 text-white'
                            : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                        }`}
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>{importMode === 'REPLACE' ? 'Replace Constituency Data' : 'Append & Import Data'}</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Replace Data Confirmation Dialog */}
        {showReplaceConfirm && (
          <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-3xl p-6 shadow-2xl border border-rose-200 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-inner">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <div className="space-y-2">
                <h3 className="text-base font-black text-slate-900">
                  Confirm Data Replacement
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  You are about to <span className="font-bold text-rose-600">REPLACE</span> existing voter data for{' '}
                  <span className="font-bold text-slate-900">{targetConstituency?.name}</span>. Existing voter records in this constituency will be cleared and replaced with this spreadsheet.
                </p>
                <div className="p-3 bg-rose-50 rounded-xl text-[11px] text-rose-800 font-medium">
                  Note: Other constituencies and application configurations are strictly protected and will not be affected.
                </div>
              </div>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => setShowReplaceConfirm(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowReplaceConfirm(false);
                    executeImport();
                  }}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black shadow-md cursor-pointer"
                >
                  Yes, Replace Data
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Error Detail Modal from History */}
        {selectedHistoryForErrors && (
          <div className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="max-w-3xl w-full bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[85vh] flex flex-col">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-rose-600" />
                  <h3 className="text-sm font-black text-slate-900">
                    Import Failure Logs ({selectedHistoryForErrors.constituencyName})
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedHistoryForErrors(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-800 rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="overflow-y-auto flex-1 border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold sticky top-0">
                    <tr>
                      <th className="py-2 px-3 w-16">Row</th>
                      <th className="py-2 px-3">Field</th>
                      <th className="py-2 px-3">Value</th>
                      <th className="py-2 px-3">Error</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {loadingErrors ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-400">
                          Loading error details...
                        </td>
                      </tr>
                    ) : historyErrors.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-400">
                          No specific row errors recorded.
                        </td>
                      </tr>
                    ) : (
                      historyErrors.map((err, i) => (
                        <tr key={i} className="hover:bg-rose-50/20 text-[11px]">
                          <td className="py-2 px-3 font-mono font-bold text-slate-500">#{err.rowNumber || err.row}</td>
                          <td className="py-2 px-3 text-slate-700 font-semibold">{err.field || 'General'}</td>
                          <td className="py-2 px-3 font-mono text-slate-500">{err.value || '—'}</td>
                          <td className="py-2 px-3 text-rose-700 font-bold">{err.errorMessage || err.error}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setSelectedHistoryForErrors(null)}
                  className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
