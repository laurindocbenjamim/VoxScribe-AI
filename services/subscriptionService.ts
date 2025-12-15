import { PlanTier, SubscriptionState } from "../types";

const STORAGE_KEY = 'voxscribe_subscription';

const DEFAULT_STATE: SubscriptionState = {
  tier: 'free',
  minutesUsed: 0,
  maxMinutes: 10, // 10 minutes free trial for new users
  canTranslate: false,
};

export const getSubscription = (): SubscriptionState => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    return JSON.parse(stored);
  }
  // Initialize for new user
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_STATE));
  return DEFAULT_STATE;
};

export const addUsageMinutes = (seconds: number): SubscriptionState => {
  const current = getSubscription();
  const minutesToAdd = seconds / 60;
  
  const newState = {
    ...current,
    minutesUsed: current.minutesUsed + minutesToAdd
  };
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
  return newState;
};

// Mock function to simulate a Stripe checkout flow completion
export const upgradePlan = (tier: PlanTier): SubscriptionState => {
  const current = getSubscription();
  let newState: SubscriptionState;

  if (tier === 'basic') {
    newState = {
      ...current,
      tier: 'basic',
      maxMinutes: 300,
      canTranslate: false,
    };
  } else if (tier === 'advanced') {
    newState = {
      ...current,
      tier: 'advanced',
      maxMinutes: 1000,
      canTranslate: true,
    };
  } else {
    newState = DEFAULT_STATE;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
  return newState;
};

export const checkLimits = (current: SubscriptionState, requestedSeconds: number): boolean => {
  const requestedMinutes = requestedSeconds / 60;
  return (current.minutesUsed + requestedMinutes) <= current.maxMinutes;
};