import { z } from 'zod';
import { AccountStatus, RoleType } from '@prisma/client';

export const createUserSchema = z.object({
  userCode: z.string().min(2),
  name: z.string().min(2),
  mobileNumber: z.string().min(10),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  role: z.nativeEnum(RoleType),
  unitId: z.string().uuid().optional(),
  organisationId: z.string().uuid().optional(),
});

export const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  mobileNumber: z.string().min(10).optional(),
  email: z.string().email().optional(),
  role: z.nativeEnum(RoleType).optional(),
  unitId: z.string().uuid().optional(),
  accountStatus: z.nativeEnum(AccountStatus).optional(),
});

export const updateUserStatusSchema = z.object({
  status: z.nativeEnum(AccountStatus),
});

export const userQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
  search: z.string().optional(),
  role: z.nativeEnum(RoleType).optional(),
  unitId: z.string().uuid().optional(),
  accountStatus: z.nativeEnum(AccountStatus).optional(),
});

export type CreateUserDto = z.infer<typeof createUserSchema>;
export type UpdateUserDto = z.infer<typeof updateUserSchema>;
export type UpdateUserStatusDto = z.infer<typeof updateUserStatusSchema>;
export type UserQueryDto = z.infer<typeof userQuerySchema>;
