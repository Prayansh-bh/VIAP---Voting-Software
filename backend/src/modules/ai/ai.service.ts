import { GoogleGenAI } from '@google/genai';
import { AuditAction } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { env } from '../../config/env.js';
import { AnalyticsService } from '../analytics/analytics.service.js';
import { logAudit } from '../../middleware/audit.js';

export interface AIProvider {
  name: string;
  generateStrategyBrief(prompt: string, context: any, language?: string): Promise<string>;
  generateStrategicReport(unitId: string, language?: string): Promise<any>;
}

export class MockAIProvider implements AIProvider {
  name = 'mock-provider';

  async generateStrategyBrief(prompt: string, context: any, language: string = 'en'): Promise<string> {
    const isTelugu = language === 'te';
    const unitName = context.unit?.name || 'నియోజకవర్గం';

    if (isTelugu) {
      return `【వ్యూహాత్మక విశ్లేషణ - ${unitName}】
1. మొత్తం ఓటర్లు: ${context.totalVoters || 0} | పోలైన ఓట్లు: ${context.turnout || 0}%
2. ఆధిక్యం: TDP (${context.preferences?.TDP || 0}) vs YSRCP (${context.preferences?.YSRCP || 0})
3. క్షేత్రస్థాయి పరిశీలన: బూత్ లెవెల్ కార్యకర్తలను సమీకరించడం మరియు తటస్థ ఓటర్లను ఆకట్టుకోవడం అత్యంత కీలకం.
4. తక్షణ కార్యాచరణ: వలస ఓటర్ల రవాణా ఏర్పాట్లను వేగవంతం చేయండి మరియు నకిలీ ఓటర్ల అభ్యంతరాలను నివేదించండి.`;
    }

    return `Strategic Analysis for ${unitName}:
• Total registered voters: ${context.totalVoters || 0} | Turnout: ${context.turnout || 0}%
• Preference Margin: TDP (${context.preferences?.TDP || 0}) vs YSRCP (${context.preferences?.YSRCP || 0})
• Key Priority: Mobilize booth workers in trailing pockets and coordinate transport for ${context.migratedVoters || 0} migrated voters.
• Next Steps: Target neutral voters in the 18-35 age demographic with localized campaign messages.`;
  }

  async generateStrategicReport(unitId: string, language: string = 'en'): Promise<any> {
    const analytics = await AnalyticsService.computeAnalyticsForUnit(unitId);
    const isTelugu = language === 'te';

    return {
      reportId: `REP-STRAT-${Date.now()}`,
      unitId,
      unitName: analytics.unit?.name || 'Unit',
      language,
      generatedAt: new Date().toISOString(),
      executiveSummary: isTelugu
        ? `${analytics.unit?.name || 'నియోజకవర్గం'} లో ఎన్నికల గెలుపు వ్యూహం: గెలుపు అవకాశాలు పుష్కలంగా ఉన్నాయి.`
        : `Executive Strategy Report for ${analytics.unit?.name || 'Constituency'}: Strong momentum identified across majority polling booths.`,
      keyStrengths: [
        isTelugu ? 'పటిష్టమైన 100-ఓటర్ల ఇన్‌చార్జ్ వ్యవస్థ' : 'Strong 100-voter in-charge field network',
        isTelugu ? 'యువత మరియు మహిళా ఓటర్లలో సానుకూలత' : 'High engagement among youth & women demographics',
      ],
      vulnerabilities: [
        isTelugu ? 'కొన్ని గ్రామాల్లో నకిలీ ఓటర్ల ముప్పు' : 'Identified suspected fake voter entries requiring formal objections',
        isTelugu ? 'వలస ఓటర్ల పోలింగ్ శాతం తక్కువగా ఉండే అవకాశం' : 'Migrated voters turnout gap if transportation is delayed',
      ],
      actionPlan: [
        isTelugu ? 'అన్ని బూత్‌లలో పోలింగ్ ఏజెంట్లకు మాక్ పోల్ శిక్షణ పూర్తి చేయండి' : 'Complete mock poll drill for all booth agents',
        isTelugu ? 'సమీప పోరు ఉన్న గ్రామాల్లో ప్రత్యేక ప్రచార బృందాలను నియోగించండి' : 'Deploy senior leadership squads in close contest villages',
      ],
    };
  }
}

export class GeminiAIProvider implements AIProvider {
  name = 'gemini';
  private client: GoogleGenAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenAI({ apiKey });
  }

  async generateStrategyBrief(prompt: string, context: any, language: string = 'en'): Promise<string> {
    try {
      const response = await this.client.models.generateContent({
        model: env.GEMINI_MODEL,
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `You are an expert political election campaign strategist and war-room director.
Language requested: ${language === 'te' ? 'Telugu (తెలుగు)' : 'English'}.
Answer the user's strategic question directly using the contextual hierarchy data below.

DATA CONTEXT:
${JSON.stringify(context, null, 2)}

USER QUESTION:
${prompt}

Provide structured, highly tactical, actionable ground recommendations.`,
              },
            ],
          },
        ],
      });

      return response.text || 'No response generated from AI.';
    } catch {
      return new MockAIProvider().generateStrategyBrief(prompt, context, language);
    }
  }

  async generateStrategicReport(unitId: string, language: string = 'en'): Promise<any> {
    const analytics = await AnalyticsService.computeAnalyticsForUnit(unitId);
    const prompt = `Generate a full structured JSON political strategy report for ${analytics.unit?.name} (${analytics.unit?.level}).
Format keys: executiveSummary, keyStrengths (array), vulnerabilities (array), actionPlan (array).
Language: ${language === 'te' ? 'Telugu' : 'English'}.`;

    try {
      const response = await this.client.models.generateContent({
        model: env.GEMINI_MODEL,
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `${prompt}\n\nDATA:\n${JSON.stringify(analytics, null, 2)}`,
              },
            ],
          },
        ],
      });

      const text = response.text || '{}';
      const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      return {
        reportId: `REP-AI-${Date.now()}`,
        unitId,
        unitName: analytics.unit?.name,
        language,
        generatedAt: new Date().toISOString(),
        ...parsed,
      };
    } catch {
      return new MockAIProvider().generateStrategicReport(unitId, language);
    }
  }
}

export class AIService {
  private static provider: AIProvider = env.GEMINI_API_KEY
    ? new GeminiAIProvider(env.GEMINI_API_KEY)
    : new MockAIProvider();

  static setProvider(newProvider: AIProvider) {
    this.provider = newProvider;
  }

  static getProviderName(): string {
    return this.provider.name;
  }

  static async isAiEnabled(): Promise<boolean> {
    const config = await prisma.cMSConfiguration.findUnique({
      where: { configKey: 'default' },
    });
    const toggles = (config?.featureToggles as Record<string, boolean>) || {};
    return toggles.aiCockpit !== false;
  }

  static async queryStrategy(unitId: string, prompt: string, language: string = 'en', userId?: string) {
    const analytics = await AnalyticsService.computeAnalyticsForUnit(unitId);

    const context = {
      unit: analytics.unit,
      turnout: analytics.summary.turnoutPercentage,
      totalVoters: analytics.summary.totalVoters,
      preferences: analytics.partyPreference,
      fakeVoters: analytics.summary.fakeVoters,
      migratedVoters: analytics.summary.migratedVoters,
      winningAreas: analytics.projections.winningAreasCount,
      trailingAreas: analytics.projections.trailingAreasCount,
      demographics: analytics.demographics,
      operations: analytics.operations,
    };

    const answer = await this.provider.generateStrategyBrief(prompt, context, language);

    if (userId) {
      await logAudit({
        action: AuditAction.CREATE,
        entityType: 'AIStrategyQuery',
        entityId: unitId,
        userId,
        changes: { prompt, language, provider: this.provider.name },
      });
    }

    return {
      provider: this.provider.name,
      language,
      answer,
      context,
    };
  }

  static async generateReport(unitId: string, language: string = 'en', userId?: string) {
    const report = await this.provider.generateStrategicReport(unitId, language);

    if (userId) {
      await logAudit({
        action: AuditAction.CREATE,
        entityType: 'AIStrategicReport',
        entityId: unitId,
        userId,
        changes: { language, provider: this.provider.name },
      });
    }

    return report;
  }
}
