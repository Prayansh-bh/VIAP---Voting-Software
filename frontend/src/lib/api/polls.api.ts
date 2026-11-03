import { apiFetch } from './client';

export interface PollOptionItem {
  id: string;
  text: string;
  order: number;
  votesCount?: number;
  percentage?: number;
}

export interface PollItem {
  id: string;
  title: string;
  description?: string;
  targetLevel?: string;
  status: 'DRAFT' | 'PUBLISHED' | 'CLOSED' | 'ARCHIVED';
  isExpired?: boolean;
  expiresAt?: string;
  options: PollOptionItem[];
  totalVotes: number;
  userVotedOptionId?: string | null;
  createdAt?: string;
}

export async function fetchPolls(): Promise<PollItem[]> {
  try {
    const res = await apiFetch<PollItem[]>('/api/polls');
    return Array.isArray(res) ? res : [];
  } catch (err) {
    console.warn('[Polls API] Failed to fetch polls:', err);
    return [];
  }
}

export async function submitPollVote(pollId: string, optionId: string): Promise<any> {
  return apiFetch(`/api/polls/${encodeURIComponent(pollId)}/vote`, {
    method: 'POST',
    body: JSON.stringify({ optionId }),
  });
}

export async function createPoll(data: {
  title: string;
  description?: string;
  targetLevel?: string;
  unitId?: string;
  expiresAt?: string;
  options: string[];
}): Promise<PollItem> {
  return apiFetch<PollItem>('/api/polls', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function closePoll(pollId: string): Promise<any> {
  return apiFetch(`/api/polls/${encodeURIComponent(pollId)}/close`, {
    method: 'PATCH',
  });
}

