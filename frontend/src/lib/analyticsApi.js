/**
 * Analytics API Client for Gamma
 * Handles timeseries, outcomes, and QA data
 */

import { api } from './api';

export const analyticsApi = {
  /**
   * Get timeseries data for charts
   */
  async fetchTimeseries(params = {}) {
    const searchParams = new URLSearchParams();
    
    if (params.days) searchParams.append('days', params.days);
    if (params.campaign_id) searchParams.append('campaign_id', params.campaign_id);
    if (params.agent_id) searchParams.append('agent_id', params.agent_id);
    if (params.lang) searchParams.append('lang', params.lang);
    if (params.country) searchParams.append('country', params.country);
    
    const response = await api.get(`/metrics/timeseries?${searchParams.toString()}`);
    return response.data;
  },

  /**
   * Get outcomes breakdown data
   */
  async fetchOutcomes(params = {}) {
    const searchParams = new URLSearchParams();
    
    if (params.days) searchParams.append('days', params.days);
    if (params.campaign_id) searchParams.append('campaign_id', params.campaign_id);
    if (params.agent_id) searchParams.append('agent_id', params.agent_id);
    if (params.lang) searchParams.append('lang', params.lang);
    if (params.country) searchParams.append('country', params.country);
    
    const response = await api.get(`/metrics/outcomes?${searchParams.toString()}`);
    return response.data;
  },

  /**
   * Get QA language metrics
   */
  async fetchQaLanguage(params = {}) {
    const searchParams = new URLSearchParams();
    
    if (params.days) searchParams.append('days', params.days);
    if (params.campaign_id) searchParams.append('campaign_id', params.campaign_id);
    if (params.agent_id) searchParams.append('agent_id', params.agent_id);
    
    const response = await api.get(`/metrics/qa/language?${searchParams.toString()}`);
    return response.data;
  },

  /**
   * Get AI cache statistics
   */
  async fetchAiCacheStats() {
    const response = await api.get('/analytics/ai-cache-stats');
    return response.data;
  },

  /**
   * Get shadow mode comparison data
   */
  async fetchShadowMode(params = {}) {
    const searchParams = new URLSearchParams();
    
    if (params.days) searchParams.append('days', params.days);
    if (params.campaign_id) searchParams.append('campaign_id', params.campaign_id);
    if (params.agent_id) searchParams.append('agent_id', params.agent_id);
    if (params.lang) searchParams.append('lang', params.lang);
    if (params.country) searchParams.append('country', params.country);
    
    const response = await api.get(`/metrics/shadow?${searchParams.toString()}`);
    return response.data;
  },

  /**
   * Get overview metrics (extended with Gamma data)
   */
  async fetchOverview(params = {}) {
    const searchParams = new URLSearchParams();
    
    if (params.days) searchParams.append('days', params.days);
    if (params.campaign_id) searchParams.append('campaign_id', params.campaign_id);
    if (params.agent_id) searchParams.append('agent_id', params.agent_id);
    if (params.lang) searchParams.append('lang', params.lang);
    if (params.country) searchParams.append('country', params.country);
    
    const response = await api.get(`/metrics/overview?${searchParams.toString()}`);
    return response.data;
  }
};

/**
 * React Query keys for analytics
 */
export const analyticsKeys = {
  all: ['analytics'],
  overview: (params) => [...analyticsKeys.all, 'overview', params],
  timeseries: (params) => [...analyticsKeys.all, 'timeseries', params],
  outcomes: (params) => [...analyticsKeys.all, 'outcomes', params],
  qaLanguage: (params) => [...analyticsKeys.all, 'qa-language', params],
  aiCacheStats: () => [...analyticsKeys.all, 'ai-cache-stats'],
  shadowMode: (params) => [...analyticsKeys.all, 'shadow-mode', params]
};
