import { apiFetch } from './client';
import { getOrCreateDeviceId, setDeviceToken, clearDeviceToken } from '../authStorage';

export async function requestOtpApi(
  mobileNumber: string,
  role: string
): Promise<{ requestId: string; expiresAt?: string; cooldownSeconds?: number; provider?: string }> {
  return apiFetch<{ requestId: string; expiresAt?: string; cooldownSeconds?: number; provider?: string }>(
    '/api/auth/request-otp',
    {
      method: 'POST',
      body: JSON.stringify({ mobileNumber, role }),
    }
  );
}

export async function requestOtp(
  mobileNumber: string,
  role: string
): Promise<{ requestId: string; expiresAt?: string; cooldownSeconds?: number; provider?: string }> {
  return requestOtpApi(mobileNumber, role);
}

export async function verifyOtpApi(
  requestId: string,
  otpCode: string,
  deviceId?: string,
  deviceName?: string
): Promise<{ token: string; refreshToken?: string; deviceId?: string; deviceToken?: string; user: any }> {
  const resolvedDeviceId = deviceId || getOrCreateDeviceId();
  return apiFetch<{ token: string; refreshToken?: string; deviceId?: string; deviceToken?: string; user: any }>(
    '/api/auth/verify-otp',
    {
      method: 'POST',
      body: JSON.stringify({
        requestId,
        otpCode,
        deviceId: resolvedDeviceId,
        deviceName: deviceName || (typeof navigator !== 'undefined' ? navigator.userAgent : 'Authorized Device'),
      }),
    }
  );
}

export async function verifyOtp(
  requestId: string,
  otpCode: string,
  deviceName?: string
): Promise<{ session: any; token: string; deviceId?: string; deviceToken?: string }> {
  const deviceId = getOrCreateDeviceId();
  const data = await verifyOtpApi(requestId, otpCode, deviceId, deviceName);
  
  if (data.deviceToken) {
    setDeviceToken(data.deviceToken);
  }

  const user = data.user || {};
  const assignment = user.hierarchyAssignment;

  return {
    token: data.token,
    deviceId: data.deviceId,
    deviceToken: data.deviceToken,
    session: {
      userName: user.name || user.userCode || 'In-Charge',
      mobileNumber: user.mobileNumber || '',
      role: user.role || 'CONSTITUENCY_INCHARGE',
      unitId: user.unitId || assignment?.unitId || '',
      assignedConstituency: assignment?.constituency?.name || 'Kondapi',
      assignedMandal: assignment?.mandal?.name || user.unitName,
      assignedVillage: assignment?.village?.name,
      assignedBooth: assignment?.booth?.boothNumber || assignment?.booth?.name,
      assignedVoterGroup: assignment?.voterGroup?.name,
      userId: user.id,
      accountStatus: user.accountStatus === 'ACTIVE' ? 'Active' : 'Pending',
    },
  };
}

/**
 * Fast 1-Click Demo Authentication for reviewers, clients, and testing.
 * Automatically authorizes device and creates session for selected role without prompting for OTP.
 */
export async function loginAsDemoRoleApi(
  role: string,
  deviceId?: string,
  deviceName?: string
): Promise<{ token: string; refreshToken?: string; deviceId: string; deviceToken: string; user: any }> {
  const resolvedDeviceId = deviceId || getOrCreateDeviceId();
  return apiFetch<{ token: string; refreshToken?: string; deviceId: string; deviceToken: string; user: any }>(
    '/api/auth/demo-login',
    {
      method: 'POST',
      body: JSON.stringify({
        role,
        deviceId: resolvedDeviceId,
        deviceName: deviceName || (typeof navigator !== 'undefined' ? navigator.userAgent : 'Authorized Demo Device'),
      }),
    }
  );
}

export async function loginAsDemoRole(
  role: string,
  deviceName?: string
): Promise<{ session: any; token: string; deviceId: string; deviceToken: string }> {
  const deviceId = getOrCreateDeviceId();
  const data = await loginAsDemoRoleApi(role, deviceId, deviceName);

  if (data.deviceToken) {
    setDeviceToken(data.deviceToken);
  }

  const user = data.user || {};
  const assignment = user.hierarchyAssignment;

  return {
    token: data.token,
    deviceId: data.deviceId,
    deviceToken: data.deviceToken,
    session: {
      userName: user.name || user.userCode || 'In-Charge',
      mobileNumber: user.mobileNumber || '',
      role: user.role || role,
      unitId: user.unitId || assignment?.unitId || '',
      assignedConstituency: assignment?.constituency?.name || 'Kondapi',
      assignedMandal: assignment?.mandal?.name || user.unitName,
      assignedVillage: assignment?.village?.name,
      assignedBooth: assignment?.booth?.boothNumber || assignment?.booth?.name,
      assignedVoterGroup: assignment?.voterGroup?.name,
      userId: user.id,
      accountStatus: user.accountStatus === 'ACTIVE' ? 'Active' : 'Pending',
    },
  };
}

/**
 * Authenticates user seamlessly using a remembered device token (Zomato/Uber pattern).
 * Directly opens dashboard on authorized devices without prompting for OTP.
 */
export async function authenticateDeviceSessionApi(
  deviceId: string,
  deviceToken: string
): Promise<{ token: string; refreshToken?: string; deviceId: string; deviceToken: string; user: any }> {
  return apiFetch<{ token: string; refreshToken?: string; deviceId: string; deviceToken: string; user: any }>(
    '/api/auth/device-session',
    {
      method: 'POST',
      body: JSON.stringify({ deviceId, deviceToken }),
    }
  );
}

export async function authenticateDeviceSession(
  deviceId: string,
  deviceToken: string
): Promise<{ session: any; token: string; deviceId: string; deviceToken: string }> {
  const data = await authenticateDeviceSessionApi(deviceId, deviceToken);
  
  if (data.deviceToken) {
    setDeviceToken(data.deviceToken);
  }

  const user = data.user || {};
  const assignment = user.hierarchyAssignment;

  return {
    token: data.token,
    deviceId: data.deviceId,
    deviceToken: data.deviceToken,
    session: {
      userName: user.name || user.userCode || 'In-Charge',
      mobileNumber: user.mobileNumber || '',
      role: user.role || 'CONSTITUENCY_INCHARGE',
      unitId: user.unitId || assignment?.unitId || '',
      assignedConstituency: assignment?.constituency?.name || 'Kondapi',
      assignedMandal: assignment?.mandal?.name || user.unitName,
      assignedVillage: assignment?.village?.name,
      assignedBooth: assignment?.booth?.boothNumber || assignment?.booth?.name,
      assignedVoterGroup: assignment?.voterGroup?.name,
      userId: user.id,
      accountStatus: user.accountStatus === 'ACTIVE' ? 'Active' : 'Pending',
    },
  };
}

export async function fetchCurrentUser(): Promise<any> {
  return apiFetch('/api/auth/me');
}

export async function logoutApi(): Promise<{ loggedOut: boolean }> {
  clearDeviceToken();
  return apiFetch('/api/auth/logout', { method: 'POST' });
}

export async function fetchUserDevices(): Promise<any[]> {
  return apiFetch('/api/auth/devices');
}

export async function revokeDeviceApi(deviceId: string, reason?: string): Promise<any> {
  return apiFetch(`/api/auth/devices/${deviceId}/revoke`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}
