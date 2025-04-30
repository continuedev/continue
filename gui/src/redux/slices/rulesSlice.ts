import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../store';

interface RulesState {
  // Map ruleId to boolean indicating if rule is enabled
  enabledRules: Record<string, boolean>;
}

const initialState: RulesState = {
  enabledRules: {},
};

// Helper to generate consistent rule IDs
export function generateRuleId(rule: any): string {
  // Use slug if available, otherwise use a combination of source and content hash
  if (rule.slug) {
    return `slug:${rule.slug}`;
  } else if (rule.ruleFile) {
    return `file:${rule.ruleFile}`;
  } else {
    // Create a simple hash from the rule text to use as identifier
    const hash = rule.rule
      ? Math.abs(
          rule.rule.slice(0, 100).split('').reduce((a: number, b: string) => {
            a = (a << 5) - a + b.charCodeAt(0);
            return a & a;
          }, 0)
        ).toString(16)
      : Date.now().toString(16);
    
    return `${rule.source || 'unknown'}:${hash}`;
  }
}

export const rulesSlice = createSlice({
  name: 'rules',
  initialState,
  reducers: {
    toggleRule: (state, action: PayloadAction<{ ruleId: string; enabled: boolean }>) => {
      const { ruleId, enabled } = action.payload;
      state.enabledRules[ruleId] = enabled;
    },
    
    // Reset all rules to enabled
    resetRules: (state) => {
      state.enabledRules = {};
    },
    
    // Initialize a rule (if not already in state)
    initializeRule: (state, action: PayloadAction<string>) => {
      const ruleId = action.payload;
      if (state.enabledRules[ruleId] === undefined) {
        state.enabledRules[ruleId] = true; // Default to enabled
      }
    },
    
    // Bulk initialize multiple rules
    initializeRules: (state, action: PayloadAction<string[]>) => {
      action.payload.forEach(ruleId => {
        if (state.enabledRules[ruleId] === undefined) {
          state.enabledRules[ruleId] = true;
        }
      });
    },
  },
});

export const { toggleRule, resetRules, initializeRule, initializeRules } = rulesSlice.actions;

// Selector to check if a rule is enabled (defaulting to true if not in state)
export const selectRuleEnabled = (state: RootState, ruleId: string): boolean => 
  state.rules.enabledRules[ruleId] !== undefined ? state.rules.enabledRules[ruleId] : true;

export default rulesSlice.reducer;