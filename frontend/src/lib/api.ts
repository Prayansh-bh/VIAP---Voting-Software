/**
 * Single Responsibility Principle (SRP) Modular API Architecture.
 * Decomposed into specialized domain client services under ./api/:
 * - client: Base HTTP apiFetch & token injection
 * - auth: OTP lifecycle, sessions, demo mocks
 * - voters: Voter queries, mutations, bulk import
 * - analytics: Turnout metrics, hierarchy snapshots
 * - tasks: Task assignments & status tracking
 * - training: Training videos and quiz progress
 * - cadre: Network hierarchy and performance
 * - reports: Ground and polling reports
 * - ai: Strategic intelligence cockpit and forecasts
 * - notifications: Live notifications and announcements
 * - cms: Incharge management, geography, versions, parties
 * - audit: System audit logs
 */

export * from './api/index';
