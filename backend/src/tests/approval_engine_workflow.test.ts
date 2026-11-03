process.env.NODE_ENV = 'test';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { ApprovalsService } from '../modules/approvals/approvals.service.js';
import { RoleType, AccountStatus } from '@prisma/client';

describe('Central Approval Management Engine Workflow Test Suite', () => {
  const cleanupUserIds: string[] = [];
  const cleanupVoterIds: string[] = [];
  const cleanupApprovalIds: string[] = [];
  const cleanupAssignmentIds: string[] = [];

  let testUser: any;
  let testVoter: any;
  let testAssignment: any;
  let initialBoothId: string | null = null;
  let targetMandalId: string | null = null;

  before(async () => {
    // Find existing booth & mandal for foreign key validity
    const existingBooth = await prisma.booth.findFirst();
    const existingMandal = await prisma.mandal.findFirst();
    initialBoothId = existingBooth ? existingBooth.id : null;
    targetMandalId = existingMandal ? existingMandal.id : null;

    // 1. Create a dummy user in PENDING state
    testUser = await prisma.user.create({
      data: {
        name: 'Test Incharge Candidate',
        userCode: 'USR-TEST-001',
        mobileNumber: '9999988881',
        role: RoleType.BOOTH_INCHARGE,
        accountStatus: AccountStatus.PENDING,
        isVerified: false,
      },
    });
    cleanupUserIds.push(testUser.id);

    // 2. Create a dummy assignment
    testAssignment = await prisma.userHierarchyAssignment.create({
      data: {
        userId: testUser.id,
        roleType: RoleType.BOOTH_INCHARGE,
        boothId: initialBoothId,
      },
    });
    cleanupAssignmentIds.push(testAssignment.id);

    // 3. Create a dummy voter
    testVoter = await prisma.voter.create({
      data: {
        epicNumber: 'TEST-EPIC-9999',
        name: 'Test Voter Subject',
        fatherHusbandName: 'Father Name',
        houseNumber: '1-23',
        serialNumber: 99999,
        age: 35,
        gender: 'MALE',
        voterStatus: 'ACTIVE',
        surveyStatus: 'NOT_SURVEYED',
        politicalPreference: 'UNDECIDED',
      },
    });
    cleanupVoterIds.push(testVoter.id);
  });

  after(async () => {
    // Cleanup in reverse dependency order
    if (cleanupApprovalIds.length > 0) {
      await prisma.approvalRequest.deleteMany({
        where: { id: { in: cleanupApprovalIds } },
      });
    }
    if (cleanupVoterIds.length > 0) {
      await prisma.voterStatusHistory.deleteMany({
        where: { voterId: { in: cleanupVoterIds } },
      });
      await prisma.voter.deleteMany({
        where: { id: { in: cleanupVoterIds } },
      });
    }
    if (cleanupAssignmentIds.length > 0) {
      await prisma.userHierarchyAssignment.deleteMany({
        where: { id: { in: cleanupAssignmentIds } },
      });
    }
    if (cleanupUserIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: cleanupUserIds } },
      });
    }
    await prisma.$disconnect();
  });

  it('1. Should submit 4 distinct approval requests into the engine', async () => {
    // A. User Registration
    const regReq = await ApprovalsService.createApproval({
      partyId: 'TEST_PARTY',
      type: 'USER_REGISTRATION',
      title: 'New Cadre Registration - Test Incharge Candidate',
      entityId: testUser.id,
      entityType: 'User',
      payload: {
        userId: testUser.id,
        applicantName: 'Test Incharge Candidate',
        applicantPhone: '9999988881',
        jurisdiction: 'Booth #101',
      },
      requestedByName: 'Test Incharge Candidate',
      requestedByRole: 'BOOTH_INCHARGE',
      requestedByMobile: '9999988881',
    });
    cleanupApprovalIds.push(regReq.id);
    assert.equal(regReq.status, 'PENDING');

    // B. Incharge Escalation / Transfer
    const inchargeReq = await ApprovalsService.createApproval({
      partyId: 'TEST_PARTY',
      type: 'INCHARGE_REQUEST',
      title: 'Jurisdiction Transfer to Mandal Head',
      entityId: testAssignment.id,
      entityType: 'UserHierarchyAssignment',
      payload: {
        assignmentId: testAssignment.id,
        newUnitLevel: 'MANDAL',
        newUnitId: targetMandalId,
        applicantName: 'Test Incharge Candidate',
      },
      requestedByName: 'Test Incharge Candidate',
    });
    cleanupApprovalIds.push(inchargeReq.id);
    assert.equal(inchargeReq.status, 'PENDING');

    // C. Data Correction
    const dataCorrReq = await ApprovalsService.createApproval({
      partyId: 'TEST_PARTY',
      type: 'DATA_CORRECTION',
      title: 'Update Voter Status to SHIFTED',
      entityId: testVoter.id,
      entityType: 'Voter',
      payload: {
        voterId: testVoter.id,
        updates: {
          voterStatus: 'SHIFTED',
          politicalPreference: 'SUPPORTER',
        },
      },
    });
    cleanupApprovalIds.push(dataCorrReq.id);
    assert.equal(dataCorrReq.status, 'PENDING');

    // D. Survey Approval
    const surveyReq = await ApprovalsService.createApproval({
      partyId: 'TEST_PARTY',
      type: 'SURVEY_APPROVAL',
      title: 'Field Outreach Survey Batch #42 Verification',
      entityType: 'Voter',
      payload: {
        voterIds: [testVoter.id],
      },
    });
    cleanupApprovalIds.push(surveyReq.id);
    assert.equal(surveyReq.status, 'PENDING');
  });

  it('2. Should correctly calculate stats for all categories', async () => {
    const stats = await ApprovalsService.getStats('TEST_PARTY');
    assert(stats.totalPending >= 4, `Expected at least 4 pending, got ${stats.totalPending}`);
    assert(stats.userRegistrations >= 1, `Expected at least 1 user registration, got ${stats.userRegistrations}`);
    assert(stats.inchargeRequests >= 1, `Expected at least 1 incharge request, got ${stats.inchargeRequests}`);
    assert(stats.dataCorrections >= 1, `Expected at least 1 data correction, got ${stats.dataCorrections}`);
    assert(stats.surveyApprovals >= 1, `Expected at least 1 survey approval, got ${stats.surveyApprovals}`);
  });

  it('3. Authorize & Approve USER_REGISTRATION: Should activate user', async () => {
    const [regReq] = await prisma.approvalRequest.findMany({
      where: { entityId: testUser.id, type: 'USER_REGISTRATION', status: 'PENDING' },
    });
    assert(regReq, 'Pending user registration request not found');

    const result = await ApprovalsService.approve(regReq.id, 'Super Admin Test Runner');
    assert.equal(result.status, 'APPROVED');
    assert.equal(result.actionedByName, 'Super Admin Test Runner');

    const updatedUser = await prisma.user.findUnique({ where: { id: testUser.id } });
    assert.equal(updatedUser?.accountStatus, 'ACTIVE');
    assert.equal(updatedUser?.isVerified, true);
  });

  it('4. Authorize & Approve INCHARGE_REQUEST: Should reassign hierarchy assignment', async () => {
    const [inchargeReq] = await prisma.approvalRequest.findMany({
      where: { entityId: testAssignment.id, type: 'INCHARGE_REQUEST', status: 'PENDING' },
    });
    assert(inchargeReq, 'Pending incharge request not found');

    await ApprovalsService.approve(inchargeReq.id, 'Super Admin Test Runner');

    const updatedAssignment = await prisma.userHierarchyAssignment.findUnique({
      where: { id: testAssignment.id },
    });
    assert.equal(updatedAssignment?.mandalId, targetMandalId);
    assert.equal(updatedAssignment?.boothId, null, 'Previous booth jurisdiction should be cleared');
  });

  it('5. Authorize & Approve DATA_CORRECTION: Should update voter and record audit log', async () => {
    const [dataReq] = await prisma.approvalRequest.findMany({
      where: { entityId: testVoter.id, type: 'DATA_CORRECTION', status: 'PENDING' },
    });
    assert(dataReq, 'Pending data correction request not found');

    await ApprovalsService.approve(dataReq.id, 'Super Admin Test Runner');

    const updatedVoter = await prisma.voter.findUnique({ where: { id: testVoter.id } });
    assert.equal(updatedVoter?.voterStatus, 'SHIFTED');
    assert.equal(updatedVoter?.politicalPreference, 'SUPPORTER');

    const history = await prisma.voterStatusHistory.findMany({
      where: { voterId: testVoter.id },
    });
    assert.equal(history.length, 1);
    assert.equal(history[0].previousStatus, 'ACTIVE');
    assert.equal(history[0].newStatus, 'SHIFTED');
  });

  it('6. Authorize & Approve SURVEY_APPROVAL: Should verify surveyStatus for target voters', async () => {
    const [surveyReq] = await prisma.approvalRequest.findMany({
      where: { type: 'SURVEY_APPROVAL', status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      take: 1,
    });
    assert(surveyReq, 'Pending survey approval request not found');

    await ApprovalsService.approve(surveyReq.id, 'Super Admin Test Runner');

    const updatedVoter = await prisma.voter.findUnique({ where: { id: testVoter.id } });
    assert.equal(updatedVoter?.surveyStatus, 'VERIFIED');
  });

  it('7. Rejection with Audit Reason: Should record reason and update status', async () => {
    // Create an unverified user to reject
    const rejectUser = await prisma.user.create({
      data: {
        name: 'Rejected Incharge Candidate',
        userCode: 'USR-TEST-002',
        mobileNumber: '9999988882',
        role: RoleType.BOOTH_INCHARGE,
        accountStatus: AccountStatus.PENDING,
        isVerified: false,
      },
    });
    cleanupUserIds.push(rejectUser.id);

    const rejectReq = await ApprovalsService.createApproval({
      partyId: 'TEST_PARTY',
      type: 'USER_REGISTRATION',
      title: 'Cadre Registration - Rejected Incharge Candidate',
      entityId: rejectUser.id,
      entityType: 'User',
      payload: { userId: rejectUser.id },
    });
    cleanupApprovalIds.push(rejectReq.id);

    const rejected = await ApprovalsService.reject(
      rejectReq.id,
      'Duplicate phone number detected in constituency',
      'Super Admin Test Runner'
    );

    assert.equal(rejected.status, 'REJECTED');
    assert.equal(rejected.rejectionReason, 'Duplicate phone number detected in constituency');

    const updatedUser = await prisma.user.findUnique({ where: { id: rejectUser.id } });
    assert.equal(updatedUser?.accountStatus, 'SUSPENDED');
  });
});
