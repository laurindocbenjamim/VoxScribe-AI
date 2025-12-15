import React, { useState } from 'react';
import { GoogleIcon, FacebookIcon } from './Icons';

interface AuthModalProps {
  onLogin: () => void;
  onSignup: () => void;
  onSocialLogin: (provider: 'google' | 'facebook') => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ onLogin, onSignup, onSocialLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Simulate network delay
    setTimeout(() => {
      setLoading(false);
      if (isLogin) {
        onLogin();
      } else {
        onSignup();
      }
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
      <div className="bg-slate-900 rounded-2xl w-full max-w-md border border-slate-700 shadow-2xl p-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent mb-2">
            VoxScribe AI
          </h2>
          <p className="text-slate-400">
            {isLogin ? 'Welcome back! Please login.' : 'Create an account to get started.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
            <input 
              type="email" 
              required 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Password</label>
            <input 
              type="password" 
              required 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="••••••••"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-3 rounded-lg font-bold text-white bg-blue-600 hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              isLogin ? 'Login' : 'Sign Up'
            )}
          </button>
        </form>
        
        <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-slate-900 text-slate-500">Or continue with</span>
            </div>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
            <button 
                onClick={() => onSocialLogin('google')}
                className="flex items-center justify-center space-x-2 py-2.5 border border-slate-600 rounded-lg hover:bg-slate-800 transition-colors bg-white text-slate-900"
            >
                <GoogleIcon className="w-5 h-5" />
                <span className="font-medium text-sm">Google</span>
            </button>
            <button 
                onClick={() => onSocialLogin('facebook')}
                className="flex items-center justify-center space-x-2 py-2.5 border border-slate-600 rounded-lg hover:bg-[#1877F2]/90 transition-colors bg-[#1877F2] text-white"
            >
                <FacebookIcon className="w-5 h-5 text-white" />
                <span className="font-medium text-sm">Facebook</span>
            </button>
        </div>

        <div className="mt-6 text-center text-sm text-slate-400">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="text-blue-400 hover:text-blue-300 font-medium ml-1"
          >
            {isLogin ? 'Sign up' : 'Login'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;