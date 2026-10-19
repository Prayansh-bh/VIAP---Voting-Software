import React, { useState, useEffect } from 'react';
import {
  Shield,
  User,
  Mail,
  Smartphone,
  Lock,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Save,
  Server,
  RefreshCw,
} from 'lucide-react';
import { AdminUser } from '../types';
import { fetchAdminProfile, updateAdminProfile, changeAdminPassword } from '../lib/api';
import { useNotification } from '../context/NotificationContext';
import { getAppUrl, getApiUrl } from '../lib/env';

interface AdminProfileSecurityProps {
  adminUser: AdminUser;
  onProfileUpdated?: (updated: AdminUser) => void;
}

export default function AdminProfileSecurity({
  adminUser,
  onProfileUpdated,
}: AdminProfileSecurityProps) {
  const { notify } = useNotification();

  // Profile fields state
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState<{
    name: string;
    email: string;
    mobileNumber: string;
    role: string;
    userCode: string;
    organisationName?: string;
  }>({
    name: adminUser.name || '',
    email: adminUser.email || '',
    mobileNumber: '',
    role: adminUser.role || 'SUPER_ADMIN',
    userCode: '',
    organisationName: '',
  });

  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState<string | null>(null);

  // Credential change state
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordSuccessMsg, setPasswordSuccessMsg] = useState<string | null>(null);
  const [passwordErrorMsg, setPasswordErrorMsg] = useState<string | null>(null);

  // Load authenticated profile live from backend
  const loadProfile = async () => {
    setLoading(true);
    try {
      const data = await fetchAdminProfile();
      if (data) {
        setProfileData({
          name: data.name || adminUser.name || '',
          email: data.email || adminUser.email || '',
          mobileNumber: data.mobileNumber || '',
          role: data.role || adminUser.role || 'SUPER_ADMIN',
          userCode: data.userCode || '',
          organisationName: data.organisation?.name || '',
        });
      }
    } catch (err: any) {
      console.warn('Could not fetch live admin profile:', err?.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, [adminUser.id]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileData.name.trim()) {
      notify.warning('Administrator name cannot be empty.', 'Validation Warning');
      return;
    }

    setSavingProfile(true);
    setProfileSuccessMsg(null);
    try {
      const updated = await updateAdminProfile({
        name: profileData.name.trim(),
        email: profileData.email.trim() || undefined,
      });

      setProfileSuccessMsg('Profile updated successfully in PostgreSQL.');
      notify.success('Platform administrator profile has been updated.', 'Profile Saved');

      if (onProfileUpdated) {
        onProfileUpdated({
          ...adminUser,
          name: updated.name || profileData.name,
          email: updated.email || profileData.email,
        });
      }

      setTimeout(() => setProfileSuccessMsg(null), 8000);
    } catch (err: any) {
      notify.error(err.message || 'Failed to update administrator profile.', 'Update Error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordErrorMsg(null);
    setPasswordSuccessMsg(null);

    if (!currentPassword) {
      setPasswordErrorMsg('Current password/passcode is required.');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordErrorMsg('New password must be at least 8 characters in length.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordErrorMsg('New password and confirmation do not match.');
      return;
    }

    if (newPassword === currentPassword) {
      setPasswordErrorMsg('New password cannot be identical to current password.');
      return;
    }

    setChangingPassword(true);
    try {
      const res = await changeAdminPassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });

      setPasswordSuccessMsg(res.message || 'Password changed successfully. Active credentials rotated.');
      notify.success('Security credential updated in PostgreSQL. Active sessions rotated.', 'Password Changed');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccessMsg(null), 8000);
    } catch (err: any) {
      const msg = err.message || 'Failed to change password. Please verify your current passcode.';
      setPasswordErrorMsg(msg);
      notify.error(msg, 'Credential Error');
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Platform Administrator Profile & Security</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Authoritative account governance, profile settings, and cryptographic credential management.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={loadProfile}
          disabled={loading}
          className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition flex items-center gap-2 cursor-pointer self-start sm:self-auto"
          title="Refresh profile data from PostgreSQL"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-400' : ''}`} />
          <span>Sync from PostgreSQL</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile Card */}
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-4 border-b border-slate-800 mb-5">
              <User className="w-5 h-5 text-amber-400" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Administrator Profile Information
              </h2>
            </div>

            {profileSuccessMsg && (
              <div className="p-3.5 mb-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{profileSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Full Administrator Name *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={profileData.name}
                    onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-amber-400 outline-none transition"
                    placeholder="e.g. State War Room Director"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Official Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={profileData.email}
                    onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-amber-400 outline-none transition"
                    placeholder="admin@politicalconnect.in"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Registered Mobile Number
                </label>
                <div className="relative">
                  <Smartphone className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    disabled
                    value={profileData.mobileNumber ? `+91 ${profileData.mobileNumber}` : 'Configured'}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-slate-400 text-xs cursor-not-allowed font-mono"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Protected credential. Changing mobile numbers requires the multi-factor OTP verification workflow.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800/80">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Platform Role</div>
                  <div className="text-xs font-black text-amber-400 mt-0.5">{profileData.role}</div>
                </div>
                <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800/80">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">User Code</div>
                  <div className="text-xs font-mono font-bold text-slate-300 mt-0.5">
                    {profileData.userCode || 'SYSTEM-ADMIN'}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end">
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs shadow-lg shadow-amber-400/20 transition disabled:opacity-50 cursor-pointer flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  <span>{savingProfile ? 'Saving Changes...' : 'Save Profile Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Credential & Password Management Card */}
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-4 border-b border-slate-800 mb-5">
              <KeyRound className="w-5 h-5 text-amber-400" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Credential & Security Passcode
              </h2>
            </div>

            {passwordSuccessMsg && (
              <div className="p-3.5 mb-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{passwordSuccessMsg}</span>
              </div>
            )}

            {passwordErrorMsg && (
              <div className="p-3.5 mb-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{passwordErrorMsg}</span>
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Current Password / Passcode *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-amber-400 outline-none transition font-mono"
                    placeholder="Enter current passcode"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                  >
                    {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  New Password / Passcode *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-amber-400 outline-none transition font-mono"
                    placeholder="Minimum 8 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Confirm New Password *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-amber-400 outline-none transition font-mono"
                    placeholder="Re-type new passcode"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <div className="font-bold text-slate-300">Security Architecture Policy:</div>
                <ul className="list-disc list-inside space-y-0.5 text-[10px] text-slate-500">
                  <li>Current passcode is checked via timing-safe bcrypt against PostgreSQL.</li>
                  <li>Hardcoded bypass passcodes have been eliminated across the platform.</li>
                  <li>Updating credentials will revoke all other active sessions for this account.</li>
                </ul>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end">
                <button
                  type="submit"
                  disabled={changingPassword}
                  className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs shadow-lg shadow-amber-400/20 transition disabled:opacity-50 cursor-pointer flex items-center gap-2"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>{changingPassword ? 'Verifying & Updating...' : 'Update Password & Rotate Session'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Preserved Platform Governance & Architecture System Information */}
      <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Server className="w-5 h-5 text-amber-400" />
          <span>Platform Governance & System Architecture</span>
        </h2>
        <p className="text-xs text-slate-400">
          This CMS / Admin Panel operates from the shared PostgreSQL database via secure Fastify REST APIs. The incharge-facing Party Application operates with full role-based access control.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-slate-800 text-xs">
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
            <div className="font-bold text-amber-400">CMS Admin Panel Endpoint</div>
            <div className="text-slate-300 font-mono truncate">{typeof window !== 'undefined' ? window.location.origin : 'Admin Panel'}</div>
          </div>
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
            <div className="font-bold text-emerald-400">Party Application Endpoint</div>
            <div className="text-slate-300 font-mono truncate">{getAppUrl()}</div>
          </div>
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
            <div className="font-bold text-blue-400">Backend Fastify API</div>
            <div className="text-slate-300 font-mono">{getApiUrl()}</div>
          </div>
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
            <div className="font-bold text-purple-400">Shared Database</div>
            <div className="text-slate-300 font-mono">PostgreSQL Cloud / Local</div>
          </div>
        </div>
      </div>
    </div>
  );
}
