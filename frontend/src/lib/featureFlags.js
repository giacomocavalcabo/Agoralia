/**
 * Feature Flags Configuration
 * Centralized feature flag management
 */

// Environment-based feature flags
export const featureFlags = {
  // Gamma Analytics
  ANALYTICS_GAMMA: import.meta.env.VITE_ANALYTICS_GAMMA === 'true',
  
  // Shadow Mode
  SHADOW_MODE: import.meta.env.VITE_SHADOW_MODE === 'true',
  
  // AI Objection Classification
  AI_OBJECTIONS: import.meta.env.VITE_AI_OBJECTIONS === 'true',
  
  // Retell Integration
  RETELL_INTEGRATION: import.meta.env.VITE_RETELL_INTEGRATION === 'true',
};

/**
 * Check if a feature is enabled
 */
export function isFeatureEnabled(feature) {
  return featureFlags[feature] === true;
}

/**
 * Get all enabled features
 */
export function getEnabledFeatures() {
  return Object.entries(featureFlags)
    .filter(([_, enabled]) => enabled)
    .map(([feature]) => feature);
}

/**
 * Feature flag descriptions for UI
 */
export const featureDescriptions = {
  ANALYTICS_GAMMA: {
    name: "Gamma Analytics",
    description: "Advanced analytics with real data integration",
    status: featureFlags.ANALYTICS_GAMMA ? "enabled" : "disabled"
  },
  SHADOW_MODE: {
    name: "Shadow Mode",
    description: "Compare real vs mock data without exposing it",
    status: featureFlags.SHADOW_MODE ? "enabled" : "disabled"
  },
  AI_OBJECTIONS: {
    name: "AI Objection Classification",
    description: "AI-powered call objection analysis",
    status: featureFlags.AI_OBJECTIONS ? "enabled" : "disabled"
  },
  RETELL_INTEGRATION: {
    name: "Retell Integration",
    description: "Real-time call data from Retell",
    status: featureFlags.RETELL_INTEGRATION ? "enabled" : "disabled"
  }
};

/**
 * Development helper: toggle features in console
 */
if (import.meta.env.DEV) {
  window.featureFlags = featureFlags;
  window.toggleFeature = (feature) => {
    if (featureFlags.hasOwnProperty(feature)) {
      featureFlags[feature] = !featureFlags[feature];
      console.log(`${feature}: ${featureFlags[feature] ? 'enabled' : 'disabled'}`);
      return featureFlags[feature];
    }
    console.error(`Unknown feature: ${feature}`);
    return null;
  };
}
