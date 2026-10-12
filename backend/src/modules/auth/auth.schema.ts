import { z } from 'zod';
import { RoleType } from '@prisma/client';

export const requestOtpSchema = z.object({
  mobileNumber: z.string().min(10, 'Mobile number must be at least 10 digits').max(15),
  role: z.nativeEnum(RoleType).optional(),
  channel: z.enum(['SMS', 'WHATSAPP', 'sms', 'whatsapp']).optional().default('SMS'),
  devMode: z.boolean().optional(),
  name: z.string().optional(),
});

export const registerOtpSchema = z.object({
  mobileNumber: z.string().min(10, 'Mobile number must be at least 10 digits').max(15),
  channel: z.enum(['SMS', 'WHATSAPP', 'sms', 'whatsapp']).optional().default('SMS'),
  devMode: z.boolean().optional(),
});

export const verifyRegisterOtpSchema = z.object({
  requestId: z.string().uuid(),
  otpCode: z.string().length(6, 'OTP must be 6 digits'),
});

export const verifyOtpSchema = z.object({
  requestId: z.string().uuid(),
  otpCode: z.string().length(6, 'OTP must be 6 digits'),
  deviceId: z.string().min(8).optional(),
  deviceName: z.string().max(120).optional(),
});

export const refreshTokenSchema = z
  .object({
    refreshToken: z.string().optional(),
  })
  .default({});

export const deviceSessionSchema = z.object({
  deviceId: z.string().min(8, 'Invalid device ID'),
  deviceToken: z.string().min(16, 'Invalid device token'),
});

export const revokeDeviceSchema = z.object({
  deviceId: z.string().min(8, 'Invalid device ID'),
  reason: z.string().max(200).optional(),
});

export const demoLoginSchema = z.object({
  role: z.nativeEnum(RoleType),
  mobileNumber: z.string().optional(),
  name: z.string().optional(),
  deviceId: z.string().min(8).optional(),
  deviceName: z.string().max(120).optional(),
});

export type RequestOtpDto = z.infer<typeof requestOtpSchema>;
export type RegisterOtpDto = z.infer<typeof registerOtpSchema>;
export type VerifyRegisterOtpDto = z.infer<typeof verifyRegisterOtpSchema>;
export type VerifyOtpDto = z.infer<typeof verifyOtpSchema>;
export type DeviceSessionDto = z.infer<typeof deviceSessionSchema>;
export type RevokeDeviceDto = z.infer<typeof revokeDeviceSchema>;
export type DemoLoginDto = z.infer<typeof demoLoginSchema>;

