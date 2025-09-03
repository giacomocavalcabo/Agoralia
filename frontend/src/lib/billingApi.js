/**
 * Billing API Client
 * Handles budget management and billing operations
 */

import { apiFetch } from "./api";

export const getBudget = async () => {
  const res = await apiFetch("/settings/billing/budget");
  return res; // { monthly_budget_cents, budget_currency, budget_hard_stop, mtd_spend_cents, minutes_mtd }
};

export const updateBudget = async (payload) => {
  return await apiFetch("/settings/billing/budget", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
};

/**
 * Get billing ledger entries (optional)
 * @param {Object} params - Query parameters
 * @param {number} params.page - Page number
 * @param {number} params.page_size - Page size
 * @returns {Promise<Object>} Paginated ledger entries
 */
export const getLedger = async ({ page = 1, page_size = 20 } = {}) => {
  try {
    const response = await apiFetch(`/settings/billing/ledger?page=${page}&page_size=${page_size}`)
    return response
  } catch (error) {
    console.error('Failed to fetch ledger:', error)
    throw error
  }
}

/**
 * Check if workspace is blocked due to budget
 * @returns {Promise<boolean>} True if blocked
 */
export const isBudgetBlocked = async () => {
  try {
    const budget = await getBudget()
    return budget.blocked === true
  } catch (error) {
    console.error('Failed to check budget status:', error)
    return false // Default to not blocked on error
  }
}

/**
 * Get budget warning level (0.8 = 80%, 1.0 = 100%)
 * @returns {Promise<number|null>} Warning threshold or null
 */
export const getBudgetWarningLevel = async () => {
  try {
    const budget = await getBudget()
    return budget.threshold_hit
  } catch (error) {
    console.error('Failed to get budget warning level:', error)
    return null
  }
}
