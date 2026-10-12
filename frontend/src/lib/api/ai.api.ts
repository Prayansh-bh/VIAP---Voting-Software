import { apiFetch } from './client';

export async function fetchAiInsights(constituencyId?: string): Promise<any[]> {
  const endpoint = constituencyId ? `/api/ai/insights?constituencyId=${constituencyId}` : '/api/ai/insights';
  return apiFetch<any[]>(endpoint);
}

export async function fetchNewsArticles(): Promise<any[]> {
  return apiFetch<any[]>('/api/ai/news');
}

export async function fetchSocialTrends(): Promise<any[]> {
  return apiFetch<any[]>('/api/ai/social-trends');
}

export async function fetchElectionProjections(constituencyId?: string): Promise<any[]> {
  const endpoint = constituencyId ? `/api/ai/projections?constituencyId=${constituencyId}` : '/api/ai/projections';
  return apiFetch<any[]>(endpoint);
}

export async function askAiStrategy(unitId: string, prompt: string): Promise<{ answer: string; provider: string; context: any }> {
  return apiFetch<{ answer: string; provider: string; context: any }>('/api/ai/query', {
    method: 'POST',
    body: JSON.stringify({ unitId, prompt }),
  });
}
