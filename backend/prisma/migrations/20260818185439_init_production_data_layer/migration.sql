-- CreateEnum
CREATE TYPE "OrgHierarchyLevel" AS ENUM ('STATE', 'ZONE', 'PARLIAMENT', 'CONSTITUENCY', 'MANDAL', 'VILLAGE', 'BOOTH', 'VOTER_GROUP');

-- CreateEnum
CREATE TYPE "RoleType" AS ENUM ('SUPER_ADMIN', 'HIGH_COMMAND', 'STATE_ADMIN', 'ZONE_INCHARGE', 'PARLIAMENT_INCHARGE', 'CONSTITUENCY_INCHARGE', 'MANDAL_INCHARGE', 'VILLAGE_INCHARGE', 'BOOTH_PRESIDENT', 'VOTER_100_INCHARGE', 'POLLING_AGENT', 'VOLUNTEER');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'PENDING', 'SUSPENDED', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "RelationType" AS ENUM ('FATHER', 'HUSBAND', 'MOTHER', 'OTHER');

-- CreateEnum
CREATE TYPE "VoterStatus" AS ENUM ('ACTIVE', 'SHIFTED', 'DECEASED', 'DUPLICATE', 'FAKE', 'DOUBTFUL', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "SurveyStatus" AS ENUM ('NOT_SURVEYED', 'SURVEYED', 'VERIFIED');

-- CreateEnum
CREATE TYPE "VoterLocationStatus" AS ENUM ('LOCAL', 'MIGRATED');

-- CreateEnum
CREATE TYPE "VoteStatus" AS ENUM ('NOT_VOTED', 'VOTED', 'VOTE_DONE');

-- CreateEnum
CREATE TYPE "FakeVoterStatus" AS ENUM ('FLAGGED', 'UNDER_VERIFICATION', 'VERIFIED_ISSUE', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TrainingStatus" AS ENUM ('ASSIGNED', 'WATCHED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "GroundReportType" AS ENUM ('GENERAL_UPDATE', 'COMPLAINT_ISSUE');

-- CreateEnum
CREATE TYPE "GroundReportStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'BULK_IMPORT', 'EXPORT', 'LOGIN', 'LOGOUT');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('TASK_ASSIGNED', 'VOTE_UPDATE', 'REPORT_CREATED', 'CADRE_ASSIGNED', 'IMPORT_COMPLETE', 'ALERT_TRIGGERED', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ImportJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "Organisation" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "logoUrl" TEXT,
    "website" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organisation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PoliticalParty" (
    "id" UUID NOT NULL,
    "organisationId" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "symbolName" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#eab308',
    "secondaryColor" TEXT DEFAULT '#1e293b',
    "accentColor" TEXT DEFAULT '#3b82f6',
    "logoUrl" TEXT,
    "flagUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PoliticalParty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartyBranding" (
    "id" UUID NOT NULL,
    "partyId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "slogan" TEXT,
    "headerBannerUrl" TEXT,
    "themeSettings" JSONB,
    "leaderNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "socialLinks" JSONB,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartyBranding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "State" (
    "id" UUID NOT NULL,
    "organisationId" UUID,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "capital" TEXT,
    "totalVoters" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "State_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Zone" (
    "id" UUID NOT NULL,
    "stateId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "headquarters" TEXT,
    "totalVoters" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Zone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Parliament" (
    "id" UUID NOT NULL,
    "zoneId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "parliamentNumber" INTEGER,
    "totalVoters" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Parliament_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Constituency" (
    "id" UUID NOT NULL,
    "parliamentId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "constituencyNumber" INTEGER,
    "isReservedSC" BOOLEAN NOT NULL DEFAULT false,
    "isReservedST" BOOLEAN NOT NULL DEFAULT false,
    "totalVoters" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Constituency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mandal" (
    "id" UUID NOT NULL,
    "constituencyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "mandalNumber" INTEGER,
    "totalVoters" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mandal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Village" (
    "id" UUID NOT NULL,
    "mandalId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isPanchayat" BOOLEAN NOT NULL DEFAULT true,
    "totalVoters" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Village_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booth" (
    "id" UUID NOT NULL,
    "villageId" UUID NOT NULL,
    "boothNumber" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pollingStation" TEXT,
    "locationCoordinates" JSONB,
    "totalVoters" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoterGroup" (
    "id" UUID NOT NULL,
    "boothId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "rangeStart" INTEGER NOT NULL DEFAULT 1,
    "rangeEnd" INTEGER NOT NULL DEFAULT 100,
    "totalVoters" INTEGER NOT NULL DEFAULT 100,
    "assignedInchargeId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoterGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationUnit" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "level" "OrgHierarchyLevel" NOT NULL,
    "totalVoters" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "parentId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" UUID NOT NULL,
    "organisationId" UUID,
    "name" TEXT NOT NULL,
    "code" "RoleType" NOT NULL,
    "description" TEXT,
    "hierarchyLevel" "OrgHierarchyLevel" NOT NULL,
    "permissions" JSONB DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "organisationId" UUID,
    "userCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mobileNumber" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT,
    "roleId" UUID,
    "role" "RoleType" NOT NULL DEFAULT 'VOTER_100_INCHARGE',
    "accountStatus" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "profilePictureUrl" TEXT,
    "unitId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserHierarchyAssignment" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "roleType" "RoleType" NOT NULL,
    "stateId" UUID,
    "zoneId" UUID,
    "parliamentId" UUID,
    "constituencyId" UUID,
    "mandalId" UUID,
    "villageId" UUID,
    "boothId" UUID,
    "voterGroupId" UUID,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserHierarchyAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Voter" (
    "id" UUID NOT NULL,
    "serialNumber" INTEGER NOT NULL,
    "epicNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fatherHusbandName" TEXT NOT NULL,
    "relationType" "RelationType" NOT NULL DEFAULT 'FATHER',
    "houseNumber" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "gender" "Gender" NOT NULL DEFAULT 'MALE',
    "mobileNumber" TEXT,
    "stateId" UUID,
    "zoneId" UUID,
    "parliamentId" UUID,
    "constituencyId" UUID,
    "mandalId" UUID,
    "villageId" UUID,
    "boothId" UUID,
    "voterGroupId" UUID,
    "unitId" UUID,
    "assignedInchargeId" UUID,
    "casteCategoryId" UUID,
    "voterCasteId" UUID,
    "caste" TEXT,
    "subCaste" TEXT,
    "profession" TEXT,
    "politicalPartyId" UUID,
    "politicalPreference" TEXT NOT NULL DEFAULT 'NEUTRAL',
    "voterStatus" "VoterStatus" NOT NULL DEFAULT 'ACTIVE',
    "surveyStatus" "SurveyStatus" NOT NULL DEFAULT 'NOT_SURVEYED',
    "locationStatus" "VoterLocationStatus" NOT NULL DEFAULT 'LOCAL',
    "voterLocationStatus" "VoterLocationStatus" NOT NULL DEFAULT 'LOCAL',
    "migrationCity" TEXT,
    "migrationState" TEXT,
    "currentLocation" TEXT,
    "voteStatus" "VoteStatus" NOT NULL DEFAULT 'NOT_VOTED',
    "voteDoneAt" TIMESTAMP(3),
    "voteDoneTime" TIMESTAMP(3),
    "inchargeAssessment" TEXT,
    "notes" TEXT,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Voter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoterAssignment" (
    "id" UUID NOT NULL,
    "voterId" UUID NOT NULL,
    "voterGroupId" UUID,
    "assignedUserId" UUID,
    "assignedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unassignedDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,

    CONSTRAINT "VoterAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoterStatusHistory" (
    "id" UUID NOT NULL,
    "voterId" UUID NOT NULL,
    "previousStatus" "VoterStatus" NOT NULL,
    "newStatus" "VoterStatus" NOT NULL,
    "reason" TEXT,
    "changedById" UUID,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoterStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FakeVoterFlag" (
    "id" UUID NOT NULL,
    "voterId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "evidenceUrl" TEXT,
    "status" "FakeVoterStatus" NOT NULL DEFAULT 'FLAGGED',
    "flaggedById" UUID NOT NULL,
    "flaggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedById" UUID,
    "resolutionNotes" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FakeVoterFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoterMigration" (
    "id" UUID NOT NULL,
    "voterId" UUID NOT NULL,
    "status" "VoterLocationStatus" NOT NULL DEFAULT 'MIGRATED',
    "destinationCity" TEXT NOT NULL,
    "destinationState" TEXT,
    "destinationCountry" TEXT DEFAULT 'India',
    "contactInCity" TEXT,
    "travelRequired" BOOLEAN NOT NULL DEFAULT false,
    "transportArranged" BOOLEAN NOT NULL DEFAULT false,
    "returnPlannedDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoterMigration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoteTracking" (
    "id" UUID NOT NULL,
    "voterId" UUID NOT NULL,
    "status" "VoteStatus" NOT NULL DEFAULT 'VOTE_DONE',
    "markedById" UUID NOT NULL,
    "markedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verificationMethod" TEXT DEFAULT 'INCHARGE_CONFIRMATION',
    "notes" TEXT,

    CONSTRAINT "VoteTracking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveVoteEvent" (
    "id" UUID NOT NULL,
    "previousStatus" "VoteStatus" NOT NULL,
    "nextStatus" "VoteStatus" NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voterId" UUID NOT NULL,
    "unitId" UUID,
    "inchargeId" UUID NOT NULL,

    CONSTRAINT "LiveVoteEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cadre" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "badges" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "performanceScore" DOUBLE PRECISION NOT NULL DEFAULT 85.0,
    "totalAssignedVoters" INTEGER NOT NULL DEFAULT 0,
    "votedCoveredCount" INTEGER NOT NULL DEFAULT 0,
    "tasksCompletedCount" INTEGER NOT NULL DEFAULT 0,
    "trainingCompletedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cadre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CadreAssignment" (
    "id" UUID NOT NULL,
    "boothId" UUID,
    "unitId" UUID,
    "slotIndex" INTEGER NOT NULL DEFAULT 0,
    "roleTitle" TEXT,
    "assigneeUserId" UUID,
    "assignedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CadreAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "instructions" TEXT,
    "assignedBy" TEXT,
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "dueDate" TIMESTAMP(3),
    "sourceLevel" "OrgHierarchyLevel" NOT NULL DEFAULT 'CONSTITUENCY',
    "targetLevel" "OrgHierarchyLevel" NOT NULL DEFAULT 'VOTER_GROUP',
    "sourceUnitId" UUID,
    "assigneeId" UUID,
    "constituencyId" UUID,
    "mandalId" UUID,
    "villageId" UUID,
    "boothId" UUID,
    "unitId" UUID,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskAssignment" (
    "id" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3),
    "comments" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskStatusHistory" (
    "id" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "previousStatus" "TaskStatus" NOT NULL,
    "newStatus" "TaskStatus" NOT NULL,
    "notes" TEXT,
    "changedById" UUID,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingVideo" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "duration" TEXT NOT NULL,
    "videoUrl" TEXT,
    "youtubeId" TEXT,
    "thumbnailUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "unitId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingVideo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingAssignment" (
    "id" UUID NOT NULL,
    "videoId" UUID NOT NULL,
    "targetRole" "RoleType",
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingProgress" (
    "id" UUID NOT NULL,
    "status" "TrainingStatus" NOT NULL DEFAULT 'ASSIGNED',
    "watchedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "quizScore" INTEGER,
    "notes" TEXT,
    "userId" UUID NOT NULL,
    "videoId" UUID NOT NULL,
    "assignedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CasteCategory" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CasteCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoterCaste" (
    "id" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoterCaste_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroundReport" (
    "id" UUID NOT NULL,
    "reportType" "GroundReportType" NOT NULL DEFAULT 'GENERAL_UPDATE',
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "description" TEXT NOT NULL,
    "issueCategory" TEXT,
    "affectedVotersCount" INTEGER,
    "status" "GroundReportStatus" NOT NULL DEFAULT 'PENDING',
    "resolutionNotes" TEXT,
    "constituencyId" UUID,
    "mandalId" UUID,
    "villageId" UUID,
    "boothId" UUID,
    "unitId" UUID,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroundReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PollingReport" (
    "id" UUID NOT NULL,
    "mandalName" TEXT NOT NULL,
    "boothLabel" TEXT NOT NULL,
    "reporterName" TEXT NOT NULL,
    "tdpVotes" INTEGER NOT NULL DEFAULT 0,
    "ysrcpVotes" INTEGER NOT NULL DEFAULT 0,
    "jspVotes" INTEGER NOT NULL DEFAULT 0,
    "bjpVotes" INTEGER NOT NULL DEFAULT 0,
    "incVotes" INTEGER NOT NULL DEFAULT 0,
    "othersVotes" INTEGER NOT NULL DEFAULT 0,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "boothId" UUID,
    "unitId" UUID,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PollingReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartyPerformance" (
    "id" UUID NOT NULL,
    "constituencyId" UUID NOT NULL,
    "partyId" UUID NOT NULL,
    "electionYear" INTEGER NOT NULL DEFAULT 2024,
    "projectedVotes" INTEGER NOT NULL DEFAULT 0,
    "confirmedVotes" INTEGER NOT NULL DEFAULT 0,
    "swingPercentage" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "status" TEXT NOT NULL DEFAULT 'WINNING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartyPerformance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ElectionProjection" (
    "id" UUID NOT NULL,
    "constituencyId" UUID NOT NULL,
    "totalElectorate" INTEGER NOT NULL,
    "projectedTurnout" DOUBLE PRECISION NOT NULL,
    "leadingPartyCode" TEXT NOT NULL,
    "leadMarginVotes" INTEGER NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0.92,
    "insightsSummary" TEXT,
    "scenarioData" JSONB,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ElectionProjection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "priority" "TaskPriority" NOT NULL DEFAULT 'HIGH',
    "targetRole" "RoleType",
    "targetLevel" "OrgHierarchyLevel",
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "readAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIInsight" (
    "id" UUID NOT NULL,
    "constituencyId" UUID,
    "category" TEXT NOT NULL DEFAULT 'STRATEGY',
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sentimentScore" DOUBLE PRECISION NOT NULL DEFAULT 0.75,
    "recommendedAction" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsArticle" (
    "id" UUID NOT NULL,
    "constituencyId" UUID,
    "headline" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "articleUrl" TEXT,
    "snippet" TEXT,
    "sentiment" TEXT NOT NULL DEFAULT 'POSITIVE',
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsArticle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialTrend" (
    "id" UUID NOT NULL,
    "constituencyId" UUID,
    "hashtag" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'X / Twitter',
    "mentionCount" INTEGER NOT NULL DEFAULT 0,
    "sentimentPct" DOUBLE PRECISION NOT NULL DEFAULT 70.0,
    "trendingRank" INTEGER NOT NULL DEFAULT 1,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialTrend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "action" "AuditAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "unitId" UUID,
    "changes" JSONB,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginSession" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "deviceInfo" TEXT,
    "ipAddress" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OTPVerification" (
    "id" UUID NOT NULL,
    "mobileNumber" TEXT NOT NULL,
    "role" "RoleType" NOT NULL,
    "otpCode" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "userId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OTPVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CMSConfiguration" (
    "id" UUID NOT NULL,
    "organisationId" UUID,
    "configKey" TEXT NOT NULL DEFAULT 'default',
    "organisationName" TEXT NOT NULL,
    "stateName" TEXT NOT NULL,
    "defaultLanguage" TEXT NOT NULL DEFAULT 'en',
    "hierarchyLabels" JSONB NOT NULL,
    "featureToggles" JSONB NOT NULL,
    "aiEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CMSConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" UUID NOT NULL,
    "status" "ImportJobStatus" NOT NULL DEFAULT 'PENDING',
    "fileName" TEXT NOT NULL,
    "unitId" UUID,
    "createdById" UUID NOT NULL,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "payload" JSONB,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AggregateCache" (
    "id" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "snapshot" JSONB NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AggregateCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organisation_code_key" ON "Organisation"("code");

-- CreateIndex
CREATE INDEX "Organisation_code_idx" ON "Organisation"("code");

-- CreateIndex
CREATE INDEX "Organisation_isActive_idx" ON "Organisation"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "PoliticalParty_code_key" ON "PoliticalParty"("code");

-- CreateIndex
CREATE INDEX "PoliticalParty_code_idx" ON "PoliticalParty"("code");

-- CreateIndex
CREATE INDEX "PoliticalParty_isActive_idx" ON "PoliticalParty"("isActive");

-- CreateIndex
CREATE INDEX "PoliticalParty_organisationId_idx" ON "PoliticalParty"("organisationId");

-- CreateIndex
CREATE INDEX "PartyBranding_partyId_idx" ON "PartyBranding"("partyId");

-- CreateIndex
CREATE INDEX "PartyBranding_isDefault_idx" ON "PartyBranding"("isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "State_code_key" ON "State"("code");

-- CreateIndex
CREATE INDEX "State_code_idx" ON "State"("code");

-- CreateIndex
CREATE INDEX "State_organisationId_idx" ON "State"("organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "Zone_code_key" ON "Zone"("code");

-- CreateIndex
CREATE INDEX "Zone_stateId_idx" ON "Zone"("stateId");

-- CreateIndex
CREATE INDEX "Zone_code_idx" ON "Zone"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Parliament_code_key" ON "Parliament"("code");

-- CreateIndex
CREATE INDEX "Parliament_zoneId_idx" ON "Parliament"("zoneId");

-- CreateIndex
CREATE INDEX "Parliament_code_idx" ON "Parliament"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Constituency_code_key" ON "Constituency"("code");

-- CreateIndex
CREATE INDEX "Constituency_parliamentId_idx" ON "Constituency"("parliamentId");

-- CreateIndex
CREATE INDEX "Constituency_code_idx" ON "Constituency"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Mandal_code_key" ON "Mandal"("code");

-- CreateIndex
CREATE INDEX "Mandal_constituencyId_idx" ON "Mandal"("constituencyId");

-- CreateIndex
CREATE INDEX "Mandal_code_idx" ON "Mandal"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Village_code_key" ON "Village"("code");

-- CreateIndex
CREATE INDEX "Village_mandalId_idx" ON "Village"("mandalId");

-- CreateIndex
CREATE INDEX "Village_code_idx" ON "Village"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Booth_code_key" ON "Booth"("code");

-- CreateIndex
CREATE INDEX "Booth_villageId_idx" ON "Booth"("villageId");

-- CreateIndex
CREATE INDEX "Booth_code_idx" ON "Booth"("code");

-- CreateIndex
CREATE INDEX "Booth_boothNumber_idx" ON "Booth"("boothNumber");

-- CreateIndex
CREATE UNIQUE INDEX "VoterGroup_code_key" ON "VoterGroup"("code");

-- CreateIndex
CREATE INDEX "VoterGroup_boothId_idx" ON "VoterGroup"("boothId");

-- CreateIndex
CREATE INDEX "VoterGroup_code_idx" ON "VoterGroup"("code");

-- CreateIndex
CREATE INDEX "VoterGroup_assignedInchargeId_idx" ON "VoterGroup"("assignedInchargeId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationUnit_code_key" ON "OrganizationUnit"("code");

-- CreateIndex
CREATE INDEX "OrganizationUnit_level_idx" ON "OrganizationUnit"("level");

-- CreateIndex
CREATE INDEX "OrganizationUnit_parentId_idx" ON "OrganizationUnit"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Role_code_key" ON "Role"("code");

-- CreateIndex
CREATE INDEX "Role_code_idx" ON "Role"("code");

-- CreateIndex
CREATE INDEX "Role_hierarchyLevel_idx" ON "Role"("hierarchyLevel");

-- CreateIndex
CREATE UNIQUE INDEX "User_userCode_key" ON "User"("userCode");

-- CreateIndex
CREATE UNIQUE INDEX "User_mobileNumber_key" ON "User"("mobileNumber");

-- CreateIndex
CREATE INDEX "User_userCode_idx" ON "User"("userCode");

-- CreateIndex
CREATE INDEX "User_mobileNumber_idx" ON "User"("mobileNumber");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_accountStatus_idx" ON "User"("accountStatus");

-- CreateIndex
CREATE INDEX "User_unitId_idx" ON "User"("unitId");

-- CreateIndex
CREATE INDEX "UserHierarchyAssignment_userId_idx" ON "UserHierarchyAssignment"("userId");

-- CreateIndex
CREATE INDEX "UserHierarchyAssignment_roleType_idx" ON "UserHierarchyAssignment"("roleType");

-- CreateIndex
CREATE INDEX "UserHierarchyAssignment_constituencyId_idx" ON "UserHierarchyAssignment"("constituencyId");

-- CreateIndex
CREATE INDEX "UserHierarchyAssignment_mandalId_idx" ON "UserHierarchyAssignment"("mandalId");

-- CreateIndex
CREATE INDEX "UserHierarchyAssignment_villageId_idx" ON "UserHierarchyAssignment"("villageId");

-- CreateIndex
CREATE INDEX "UserHierarchyAssignment_boothId_idx" ON "UserHierarchyAssignment"("boothId");

-- CreateIndex
CREATE INDEX "UserHierarchyAssignment_voterGroupId_idx" ON "UserHierarchyAssignment"("voterGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "Voter_epicNumber_key" ON "Voter"("epicNumber");

-- CreateIndex
CREATE INDEX "Voter_epicNumber_idx" ON "Voter"("epicNumber");

-- CreateIndex
CREATE INDEX "Voter_mobileNumber_idx" ON "Voter"("mobileNumber");

-- CreateIndex
CREATE INDEX "Voter_stateId_idx" ON "Voter"("stateId");

-- CreateIndex
CREATE INDEX "Voter_zoneId_idx" ON "Voter"("zoneId");

-- CreateIndex
CREATE INDEX "Voter_parliamentId_idx" ON "Voter"("parliamentId");

-- CreateIndex
CREATE INDEX "Voter_constituencyId_idx" ON "Voter"("constituencyId");

-- CreateIndex
CREATE INDEX "Voter_mandalId_idx" ON "Voter"("mandalId");

-- CreateIndex
CREATE INDEX "Voter_villageId_idx" ON "Voter"("villageId");

-- CreateIndex
CREATE INDEX "Voter_boothId_idx" ON "Voter"("boothId");

-- CreateIndex
CREATE INDEX "Voter_voterGroupId_idx" ON "Voter"("voterGroupId");

-- CreateIndex
CREATE INDEX "Voter_assignedInchargeId_idx" ON "Voter"("assignedInchargeId");

-- CreateIndex
CREATE INDEX "Voter_voterStatus_idx" ON "Voter"("voterStatus");

-- CreateIndex
CREATE INDEX "Voter_voteStatus_idx" ON "Voter"("voteStatus");

-- CreateIndex
CREATE INDEX "Voter_locationStatus_idx" ON "Voter"("locationStatus");

-- CreateIndex
CREATE INDEX "Voter_voterLocationStatus_idx" ON "Voter"("voterLocationStatus");

-- CreateIndex
CREATE INDEX "Voter_politicalPreference_idx" ON "Voter"("politicalPreference");

-- CreateIndex
CREATE INDEX "Voter_caste_idx" ON "Voter"("caste");

-- CreateIndex
CREATE INDEX "VoterAssignment_voterId_idx" ON "VoterAssignment"("voterId");

-- CreateIndex
CREATE INDEX "VoterAssignment_assignedUserId_idx" ON "VoterAssignment"("assignedUserId");

-- CreateIndex
CREATE INDEX "VoterAssignment_isActive_idx" ON "VoterAssignment"("isActive");

-- CreateIndex
CREATE INDEX "VoterStatusHistory_voterId_idx" ON "VoterStatusHistory"("voterId");

-- CreateIndex
CREATE INDEX "VoterStatusHistory_changedAt_idx" ON "VoterStatusHistory"("changedAt");

-- CreateIndex
CREATE INDEX "FakeVoterFlag_voterId_idx" ON "FakeVoterFlag"("voterId");

-- CreateIndex
CREATE INDEX "FakeVoterFlag_flaggedById_idx" ON "FakeVoterFlag"("flaggedById");

-- CreateIndex
CREATE INDEX "FakeVoterFlag_status_idx" ON "FakeVoterFlag"("status");

-- CreateIndex
CREATE INDEX "FakeVoterFlag_flaggedAt_idx" ON "FakeVoterFlag"("flaggedAt");

-- CreateIndex
CREATE INDEX "VoterMigration_voterId_idx" ON "VoterMigration"("voterId");

-- CreateIndex
CREATE INDEX "VoterMigration_destinationCity_idx" ON "VoterMigration"("destinationCity");

-- CreateIndex
CREATE INDEX "VoterMigration_status_idx" ON "VoterMigration"("status");

-- CreateIndex
CREATE INDEX "VoteTracking_voterId_idx" ON "VoteTracking"("voterId");

-- CreateIndex
CREATE INDEX "VoteTracking_markedById_idx" ON "VoteTracking"("markedById");

-- CreateIndex
CREATE INDEX "VoteTracking_markedAt_idx" ON "VoteTracking"("markedAt");

-- CreateIndex
CREATE INDEX "LiveVoteEvent_unitId_changedAt_idx" ON "LiveVoteEvent"("unitId", "changedAt");

-- CreateIndex
CREATE INDEX "LiveVoteEvent_inchargeId_changedAt_idx" ON "LiveVoteEvent"("inchargeId", "changedAt");

-- CreateIndex
CREATE INDEX "LiveVoteEvent_voterId_changedAt_idx" ON "LiveVoteEvent"("voterId", "changedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Cadre_userId_key" ON "Cadre"("userId");

-- CreateIndex
CREATE INDEX "Cadre_performanceScore_idx" ON "Cadre"("performanceScore");

-- CreateIndex
CREATE INDEX "CadreAssignment_boothId_idx" ON "CadreAssignment"("boothId");

-- CreateIndex
CREATE INDEX "CadreAssignment_assigneeUserId_idx" ON "CadreAssignment"("assigneeUserId");

-- CreateIndex
CREATE INDEX "Task_priority_idx" ON "Task"("priority");

-- CreateIndex
CREATE INDEX "Task_status_idx" ON "Task"("status");

-- CreateIndex
CREATE INDEX "Task_dueDate_idx" ON "Task"("dueDate");

-- CreateIndex
CREATE INDEX "Task_createdById_idx" ON "Task"("createdById");

-- CreateIndex
CREATE INDEX "Task_assigneeId_idx" ON "Task"("assigneeId");

-- CreateIndex
CREATE INDEX "Task_sourceUnitId_idx" ON "Task"("sourceUnitId");

-- CreateIndex
CREATE INDEX "Task_constituencyId_idx" ON "Task"("constituencyId");

-- CreateIndex
CREATE INDEX "TaskAssignment_taskId_idx" ON "TaskAssignment"("taskId");

-- CreateIndex
CREATE INDEX "TaskAssignment_userId_idx" ON "TaskAssignment"("userId");

-- CreateIndex
CREATE INDEX "TaskAssignment_status_idx" ON "TaskAssignment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "TaskAssignment_taskId_userId_key" ON "TaskAssignment"("taskId", "userId");

-- CreateIndex
CREATE INDEX "TaskStatusHistory_taskId_idx" ON "TaskStatusHistory"("taskId");

-- CreateIndex
CREATE INDEX "TaskStatusHistory_changedAt_idx" ON "TaskStatusHistory"("changedAt");

-- CreateIndex
CREATE INDEX "TrainingVideo_category_idx" ON "TrainingVideo"("category");

-- CreateIndex
CREATE INDEX "TrainingVideo_isActive_idx" ON "TrainingVideo"("isActive");

-- CreateIndex
CREATE INDEX "TrainingAssignment_videoId_idx" ON "TrainingAssignment"("videoId");

-- CreateIndex
CREATE INDEX "TrainingProgress_userId_idx" ON "TrainingProgress"("userId");

-- CreateIndex
CREATE INDEX "TrainingProgress_videoId_idx" ON "TrainingProgress"("videoId");

-- CreateIndex
CREATE INDEX "TrainingProgress_status_idx" ON "TrainingProgress"("status");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingProgress_userId_videoId_key" ON "TrainingProgress"("userId", "videoId");

-- CreateIndex
CREATE UNIQUE INDEX "CasteCategory_code_key" ON "CasteCategory"("code");

-- CreateIndex
CREATE INDEX "CasteCategory_code_idx" ON "CasteCategory"("code");

-- CreateIndex
CREATE UNIQUE INDEX "VoterCaste_code_key" ON "VoterCaste"("code");

-- CreateIndex
CREATE INDEX "VoterCaste_categoryId_idx" ON "VoterCaste"("categoryId");

-- CreateIndex
CREATE INDEX "VoterCaste_code_idx" ON "VoterCaste"("code");

-- CreateIndex
CREATE INDEX "GroundReport_reportType_idx" ON "GroundReport"("reportType");

-- CreateIndex
CREATE INDEX "GroundReport_priority_idx" ON "GroundReport"("priority");

-- CreateIndex
CREATE INDEX "GroundReport_status_idx" ON "GroundReport"("status");

-- CreateIndex
CREATE INDEX "GroundReport_createdById_idx" ON "GroundReport"("createdById");

-- CreateIndex
CREATE INDEX "GroundReport_constituencyId_idx" ON "GroundReport"("constituencyId");

-- CreateIndex
CREATE INDEX "PollingReport_boothId_createdAt_idx" ON "PollingReport"("boothId", "createdAt");

-- CreateIndex
CREATE INDEX "PollingReport_createdById_createdAt_idx" ON "PollingReport"("createdById", "createdAt");

-- CreateIndex
CREATE INDEX "PartyPerformance_constituencyId_electionYear_idx" ON "PartyPerformance"("constituencyId", "electionYear");

-- CreateIndex
CREATE INDEX "PartyPerformance_partyId_idx" ON "PartyPerformance"("partyId");

-- CreateIndex
CREATE INDEX "ElectionProjection_constituencyId_computedAt_idx" ON "ElectionProjection"("constituencyId", "computedAt");

-- CreateIndex
CREATE INDEX "Announcement_priority_idx" ON "Announcement"("priority");

-- CreateIndex
CREATE INDEX "Announcement_createdAt_idx" ON "Announcement"("createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AIInsight_category_idx" ON "AIInsight"("category");

-- CreateIndex
CREATE INDEX "AIInsight_constituencyId_idx" ON "AIInsight"("constituencyId");

-- CreateIndex
CREATE INDEX "NewsArticle_constituencyId_idx" ON "NewsArticle"("constituencyId");

-- CreateIndex
CREATE INDEX "NewsArticle_publishedAt_idx" ON "NewsArticle"("publishedAt");

-- CreateIndex
CREATE INDEX "SocialTrend_constituencyId_idx" ON "SocialTrend"("constituencyId");

-- CreateIndex
CREATE INDEX "SocialTrend_recordedAt_idx" ON "SocialTrend"("recordedAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LoginSession_tokenHash_key" ON "LoginSession"("tokenHash");

-- CreateIndex
CREATE INDEX "LoginSession_userId_expiresAt_idx" ON "LoginSession"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "OTPVerification_mobileNumber_role_createdAt_idx" ON "OTPVerification"("mobileNumber", "role", "createdAt");

-- CreateIndex
CREATE INDEX "OTPVerification_userId_idx" ON "OTPVerification"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CMSConfiguration_configKey_key" ON "CMSConfiguration"("configKey");

-- CreateIndex
CREATE INDEX "CMSConfiguration_configKey_idx" ON "CMSConfiguration"("configKey");

-- CreateIndex
CREATE INDEX "CMSConfiguration_organisationId_idx" ON "CMSConfiguration"("organisationId");

-- CreateIndex
CREATE INDEX "ImportJob_createdById_idx" ON "ImportJob"("createdById");

-- CreateIndex
CREATE INDEX "ImportJob_status_idx" ON "ImportJob"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AggregateCache_unitId_key" ON "AggregateCache"("unitId");

-- CreateIndex
CREATE INDEX "AggregateCache_expiresAt_idx" ON "AggregateCache"("expiresAt");

-- AddForeignKey
ALTER TABLE "PoliticalParty" ADD CONSTRAINT "PoliticalParty_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyBranding" ADD CONSTRAINT "PartyBranding_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "PoliticalParty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "State" ADD CONSTRAINT "State_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Zone" ADD CONSTRAINT "Zone_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parliament" ADD CONSTRAINT "Parliament_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Constituency" ADD CONSTRAINT "Constituency_parliamentId_fkey" FOREIGN KEY ("parliamentId") REFERENCES "Parliament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mandal" ADD CONSTRAINT "Mandal_constituencyId_fkey" FOREIGN KEY ("constituencyId") REFERENCES "Constituency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Village" ADD CONSTRAINT "Village_mandalId_fkey" FOREIGN KEY ("mandalId") REFERENCES "Mandal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booth" ADD CONSTRAINT "Booth_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "Village"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoterGroup" ADD CONSTRAINT "VoterGroup_boothId_fkey" FOREIGN KEY ("boothId") REFERENCES "Booth"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoterGroup" ADD CONSTRAINT "VoterGroup_assignedInchargeId_fkey" FOREIGN KEY ("assignedInchargeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationUnit" ADD CONSTRAINT "OrganizationUnit_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "OrganizationUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "OrganizationUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserHierarchyAssignment" ADD CONSTRAINT "UserHierarchyAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserHierarchyAssignment" ADD CONSTRAINT "UserHierarchyAssignment_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserHierarchyAssignment" ADD CONSTRAINT "UserHierarchyAssignment_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserHierarchyAssignment" ADD CONSTRAINT "UserHierarchyAssignment_parliamentId_fkey" FOREIGN KEY ("parliamentId") REFERENCES "Parliament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserHierarchyAssignment" ADD CONSTRAINT "UserHierarchyAssignment_constituencyId_fkey" FOREIGN KEY ("constituencyId") REFERENCES "Constituency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserHierarchyAssignment" ADD CONSTRAINT "UserHierarchyAssignment_mandalId_fkey" FOREIGN KEY ("mandalId") REFERENCES "Mandal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserHierarchyAssignment" ADD CONSTRAINT "UserHierarchyAssignment_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "Village"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserHierarchyAssignment" ADD CONSTRAINT "UserHierarchyAssignment_boothId_fkey" FOREIGN KEY ("boothId") REFERENCES "Booth"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserHierarchyAssignment" ADD CONSTRAINT "UserHierarchyAssignment_voterGroupId_fkey" FOREIGN KEY ("voterGroupId") REFERENCES "VoterGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voter" ADD CONSTRAINT "Voter_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voter" ADD CONSTRAINT "Voter_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voter" ADD CONSTRAINT "Voter_parliamentId_fkey" FOREIGN KEY ("parliamentId") REFERENCES "Parliament"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voter" ADD CONSTRAINT "Voter_constituencyId_fkey" FOREIGN KEY ("constituencyId") REFERENCES "Constituency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voter" ADD CONSTRAINT "Voter_mandalId_fkey" FOREIGN KEY ("mandalId") REFERENCES "Mandal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voter" ADD CONSTRAINT "Voter_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "Village"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voter" ADD CONSTRAINT "Voter_boothId_fkey" FOREIGN KEY ("boothId") REFERENCES "Booth"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voter" ADD CONSTRAINT "Voter_voterGroupId_fkey" FOREIGN KEY ("voterGroupId") REFERENCES "VoterGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voter" ADD CONSTRAINT "Voter_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "OrganizationUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voter" ADD CONSTRAINT "Voter_assignedInchargeId_fkey" FOREIGN KEY ("assignedInchargeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voter" ADD CONSTRAINT "Voter_casteCategoryId_fkey" FOREIGN KEY ("casteCategoryId") REFERENCES "CasteCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voter" ADD CONSTRAINT "Voter_voterCasteId_fkey" FOREIGN KEY ("voterCasteId") REFERENCES "VoterCaste"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voter" ADD CONSTRAINT "Voter_politicalPartyId_fkey" FOREIGN KEY ("politicalPartyId") REFERENCES "PoliticalParty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voter" ADD CONSTRAINT "Voter_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoterAssignment" ADD CONSTRAINT "VoterAssignment_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "Voter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoterStatusHistory" ADD CONSTRAINT "VoterStatusHistory_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "Voter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FakeVoterFlag" ADD CONSTRAINT "FakeVoterFlag_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "Voter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FakeVoterFlag" ADD CONSTRAINT "FakeVoterFlag_flaggedById_fkey" FOREIGN KEY ("flaggedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FakeVoterFlag" ADD CONSTRAINT "FakeVoterFlag_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoterMigration" ADD CONSTRAINT "VoterMigration_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "Voter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoteTracking" ADD CONSTRAINT "VoteTracking_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "Voter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoteTracking" ADD CONSTRAINT "VoteTracking_markedById_fkey" FOREIGN KEY ("markedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveVoteEvent" ADD CONSTRAINT "LiveVoteEvent_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "Voter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveVoteEvent" ADD CONSTRAINT "LiveVoteEvent_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "OrganizationUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveVoteEvent" ADD CONSTRAINT "LiveVoteEvent_inchargeId_fkey" FOREIGN KEY ("inchargeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cadre" ADD CONSTRAINT "Cadre_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CadreAssignment" ADD CONSTRAINT "CadreAssignment_boothId_fkey" FOREIGN KEY ("boothId") REFERENCES "Booth"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CadreAssignment" ADD CONSTRAINT "CadreAssignment_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "OrganizationUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CadreAssignment" ADD CONSTRAINT "CadreAssignment_assigneeUserId_fkey" FOREIGN KEY ("assigneeUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CadreAssignment" ADD CONSTRAINT "CadreAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_sourceUnitId_fkey" FOREIGN KEY ("sourceUnitId") REFERENCES "OrganizationUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_constituencyId_fkey" FOREIGN KEY ("constituencyId") REFERENCES "Constituency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_mandalId_fkey" FOREIGN KEY ("mandalId") REFERENCES "Mandal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "Village"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_boothId_fkey" FOREIGN KEY ("boothId") REFERENCES "Booth"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "OrganizationUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAssignment" ADD CONSTRAINT "TaskAssignment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAssignment" ADD CONSTRAINT "TaskAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskStatusHistory" ADD CONSTRAINT "TaskStatusHistory_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingVideo" ADD CONSTRAINT "TrainingVideo_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "OrganizationUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingAssignment" ADD CONSTRAINT "TrainingAssignment_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "TrainingVideo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingProgress" ADD CONSTRAINT "TrainingProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingProgress" ADD CONSTRAINT "TrainingProgress_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "TrainingVideo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingProgress" ADD CONSTRAINT "TrainingProgress_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoterCaste" ADD CONSTRAINT "VoterCaste_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "CasteCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroundReport" ADD CONSTRAINT "GroundReport_constituencyId_fkey" FOREIGN KEY ("constituencyId") REFERENCES "Constituency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroundReport" ADD CONSTRAINT "GroundReport_mandalId_fkey" FOREIGN KEY ("mandalId") REFERENCES "Mandal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroundReport" ADD CONSTRAINT "GroundReport_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "Village"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroundReport" ADD CONSTRAINT "GroundReport_boothId_fkey" FOREIGN KEY ("boothId") REFERENCES "Booth"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroundReport" ADD CONSTRAINT "GroundReport_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "OrganizationUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroundReport" ADD CONSTRAINT "GroundReport_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollingReport" ADD CONSTRAINT "PollingReport_boothId_fkey" FOREIGN KEY ("boothId") REFERENCES "Booth"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollingReport" ADD CONSTRAINT "PollingReport_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "OrganizationUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollingReport" ADD CONSTRAINT "PollingReport_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyPerformance" ADD CONSTRAINT "PartyPerformance_constituencyId_fkey" FOREIGN KEY ("constituencyId") REFERENCES "Constituency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyPerformance" ADD CONSTRAINT "PartyPerformance_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "PoliticalParty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectionProjection" ADD CONSTRAINT "ElectionProjection_constituencyId_fkey" FOREIGN KEY ("constituencyId") REFERENCES "Constituency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIInsight" ADD CONSTRAINT "AIInsight_constituencyId_fkey" FOREIGN KEY ("constituencyId") REFERENCES "Constituency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsArticle" ADD CONSTRAINT "NewsArticle_constituencyId_fkey" FOREIGN KEY ("constituencyId") REFERENCES "Constituency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialTrend" ADD CONSTRAINT "SocialTrend_constituencyId_fkey" FOREIGN KEY ("constituencyId") REFERENCES "Constituency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoginSession" ADD CONSTRAINT "LoginSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OTPVerification" ADD CONSTRAINT "OTPVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CMSConfiguration" ADD CONSTRAINT "CMSConfiguration_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "OrganizationUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AggregateCache" ADD CONSTRAINT "AggregateCache_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "OrganizationUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
