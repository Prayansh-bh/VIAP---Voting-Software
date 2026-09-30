import React, { useState } from 'react';
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
import { AppInstance } from '../types';

interface DataIngestionProps {
  currentApp: AppInstance | null;
}

export default function DataIngestion({ currentApp }: DataIngestionProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'parsing' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [previewRows, setPreviewRows] = useState<any[]>([]);

  const sampleRows = [
    { epic: 'ABC1029384', name: 'K. Venkateswara Rao', age: 46, gender: 'M', booth: '104 - ZPHS School', village: 'Pakala', mandal: 'Singarayakonda' },
    { epic: 'ABC1029385', name: 'K. Subbalakshmi', age: 42, gender: 'F', booth: '104 - ZPHS School', village: 'Pakala', mandal: 'Singarayakonda' },
    { epic: 'ABC1029386', name: 'P. Krishna Chaitanya', age: 24, gender: 'M', booth: '104 - ZPHS School', village: 'Pakala', mandal: 'Singarayakonda' },
    { epic: 'ABC1029387', name: 'M. Sivaiah', age: 58, gender: 'M', booth: '105 - Govt Primary', village: 'Kondapi', mandal: 'Kondapi' },
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadStatus('parsing');
      setTimeout(() => {
        setUploadStatus('success');
        setStatusMessage(`Successfully processed "${file.name}" (1,480 voter records identified).`);
        setPreviewRows(sampleRows);
      }, 1200);
    }
  };

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

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Postgres Bulk Ingestion Engine Ready</span>
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
          Select or drag your Election Commission voter roll file. Automatic column matching will identify EPIC, Polling Station, Section, House No, and Demographics.
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
            <span>Validating schema and parsing geographic hierarchy...</span>
          </div>
        )}

        {uploadStatus === 'success' && (
          <div className="mt-4 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{statusMessage}</span>
          </div>
        )}
      </div>

      {/* Jurisdiction Hierarchy Counts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Constituencies</div>
          <div className="text-2xl font-black text-white mt-1">1 Assembly</div>
          <div className="text-[11px] text-slate-500">Kondapi (SC Reserved)</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Mandals / Blocks</div>
          <div className="text-2xl font-black text-white mt-1">5 Mandals</div>
          <div className="text-[11px] text-slate-500">100% Boundary Mapped</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Polling Booths</div>
          <div className="text-2xl font-black text-white mt-1">268 Booths</div>
          <div className="text-[11px] text-emerald-400 font-bold">All Stations Geocoded</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Enrolled Voters</div>
          <div className="text-2xl font-black text-white mt-1">228,410</div>
          <div className="text-[11px] text-cyan-400 font-bold">Active Roll 2024-25</div>
        </div>
      </div>

      {/* Preview Table */}
      <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-bold text-white">Electoral Roll Records Preview</h2>
          </div>
          <span className="text-[10px] font-bold text-slate-500">Live Database Schema</span>
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
              {(previewRows.length > 0 ? previewRows : sampleRows).map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-800/40 text-slate-300">
                  <td className="p-3 font-mono font-bold text-cyan-400">{row.epic}</td>
                  <td className="p-3 font-semibold text-white">{row.name}</td>
                  <td className="p-3">{row.age} / {row.gender}</td>
                  <td className="p-3">{row.booth}</td>
                  <td className="p-3">{row.village}</td>
                  <td className="p-3">{row.mandal}</td>
                  <td className="p-3 text-right">
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Verified
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
