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

export const updateProfileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100).optional(),
  email: z.string().email('Invalid email address format').max(150).optional(),
}).strict();
export type UpdateProfileDto = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters').max(100),
    confirmPassword: z.string().min(8, 'Password confirmation is required'),
  })
  .strict()
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'New password and confirmation do not match',
    path: ['confirmPassword'],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: 'New password cannot be the same as current password',
    path: ['newPassword'],
  });
export type ChangePasswordDto = z.infer<typeof changePasswordSchema>;

export const requestMobileChangeOtpSchema = z.object({
  newMobileNumber: z.string().min(10, 'Mobile number must be at least 10 digits').max(15),
  channel: z.enum(['SMS', 'WHATSAPP', 'sms', 'whatsapp']).optional().default('SMS'),
}).strict();
export type RequestMobileChangeOtpDto = z.infer<typeof requestMobileChangeOtpSchema>;

export const verifyMobileChangeOtpSchema = z.object({
  requestId: z.string().uuid('Valid OTP requestId is required'),
  newMobileNumber: z.string().min(10, 'Mobile number must be at least 10 digits').max(15),
  otpCode: z.string().length(6, 'OTP must be 6 digits'),
}).strict();
export type VerifyMobileChangeOtpDto = z.infer<typeof verifyMobileChangeOtpSchema>;


