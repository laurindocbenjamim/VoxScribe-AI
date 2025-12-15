import { PlanTier, SubscriptionState } from "../types";

const STORAGE_KEY = 'voxscribe_subscription';

const DEFAULT_STATE: SubscriptionState = {
  tier: 'free',
  minutesUsed: 0,
  maxMinutes: 30, // Updated: 30 minutes limit for normal/free users
  canTranslate: false,
};

export const getSubscription = (): SubscriptionState => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    const parsed = JSON.parse(stored);
    // Migration logic: If existing user has the old 10 min limit on free tier, upgrade them to 30
    if (parsed.tier === 'free' && parsed.maxMinutes < 30) {
        const upgraded = { ...parsed, maxMinutes: 30 };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(upgraded));
        return upgraded;
    }
    return parsed;
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
      maxMinutes: 120, // Upgrade to 2 hours
      canTranslate: false,
    };
  } else if (tier === 'advanced') {
    newState = {
      ...current,
      tier: 'advanced',
      maxMinutes: 1000, // Upgrade to ~16 hours
      canTranslate: true,
    };
  } else {
    newState = DEFAULT_STATE;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
  return newState;
};

export const activateDeveloperPlan = (): SubscriptionState => {
  const devState: SubscriptionState = {
    tier: 'advanced', // Uses advanced UI features
    minutesUsed: 0,
    maxMinutes: 999999999, // Effectively unlimited
    canTranslate: true,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(devState));
  return devState;
};

export const checkLimits = (current: SubscriptionState, requestedSeconds: number): boolean => {
  // If user has virtually unlimited minutes (Developer), always return true
  if (current.maxMinutes > 1000000) return true;

  const requestedMinutes = requestedSeconds / 60;
  return (current.minutesUsed + requestedMinutes) <= current.maxMinutes;
};