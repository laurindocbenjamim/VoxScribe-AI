import { User } from "../types";
import { activateDeveloperPlan } from "./subscriptionService";

const USER_STORAGE_KEY = 'voxscribe_user';

export const getCurrentUser = (): User | null => {
  const stored = localStorage.getItem(USER_STORAGE_KEY);
  return stored ? JSON.parse(stored) : null;
};

export const login = async (email: string, password: string): Promise<User> => {
  if (!email || !password) throw new Error("Email and password are required");

  // Developer Backdoor
  if (email === "feti@voxscribe.pt" && password === "V123#") {
    const devUser: User = {
      id: 'dev-admin-' + Date.now(),
      email: email,
      name: 'Developer Admin',
      isLoggedIn: true
    };
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(devUser));
    activateDeveloperPlan(); // Grant unlimited access
    return devUser;
  }

  // Mock login - allow any other email/password for prototype
  const user: User = {
    id: 'user-' + Date.now(),
    email,
    name: email.split('@')[0],
    isLoggedIn: true
  };
  
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  return user;
};

export const loginWithProvider = async (provider: 'google' | 'facebook'): Promise<User> => {
  // Mock Social Login
  const user: User = {
    id: `user-${provider}-` + Date.now(),
    email: `user@${provider}.com`,
    name: `${provider.charAt(0).toUpperCase() + provider.slice(1)} User`,
    isLoggedIn: true
  };
  
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  return user;
};

export const signup = async (email: string, password: string): Promise<User> => {
  // Mock signup - same as login for prototype
  return login(email, password);
};

export const logout = () => {
  localStorage.removeItem(USER_STORAGE_KEY);
  // Optional: Reset subscription on logout? For now, we leave local storage as is 
  // or we could reset it. To keep the app simple, we reload.
  window.location.reload(); 
};