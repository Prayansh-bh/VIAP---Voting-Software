import { useCallback, useEffect, useState } from 'react';
import {
  fetchCurrentUser,
  fetchHierarchyAnalytics,
  fetchNewsArticles,
  fetchNotifications,
  fetchSocialTrends,
  fetchTasks,
  fetchTrainingVideos,
  fetchVoters,
  HierarchyAnalyticsResponse,
  markNotVoted,
  markVoteDone,
  PaginatedVotersResponse,
  updateTaskStatus,
  updateTrainingProgress,
  VoterQueryParams,
} from '../lib/api';
import { GroundReport, TrainingVideo, Voter, VoterTask } from '../types';
import { useCms } from '../context/CmsContext';
import { getAuthToken } from '../lib/authStorage';

// ----------------------------------------------------------------------------
// 1. useCurrentUser() & useAuth()
// ----------------------------------------------------------------------------
export function useCurrentUser() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!getAuthToken()) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await fetchCurrentUser();
      setUser(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { user, loading, error, reload };
}

// ----------------------------------------------------------------------------
// 2. useVoters(params)
// ----------------------------------------------------------------------------
export function useVoters(initialParams: VoterQueryParams = {}) {
  const [params, setParams] = useState<VoterQueryParams>(initialParams);
  const [data, setData] = useState<PaginatedVotersResponse>({
    items: [],
    total: 0,
    page: 1,
    limit: 50,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadVoters = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetchVoters(params);
      setData(res);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load voters');
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    void loadVoters();
  }, [loadVoters]);

  // Optimistic vote status update
  const toggleVote = async (voterId: string, currentStatus: string) => {
    const isVoted = currentStatus === 'VOTE_DONE';
    const nextStatus = isVoted ? 'NOT_VOTED' : 'VOTE_DONE';

    // Optimistic local update
    setData((prev) => ({
      ...prev,
      items: prev.items.map((v) =>
        v.id === voterId
          ? {
              ...v,
              voteStatus: nextStatus as any,
              voteDoneTime: nextStatus === 'VOTE_DONE' ? new Date().toLocaleTimeString() : undefined,
            }
          : v,
      ),
    }));

    try {
      if (isVoted) {
        await markNotVoted(voterId);
      } else {
        await markVoteDone(voterId);
      }
    } catch (err) {
      // Rollback on failure
      void loadVoters();
    }
  };

  return {
    voters: data.items,
    total: data.total,
    page: data.page,
    limit: data.limit,
    totalPages: data.totalPages,
    hasNextPage: data.hasNextPage,
    hasPrevPage: data.hasPrevPage,
    loading,
    error,
    params,
    setParams,
    reload: loadVoters,
    toggleVote,
  };
}

// ----------------------------------------------------------------------------
// 3. useAnalytics(level, id)
// ----------------------------------------------------------------------------
export function useAnalytics(level: string, id?: string) {
  const [data, setData] = useState<HierarchyAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAnalytics = useCallback(async () => {
    if (!id && level.toLowerCase() !== 'state') return;

    try {
      setLoading(true);
      const res = await fetchHierarchyAnalytics(level, id || 'state');
      setData(res);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to compute analytics');
    } finally {
      setLoading(false);
    }
  }, [level, id]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  return { analytics: data, loading, error, reload: loadAnalytics };
}

// ----------------------------------------------------------------------------
// 4. useTasks(query)
// ----------------------------------------------------------------------------
export function useTasks(query: any = {}) {
  const [tasks, setTasks] = useState<VoterTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      const items = await fetchTasks(query);
      setTasks(items);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(query)]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  const updateStatus = async (taskId: string, status: string, comments?: string) => {
    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: status as any } : t)),
    );

    try {
      await updateTaskStatus(taskId, status, comments);
    } catch (err) {
      void loadTasks();
    }
  };

  return { tasks, loading, error, reload: loadTasks, updateStatus };
}

// ----------------------------------------------------------------------------
// 5. useTraining()
// ----------------------------------------------------------------------------
export function useTraining() {
  const [videos, setVideos] = useState<TrainingVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTraining = useCallback(async () => {
    try {
      setLoading(true);
      const items = await fetchTrainingVideos();
      setVideos(items);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load training videos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTraining();
  }, [loadTraining]);

  const updateProgress = async (videoId: string, status: string, score?: number) => {
    setVideos((prev) =>
      prev.map((v) => (v.id === videoId ? { ...v, status: status as any, quizScore: score } : v)),
    );
    try {
      await updateTrainingProgress(videoId, status, score);
    } catch {
      void loadTraining();
    }
  };

  return { videos, loading, error, reload: loadTraining, updateProgress };
}

// ----------------------------------------------------------------------------
// 6. useNotifications()
// ----------------------------------------------------------------------------
export function useNotifications() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const loadNotifications = useCallback(async () => {
    if (!getAuthToken()) return;
    try {
      setLoading(true);
      const data = await fetchNotifications();
      setNotifications(data.items);
      setUnreadCount(data.unreadCount);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  return { notifications, unreadCount, loading, reload: loadNotifications };
}

// Re-export useCMS
export { useCms } from '../context/CmsContext';
