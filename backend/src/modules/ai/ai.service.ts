import { GoogleGenAI } from '@google/genai';
import { AuditAction } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { env } from '../../config/env.js';
import { AnalyticsService } from '../analytics/analytics.service.js';
import { logAudit } from '../../middleware/audit.js';
import { CredentialsService } from '../credentials/credentials.service.js';

export interface AIProvider {
  name: string;
  generateStrategyBrief(prompt: string, context: any, language?: string): Promise<string>;
  generateStrategicReport(unitId: string, language?: string): Promise<any>;
}

export class UnconfiguredAIProvider implements AIProvider {
  name = 'unconfigured';

  async generateStrategyBrief(prompt: string, context: any, language: string = 'en'): Promise<string> {
    const isTe = language === 'te';
    return isTe
      ? `AI స్ట్రాటజీ ఇంజిన్ ఇంకా యాక్టివేట్ కాలేదు. దయచేసి Platform Administration (CMS Console) > "API Keys & Secrets" విభాగంలో మీ ఉచిత Google Gemini API కీ (GEMINI_API_KEY) ను భద్రపరచండి.`
      : `AI Strategic Intelligence Engine is not yet configured with an API key. Platform Administrators can easily configure the free Google Gemini API key by navigating to Platform Administration (CMS Console) > API Keys & Secrets and adding 'GEMINI_API_KEY'.`;
  }

  async generateStrategicReport(unitId: string, language: string = 'en'): Promise<any> {
    const analytics = await AnalyticsService.computeAnalyticsForUnit(unitId);
    return {
      reportId: `REP-UNCONFIGURED-${Date.now()}`,
      unitId,
      unitName: analytics.unit?.name || 'Unit',
      language,
      generatedAt: new Date().toISOString(),
      executiveSummary: `Google Gemini AI API Key is not configured in the database vault. Please save GEMINI_API_KEY under Platform Administration > API Keys & Secrets.`,
      keyStrengths: [
        `Live Registered Voters: ${analytics.summary?.totalVoters?.toLocaleString() || 0}`,
        `Current Polling Turnout: ${analytics.summary?.turnoutPercentage || 0}%`,
      ],
      vulnerabilities: [
        `AI Intelligence not configured to generate predictive battleground projections.`,
      ],
      actionPlan: [
        `Navigate to Platform Administration > API Keys & Secrets`,
        `Click "+ Add Key / Secret", select "GEMINI_API_KEY", enter your Google AI Studio key, and click Save.`,
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
        config: {
          maxOutputTokens: 1000,
          temperature: 0.4,
          systemInstruction: `You are an elite, proactive political campaign war-room commander and strategist.
Guidelines:
- Answer the user's specific strategic query directly, insightfully, and decisively.
- If the current party is newly provisioned or has 0 registered voters yet, acknowledge the setup phase and provide clear ground setup steps (voter enrollment, booth committee recruitment, incharge deployment across the listed Mandals/Constituencies).
- NEVER cut off mid-sentence. Keep answers concise, highly readable, and complete (around 150-250 words).
- Structure clearly using:
  🎯 Direct Situation: (1-2 clear, insightful sentences addressing the prompt directly)
  ⚡ Immediate Ground Actions: (3-4 crisp, highly tactical bullet points)
  📊 Key Numbers to Watch: (2 relevant metrics or targets based on the jurisdiction)
- Avoid raw asterisks like '***Action:**'. Use clean bullets and bold headers.
- Language: ${language === 'te' ? 'Telugu (తెలుగు)' : 'English'}.`,
        },
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `Contextual Hierarchy & Ground Metrics:\n${JSON.stringify(context)}\n\nUser Question:\n${prompt}\n\nProvide an executive war-room tactical response:`,
              },
            ],
          },
        ],
      });

      return response.text || 'No response generated from AI.';
    } catch (err: any) {
      console.error('[GeminiAIProvider] Error generating content:', err);
      return `Gemini AI Error: ${err.message || 'Failed to generate response'}. Please verify your GEMINI_API_KEY under Platform Administration > API Keys & Secrets.`;
    }
  }

  async generateStrategicReport(unitId: string, language: string = 'en'): Promise<any> {
    const analytics = await AnalyticsService.computeAnalyticsForUnit(unitId);
    const prompt = `Generate a full structured JSON political strategy report for ${analytics.unit?.name} (${analytics.unit?.level}).
Format keys: executiveSummary (string), keyStrengths (string array), vulnerabilities (string array), actionPlan (string array).
Language: ${language === 'te' ? 'Telugu' : 'English'}.
Return strictly valid JSON only.`;

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
    } catch (err: any) {
      console.error('[GeminiAIProvider] Error generating report:', err);
      return {
        reportId: `REP-ERR-${Date.now()}`,
        unitId,
        unitName: analytics.unit?.name || 'Unit',
        language,
        generatedAt: new Date().toISOString(),
        executiveSummary: `AI Generation error: ${err.message || 'Could not connect to Gemini'}. Ensure your GEMINI_API_KEY is configured and valid.`,
        keyStrengths: [
          `Total Registered Voters in Area: ${analytics.summary?.totalVoters?.toLocaleString() || 0}`,
          `Active Booth Coverage: ${analytics.projections?.winningAreasCount || 0} areas currently leading`,
        ],
        vulnerabilities: [
          `Flagged Suspect/Fake Voters: ${analytics.summary?.fakeVoters || 0}`,
          `Migrated Voters pending outreach: ${analytics.summary?.migratedVoters || 0}`,
        ],
        actionPlan: [
          `Verify GEMINI_API_KEY in Platform Administration > API Keys & Secrets`,
          `Deploy booth in-charges across ${analytics.projections?.trailingAreasCount || 0} trailing areas`,
        ],
      };
    }
  }
}

export class AIService {
  static async getProviderForTenant(organisationId?: string | null): Promise<AIProvider> {
    const apiKey = await CredentialsService.getDecryptedSecret(organisationId, 'GEMINI_API_KEY');
    if (apiKey && apiKey.trim().length > 0) {
      return new GeminiAIProvider(apiKey.trim());
    }
    return new UnconfiguredAIProvider();
  }

  static async isAiEnabled(): Promise<boolean> {
    const config = await prisma.cMSConfiguration.findUnique({
      where: { configKey: 'default' },
    });
    const toggles = (config?.featureToggles as Record<string, boolean>) || {};
    return toggles.aiCockpit !== false;
  }

  static async queryStrategy(
    unitId: string,
    prompt: string,
    language: string = 'en',
    userId?: string,
    organisationId?: string | null,
  ) {
    const provider = await this.getProviderForTenant(organisationId);
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
      subUnits: [
        ...analytics.projections.winningAreas,
        ...analytics.projections.trailingAreas,
        ...analytics.projections.closeContestAreas,
      ].map((a) => ({ name: a.name, level: a.level, voters: a.totalVoters, status: a.status })),
      demographics: analytics.demographics,
      operations: analytics.operations,
    };

    const answer = await provider.generateStrategyBrief(prompt, context, language);

    if (userId) {
      await logAudit({
        action: AuditAction.CREATE,
        entityType: 'AIStrategyQuery',
        entityId: unitId,
        userId,
        changes: { prompt, language, provider: provider.name },
      });
    }

    return {
      provider: provider.name,
      language,
      answer,
      context,
    };
  }

  static async generateReport(
    unitId: string,
    language: string = 'en',
    userId?: string,
    organisationId?: string | null,
  ) {
    const provider = await this.getProviderForTenant(organisationId);
    const report = await provider.generateStrategicReport(unitId, language);

    if (userId) {
      await logAudit({
        action: AuditAction.CREATE,
        entityType: 'AIStrategicReport',
        entityId: unitId,
        userId,
        changes: { language, provider: provider.name },
      });
    }

    return report;
  }

  static async crawlConstituencyNews(query: string = 'Andhra Pradesh Election') {
    try {
      const feedUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-IN&gl=IN&ceid=IN:en`;
      const res = await fetch(feedUrl);
      if (!res.ok) return 0;
      const xml = await res.text();
      
      const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
      let count = 0;
      for (const itemXml of items.slice(0, 10)) {
        const titleMatch = itemXml.match(/<title>([\s\S]*?)<\/title>/);
        const linkMatch = itemXml.match(/<link>([\s\S]*?)<\/link>/);
        const pubDateMatch = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
        const sourceMatch = itemXml.match(/<source[^>]*>([\s\S]*?)<\/source>/);

        if (titleMatch && linkMatch) {
          const headline = titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim();
          const articleUrl = linkMatch[1].trim();
          const sourceName = sourceMatch ? sourceMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim() : 'News Agency';
          const pubDate = pubDateMatch ? new Date(pubDateMatch[1]) : new Date();

          const lower = headline.toLowerCase();
          let sentiment = 'NEUTRAL';
          if (lower.includes('lead') || lower.includes('win') || lower.includes('support') || lower.includes('ahead') || lower.includes('rally')) sentiment = 'POSITIVE';
          if (lower.includes('protest') || lower.includes('clash') || lower.includes('loss') || lower.includes('allegation') || lower.includes('defeat')) sentiment = 'NEGATIVE';

          const existing = await prisma.newsArticle.findFirst({ where: { articleUrl } });
          if (!existing) {
            await prisma.newsArticle.create({
              data: {
                headline,
                articleUrl,
                sourceName,
                snippet: headline,
                sentiment,
                publishedAt: pubDate,
              }
            });
            count++;
          }
        }
      }
      return count;
    } catch (err) {
      console.warn('News crawler notice:', err);
      return 0;
    }
  }
}
