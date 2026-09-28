import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  UserPlus,
  ShieldCheck,
  Search,
  Filter,
  CheckCircle2,
  Trash2,
  RefreshCw,
  MapPin,
  Layers,
  Building,
  Crown,
  Home,
  Vote,
  ArrowRight,
  AlertCircle,
  Phone,
  Mail,
  UserCheck,
} from 'lucide-react';
import {
  fetchCmsApplications,
  fetchApplicationHierarchy,
  fetchHierarchyNodes,
  fetchApplicationIncharges,
  assignApplicationIncharge,
  deleteApplicationIncharge,
  ApplicationHierarchy,
  InchargeRecord,
} from '../../lib/api/applications.api';
import { useCms } from '../../context/CmsContext';

interface AssignInchargesModuleProps {
  initialAppId?: string;
  onNavigateToData?: (appId: string) => void;
  onClose?: () => void;
}

export default function AssignInchargesModule({
  initialAppId,
  onNavigateToData,
  onClose,
}: AssignInchargesModuleProps) {
  const { config } = useCms();

  // Application selection
  const [applications, setApplications] = useState<any[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<string>(initialAppId || 'default');
  const [appHierarchy, setAppHierarchy] = useState<ApplicationHierarchy | null>(null);
  const [loadingHierarchy, setLoadingHierarchy] = useState(false);

  // Incharge Form States
  const [targetLevel, setTargetLevel] = useState<string>('BOOTH');
  const [selectedStateId, setSelectedStateId] = useState<string>('');
  const [selectedZoneId, setSelectedZoneId] = useState<string>('');
  const [selectedParliamentId, setSelectedParliamentId] = useState<string>('');
  const [selectedConstituencyId, setSelectedConstituencyId] = useState<string>('');
  const [selectedMandalId, setSelectedMandalId] = useState<string>('');
  const [selectedVillageId, setSelectedVillageId] = useState<string>('');
  const [selectedBoothId, setSelectedBoothId] = useState<string>('');
  const [selectedVoterGroupId, setSelectedVoterGroupId] = useState<string>('');

  // Dropdown options
  const [states, setStates] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  const [parliaments, setParliaments] = useState<any[]>([]);
  const [constituencies, setConstituencies] = useState<any[]>([]);
  const [mandals, setMandals] = useState<any[]>([]);
  const [villages, setVillages] = useState<any[]>([]);
  const [booths, setBooths] = useState<any[]>([]);
  const [voterGroups, setVoterGroups] = useState<any[]>([]);

  // User details for assignment
  const [inchargeName, setInchargeName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [email, setEmail] = useState('');
  const [assignmentReason, setAssignmentReason] = useState('Appointed via CMS Incharge Assignment');

  // Submitting state & feedback
  const [submitting, setSubmitting] = useState(false);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Incharges List
  const [incharges, setIncharges] = useState<InchargeRecord[]>([]);
  const [loadingIncharges, setLoadingIncharges] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('ALL');

  // 1. Load CMS applications on mount
  useEffect(() => {
    async function loadApps() {
      try {
        const apps = await fetchCmsApplications();
        setApplications(apps);
        if (apps.length > 0 && selectedAppId === 'default') {
          setSelectedAppId(apps[0].id || apps[0].configKey || 'default');
        }
      } catch (err) {
        console.error('Failed to load apps:', err);
      }
    }
    loadApps();
  }, []);

  // 2. Load hierarchy and incharges when selectedAppId changes
  useEffect(() => {
    if (selectedAppId) {
      loadHierarchy(selectedAppId);
      loadIncharges(selectedAppId);
    }
  }, [selectedAppId]);

  const loadHierarchy = async (appId: string) => {
    setLoadingHierarchy(true);
    try {
      const data = await fetchApplicationHierarchy(appId);
      setAppHierarchy(data);

      // Load top-level states
      const stateList = await fetchHierarchyNodes(appId, 'STATE');
      setStates(stateList);
      if (stateList.length > 0) {
        setSelectedStateId(stateList[0].id);
      }

      // Load constituencies
      const constList = await fetchHierarchyNodes(appId, 'CONSTITUENCY');
      setConstituencies(constList);
      if (constList.length > 0) {
        setSelectedConstituencyId(constList[0].id);
      }
    } catch (err) {
      console.error('Failed to load hierarchy:', err);
    } finally {
      setLoadingHierarchy(false);
    }
  };

  const loadIncharges = async (appId: string) => {
    setLoadingIncharges(true);
    try {
      const list = await fetchApplicationIncharges(appId);
      setIncharges(list);
    } catch (err) {
      console.error('Failed to load incharges:', err);
    } finally {
      setLoadingIncharges(false);
    }
  };

  // 3. Cascading Dropdown Handlers
  // When State changes -> load Zones
  useEffect(() => {
    if (selectedStateId && selectedAppId) {
      fetchHierarchyNodes(selectedAppId, 'ZONE', selectedStateId).then((z) => {
        setZones(z);
        if (z.length > 0) setSelectedZoneId(z[0].id);
        else setSelectedZoneId('');
      });
    }
  }, [selectedStateId, selectedAppId]);

  // When Zone changes -> load Parliaments
  useEffect(() => {
    if (selectedZoneId && selectedAppId) {
      fetchHierarchyNodes(selectedAppId, 'PARLIAMENT', selectedZoneId).then((p) => {
        setParliaments(p);
        if (p.length > 0) setSelectedParliamentId(p[0].id);
        else setSelectedParliamentId('');
      });
    }
  }, [selectedZoneId, selectedAppId]);

  // When Constituency changes -> load Mandals
  useEffect(() => {
    if (selectedConstituencyId && selectedAppId) {
      fetchHierarchyNodes(selectedAppId, 'MANDAL', selectedConstituencyId).then((m) => {
        setMandals(m);
        if (m.length > 0) setSelectedMandalId(m[0].id);
        else setSelectedMandalId('');
      });
    }
  }, [selectedConstituencyId, selectedAppId]);

  // When Mandal changes -> load Villages
  useEffect(() => {
    if (selectedMandalId && selectedAppId) {
      fetchHierarchyNodes(selectedAppId, 'VILLAGE', selectedMandalId).then((v) => {
        setVillages(v);
        if (v.length > 0) setSelectedVillageId(v[0].id);
        else setSelectedVillageId('');
      });
    }
  }, [selectedMandalId, selectedAppId]);

  // When Village changes -> load Booths
  useEffect(() => {
    if (selectedVillageId && selectedAppId) {
      fetchHierarchyNodes(selectedAppId, 'BOOTH', selectedVillageId).then((b) => {
        setBooths(b);
        if (b.length > 0) setSelectedBoothId(b[0].id);
        else setSelectedBoothId('');
      });
    }
  }, [selectedVillageId, selectedAppId]);

  // When Booth changes -> load 100-Voter Groups
  useEffect(() => {
    if (selectedBoothId && selectedAppId) {
      fetchHierarchyNodes(selectedAppId, 'VOTER_GROUP', selectedBoothId).then((g) => {
        setVoterGroups(g);
        if (g.length > 0) setSelectedVoterGroupId(g[0].id);
        else setSelectedVoterGroupId('');
      });
    }
  }, [selectedBoothId, selectedAppId]);

  // Incharge Levels available for this application
  const availableLevels = useMemo(() => {
    const active = appHierarchy?.activeHierarchyLevels || [
      'CONSTITUENCY',
      'MANDAL',
      'VILLAGE',
      'BOOTH',
      'VOTER_GROUP',
    ];
    const labels = appHierarchy?.hierarchyLabels || {
      STATE: 'State Incharge',
      ZONE: 'Zone Coordinator',
      PARLIAMENT: 'Parliament Incharge',
      CONSTITUENCY: 'Constituency Incharge',
      MANDAL: 'Mandal President',
      VILLAGE: 'Village Incharge',
      BOOTH: 'Booth President',
      VOTER_GROUP: '100-Voter Incharge',
    };

    const definitions = [
      { key: 'STATE', label: labels.STATE || 'State Incharge', role: 'STATE_ADMIN', icon: Building },
      { key: 'ZONE', label: labels.ZONE || 'Zone Coordinator', role: 'ZONE_INCHARGE', icon: Building },
      { key: 'PARLIAMENT', label: labels.PARLIAMENT || 'Parliament Incharge', role: 'PARLIAMENT_INCHARGE', icon: Crown },
      { key: 'CONSTITUENCY', label: labels.CONSTITUENCY || 'Constituency Incharge', role: 'CONSTITUENCY_INCHARGE', icon: Crown },
      { key: 'MANDAL', label: labels.MANDAL || 'Mandal President', role: 'MANDAL_INCHARGE', icon: Layers },
      { key: 'VILLAGE', label: labels.VILLAGE || 'Village Incharge', role: 'VILLAGE_INCHARGE', icon: Home },
      { key: 'BOOTH', label: labels.BOOTH || 'Booth President', role: 'BOOTH_PRESIDENT', icon: Vote },
      { key: 'VOTER_GROUP', label: labels.VOTER_GROUP || '100-Voter Incharge', role: 'VOTER_100_INCHARGE', icon: Users },
    ];

    return definitions.filter((d) => active.includes(d.key));
  }, [appHierarchy]);

  // Resolve target unitId based on targetLevel
  const resolveTargetUnitId = () => {
    switch (targetLevel) {
      case 'STATE':
        return selectedStateId;
      case 'ZONE':
        return selectedZoneId;
      case 'PARLIAMENT':
        return selectedParliamentId;
      case 'CONSTITUENCY':
        return selectedConstituencyId;
      case 'MANDAL':
        return selectedMandalId;
      case 'VILLAGE':
        return selectedVillageId;
      case 'BOOTH':
        return selectedBoothId;
      case 'VOTER_GROUP':
        return selectedVoterGroupId;
      default:
        return '';
    }
  };

  // Map level to RoleType
  const resolveRoleType = () => {
    const matched = availableLevels.find((l) => l.key === targetLevel);
    return matched ? matched.role : 'BOOTH_PRESIDENT';
  };

  // Submit incharge assignment
  const handleAssignIncharge = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSuccess(null);
    setFormError(null);

    const unitId = resolveTargetUnitId();
    if (!unitId) {
      setFormError(`Please select a valid ${targetLevel} jurisdiction from the dropdowns.`);
      return;
    }

    if (!inchargeName.trim() || !mobileNumber.trim()) {
      setFormError('Incharge Full Name and 10-digit Mobile Number are required.');
      return;
    }

    setSubmitting(true);
    try {
      await assignApplicationIncharge(selectedAppId, {
        name: inchargeName.trim(),
        mobileNumber: mobileNumber.trim(),
        email: email.trim() || undefined,
        role: resolveRoleType(),
        unitLevel: targetLevel,
        unitId,
        reason: assignmentReason,
      });

      setFormSuccess(`Successfully assigned ${inchargeName} as ${targetLevel} Incharge!`);
      setInchargeName('');
      setMobileNumber('');
      setEmail('');
      loadIncharges(selectedAppId);
    } catch (err: any) {
      setFormError(err.message || 'Failed to assign incharge');
    } finally {
      setSubmitting(false);
    }
  };

  // Revoke incharge
  const handleDeleteIncharge = async (inchargeId: string, name: string) => {
    if (!confirm(`Are you sure you want to revoke assignment for ${name}?`)) return;
    try {
      await deleteApplicationIncharge(selectedAppId, inchargeId);
      loadIncharges(selectedAppId);
    } catch (err: any) {
      alert(`Error revoking incharge: ${err.message}`);
    }
  };

  // Filtered incharges
  const filteredIncharges = useMemo(() => {
    return incharges.filter((inc) => {
      const matchLevel = levelFilter === 'ALL' || inc.jurisdictionType === levelFilter;
      const q = searchQuery.toLowerCase();
      const matchSearch =
        q === '' ||
        inc.userName.toLowerCase().includes(q) ||
        inc.mobileNumber.includes(q) ||
        inc.jurisdictionName.toLowerCase().includes(q) ||
        inc.inchargeType.toLowerCase().includes(q);
      return matchLevel && matchSearch;
    });
  }, [incharges, levelFilter, searchQuery]);

  return (
    <div id="assign-incharges-root" className="min-h-screen bg-slate-900/95 text-slate-100 p-3 sm:p-6 font-sans antialiased flex justify-center items-start">
      <div className="w-full max-w-7xl bg-slate-100 rounded-[28px] shadow-2xl border border-slate-300 overflow-hidden text-slate-900">
        {/* Header Ribbon */}
        <div className="bg-[#0F172A] text-white px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-slate-950 font-black shadow-md">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold uppercase tracking-widest text-amber-400">
                  CMS CADRE PROVISIONING
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-950">
                  PHASE 3
                </span>
              </div>
              <h1 className="text-lg font-black tracking-tight text-white">
                Assign Incharges & Jurisdiction Governance
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-1.5 flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Application:
              </span>
              <select
                value={selectedAppId}
                onChange={(e) => setSelectedAppId(e.target.value)}
                className="bg-transparent text-amber-400 font-black text-xs focus:outline-none cursor-pointer"
              >
                {applications.map((app) => (
                  <option
                    key={app.id || app.configKey}
                    value={app.id || app.configKey}
                    className="bg-slate-900 text-white"
                  >
                    {app.appName || app.name || app.organisationName}
                  </option>
                ))}
              </select>
            </div>

            {onNavigateToData && (
              <button
                onClick={() => onNavigateToData(selectedAppId)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Assign Data First
              </button>
            )}

            {onClose && (
              <button
                onClick={onClose}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Close
              </button>
            )}
          </div>
        </div>

        {/* Content Layout */}
        <div className="p-6 bg-slate-50 grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-6">
          {/* Left Panel: Assignment Form */}
          <div className="space-y-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
                <UserPlus className="w-5 h-5 text-amber-600" />
                <div>
                  <h3 className="text-sm font-black text-slate-900">Provision Incharge</h3>
                  <p className="text-[11px] text-slate-500">Bind cadre user to exact jurisdiction boundary</p>
                </div>
              </div>

              {formSuccess && (
                <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  {formSuccess}
                </div>
              )}

              {formError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  {formError}
                </div>
              )}

              <form onSubmit={handleAssignIncharge} className="space-y-3.5">
                {/* 1. Incharge Type */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Incharge Level / Role Type *
                  </label>
                  <select
                    value={targetLevel}
                    onChange={(e) => setTargetLevel(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-amber-500"
                  >
                    {availableLevels.map((lvl) => (
                      <option key={lvl.key} value={lvl.key}>
                        {lvl.label} ({lvl.key})
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Cascading Jurisdiction Selectors */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                    Cascading Jurisdiction Boundary
                  </span>

                  {/* State (if enabled) */}
                  {(appHierarchy?.activeHierarchyLevels?.includes('STATE') || targetLevel === 'STATE') && (
                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase">State</label>
                      <select
                        value={selectedStateId}
                        onChange={(e) => setSelectedStateId(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none"
                      >
                        {states.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Constituency */}
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase">
                      Assembly Constituency
                    </label>
                    <select
                      value={selectedConstituencyId}
                      onChange={(e) => setSelectedConstituencyId(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none"
                    >
                      {constituencies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Mandal (if target is MANDAL or deeper) */}
                  {['MANDAL', 'VILLAGE', 'BOOTH', 'VOTER_GROUP'].includes(targetLevel) && (
                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase">Mandal</label>
                      <select
                        value={selectedMandalId}
                        onChange={(e) => setSelectedMandalId(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none"
                      >
                        {mandals.length === 0 && <option value="">No mandals found</option>}
                        {mandals.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Village (if target is VILLAGE or deeper) */}
                  {['VILLAGE', 'BOOTH', 'VOTER_GROUP'].includes(targetLevel) && (
                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase">
                        Village / Ward
                      </label>
                      <select
                        value={selectedVillageId}
                        onChange={(e) => setSelectedVillageId(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none"
                      >
                        {villages.length === 0 && <option value="">No villages in this mandal</option>}
                        {villages.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Booth (if target is BOOTH or deeper) */}
                  {['BOOTH', 'VOTER_GROUP'].includes(targetLevel) && (
                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase">
                        Polling Booth
                      </label>
                      <select
                        value={selectedBoothId}
                        onChange={(e) => setSelectedBoothId(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none"
                      >
                        {booths.length === 0 && <option value="">No booths in this village</option>}
                        {booths.map((b) => (
                          <option key={b.id} value={b.id}>
                            Booth {b.boothNumber} - {b.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* 100-Voter Group (if target is VOTER_GROUP) */}
                  {targetLevel === 'VOTER_GROUP' && (
                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase">
                        100-Voter Cluster
                      </label>
                      <select
                        value={selectedVoterGroupId}
                        onChange={(e) => setSelectedVoterGroupId(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none"
                      >
                        {voterGroups.length === 0 && <option value="">No clusters in this booth</option>}
                        {voterGroups.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* 3. Incharge User Details */}
                <div className="space-y-2 pt-1">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                      Incharge Full Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Ramesh Naidu"
                      value={inchargeName}
                      onChange={(e) => setInchargeName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                      10-Digit Mobile Number *
                    </label>
                    <input
                      type="tel"
                      placeholder="e.g. 9876543210"
                      value={mobileNumber}
                      onChange={(e) => setMobileNumber(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                      Email Address (Optional)
                    </label>
                    <input
                      type="email"
                      placeholder="incharge@kondapi.app"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full mt-2 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> Provisioning Incharge...
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-4 h-4" /> Confirm & Assign Incharge
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Right Panel: Active Incharges Directory */}
          <div className="space-y-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    Active Incharges Directory ({filteredIncharges.length})
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Appointed leadership cadres across configured hierarchy levels
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => loadIncharges(selectedAppId)}
                    disabled={loadingIncharges}
                    className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 transition cursor-pointer"
                    title="Refresh List"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingIncharges ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Filters */}
              <div className="flex flex-col sm:flex-row items-center gap-2 mb-4">
                <div className="relative flex-1 w-full">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    placeholder="Search by name, mobile, or jurisdiction..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <select
                  value={levelFilter}
                  onChange={(e) => setLevelFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 focus:outline-none"
                >
                  <option value="ALL">All Levels</option>
                  <option value="STATE">State Incharges</option>
                  <option value="PARLIAMENT">Parliament Incharges</option>
                  <option value="CONSTITUENCY">Constituency Incharges</option>
                  <option value="MANDAL">Mandal Presidents</option>
                  <option value="VILLAGE">Village Incharges</option>
                  <option value="BOOTH">Booth Presidents</option>
                  <option value="VOTER_GROUP">100-Voter Incharges</option>
                </select>
              </div>

              {/* Table */}
              {loadingIncharges ? (
                <div className="p-12 text-center text-slate-400 text-xs font-bold flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-500" /> Loading incharge directory...
                </div>
              ) : filteredIncharges.length === 0 ? (
                <div className="p-12 text-center text-slate-500 text-xs bg-slate-50 rounded-2xl border border-slate-200">
                  No incharges found matching criteria. Use the form on the left to assign cadre.
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3">Incharge Name</th>
                        <th className="py-2.5 px-3">Role / Level</th>
                        <th className="py-2.5 px-3">Assigned Jurisdiction</th>
                        <th className="py-2.5 px-3">Parent Area</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Assigned Date</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {filteredIncharges.map((inc) => (
                        <tr key={inc.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-900">{inc.userName}</div>
                            <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
                              <Phone className="w-3 h-3 text-slate-400" />
                              {inc.mobileNumber}
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-800">
                              {inc.inchargeType}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-800 flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-amber-500 shrink-0" />
                              {inc.jurisdictionName}
                            </div>
                            <div className="text-[10px] text-slate-400 uppercase font-semibold">
                              {inc.jurisdictionType}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">{inc.parentJurisdiction}</td>
                          <td className="py-2.5 px-3">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> ACTIVE
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                            {new Date(inc.assignedAt).toLocaleDateString('en-IN')}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              onClick={() => handleDeleteIncharge(inc.id, inc.userName)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                              title="Revoke Incharge Assignment"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
