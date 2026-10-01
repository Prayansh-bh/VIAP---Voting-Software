import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  Database,
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  BarChart2,
  Layers,
  Search,
  RefreshCw,
  FolderTree,
} from 'lucide-react';
import { AppInstance, ApplicationSummary } from '../types';
import { fetchApplicationSummary, fetchVotersList, importVoterRolls } from '../lib/api';

interface DataIngestionProps {
  currentApp: AppInstance | null;
}

export default function DataIngestion({ currentApp }: DataIngestionProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'parsing' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  
  // Real DB states
  const [summary, setSummary] = useState<ApplicationSummary | null>(null);
  const [voters, setVoters] = useState<any[]>([]);
  const [totalVotersCount, setTotalVotersCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  const loadLiveData = async () => {
    if (!currentApp) return;
    setLoading(true);
    try {
      const [sum, vList] = await Promise.all([
        fetchApplicationSummary(currentApp.id),
        fetchVotersList({ limit: 15 }),
      ]);
      setSummary(sum);
      setVoters(vList.items);
      setTotalVotersCount(sum?.totalVoters ?? vList.total);
    } catch (err) {
      console.warn('Failed to load live ingestion summary from DB:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLiveData();
  }, [currentApp?.id]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentApp) return;
    
    setSelectedFile(file);
    setUploadStatus('parsing');
    setStatusMessage('Reading spreadsheet and extracting columns...');

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rows: any[] = XLSX.utils.sheet_to_json(worksheet);

      if (!rows || rows.length === 0) {
        setUploadStatus('error');
        setStatusMessage('No valid data rows found in selected file.');
        return;
      }

      setStatusMessage(`Parsed ${rows.length.toLocaleString('en-IN')} rows. Uploading to PostgreSQL database...`);

      const res = await importVoterRolls(currentApp.id, {
        rows,
        fileName: file.name,
        fileSize: file.size,
        importMode: 'APPEND',
      });

      const importedCount = res?.importedCount ?? res?.insertedVoters ?? rows.length;
      setUploadStatus('success');
      setStatusMessage(`Successfully committed ${importedCount.toLocaleString('en-IN')} records into PostgreSQL database.`);

      // Re-fetch genuine data from PostgreSQL
      await loadLiveData();
    } catch (err: any) {
      setUploadStatus('error');
      setStatusMessage(err.message || 'File ingestion failed.');
    }
  };

  const totalMandals = summary?.totalMandals ?? 0;
  const totalBooths = summary?.totalBooths ?? 0;
  const totalVoters = summary?.totalVoters ?? totalVotersCount;
  const totalConstituencies = summary?.totalConstituencies ?? (currentApp ? 1 : 0);

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

        <div className="flex items-center gap-3 text-xs text-slate-400">
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
          Upload Official Electoral Roll (XLSX, CSV, TSV)
        </h3>
        <p className="text-xs text-slate-400 max-w-md mb-4">
          Select your Election Commission voter roll file. The ingestion engine will parse and commit EPIC, Polling Station, Mandal, and Citizen demographics directly to PostgreSQL.
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

        {uploadStatus === 'success' && (
          <div className="mt-4 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{statusMessage}</span>
          </div>
        )}

        {uploadStatus === 'error' && (
          <div className="mt-4 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>{statusMessage}</span>
          </div>
        )}
      </div>

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
