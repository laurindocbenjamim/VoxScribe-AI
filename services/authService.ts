import { User } from "../types";

const USER_STORAGE_KEY = 'voxscribe_user';

export const getCurrentUser = (): User | null => {
  const stored = localStorage.getItem(USER_STORAGE_KEY);
  return stored ? JSON.parse(stored) : null;
};

export const login = async (email: string, password: string): Promise<User> => {
  // Mock login - allow any email/password for prototype
  if (!email || !password) throw new Error("Email and password are required");
  
  const user: User = {
    id: 'user-' + Date.now(),
    email,
    name: email.split('@')[0],
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
  window.location.reload(); // Simple reload to reset app state
};