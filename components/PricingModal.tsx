import React, { useEffect } from 'react';
import { CheckIcon, SparklesIcon, CreditCardIcon } from './Icons';
import { PlanTier } from '../types';

interface PricingModalProps {
  currentTier: PlanTier;
  onUpgrade: (tier: PlanTier) => void;
  onClose: () => void;
  isOnboarding?: boolean;
}

const PricingModal: React.FC<PricingModalProps> = ({ currentTier, onUpgrade, onClose, isOnboarding = false }) => {
  
  // Prevent closing if onboarding (optional, but good for forcing selection)
  const canClose = !isOnboarding;

  const handleSubscribe = (tier: PlanTier) => {
    let confirmMessage = "";
    
    if (tier === 'basic') {
      confirmMessage = "Confirm Basic Plan: You will be charged $0.00 today. You agree to be automatically charged $9.99/mo once you exceed the 10-minute test limit.";
    } else if (tier === 'advanced') {
      confirmMessage = "Proceed to Stripe Checkout for Advanced Plan (5-Day Free Trial)?";
    }

    if (window.confirm(confirmMessage)) {
       onUpgrade(tier);
       onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-900 rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto border border-slate-700 shadow-2xl relative">
        <div className="p-8">
          <div className="flex justify-between items-start mb-8">
             <div>
               <h2 className="text-3xl font-bold text-white mb-2">
                 {isOnboarding ? 'Choose Your Plan' : 'Upgrade Your Plan'}
               </h2>
               <p className="text-slate-400">
                 {isOnboarding ? 'Select a plan to start using VoxScribe AI.' : 'Choose the perfect plan for your transcription needs.'}
               </p>
             </div>
             {canClose && (
               <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
                 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
               </button>
             )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Free Plan */}
            <div className={`relative p-6 rounded-xl border ${currentTier === 'free' && !isOnboarding ? 'border-blue-500 bg-blue-500/10' : 'border-slate-700 bg-slate-800'} opacity-75 grayscale`}>
               <div className="mb-4">
                <h3 className="text-xl font-bold text-white">Free / Demo</h3>
                <div className="flex items-baseline mt-2">
                  <span className="text-3xl font-bold text-white">$0</span>
                </div>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center text-sm text-slate-300">
                  <CheckIcon className="w-4 h-4 mr-2 text-green-400" /> 2 Minutes Demo
                </li>
                <li className="flex items-center text-sm text-slate-500">
                   Limited Features
                </li>
              </ul>
              <button disabled className="w-full py-2 rounded-lg font-medium bg-slate-700 text-slate-400 cursor-not-allowed">
                 Not Available
              </button>
            </div>

            {/* Basic Plan (Default for Onboarding) */}
            <div className={`relative p-6 rounded-xl border-2 transform transition-all ${isOnboarding ? 'border-blue-500 bg-blue-900/20 scale-105 shadow-2xl shadow-blue-900/20 z-10' : (currentTier === 'basic' ? 'border-blue-500 bg-blue-500/10' : 'border-slate-700 bg-slate-800')}`}>
              {isOnboarding && (
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-3">
                  <span className="bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                    DEFAULT SELECTED
                  </span>
                </div>
              )}
              <div className="mb-4">
                <h3 className="text-xl font-bold text-white">Basic</h3>
                <div className="flex items-baseline mt-2">
                  <span className="text-3xl font-bold text-white">$0.00</span>
                  <span className="text-slate-400 ml-1">due today</span>
                </div>
                <p className="text-xs text-blue-300 mt-2 font-medium">
                  $9.99/mo automatically applied ONLY after reaching 10-minute limit.
                </p>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center text-sm text-slate-300">
                  <CheckIcon className="w-4 h-4 mr-2 text-green-400" /> 10 Mins Test Phase (Free)
                </li>
                <li className="flex items-center text-sm text-slate-300">
                  <CheckIcon className="w-4 h-4 mr-2 text-green-400" /> Auto-upgrade on limit
                </li>
                <li className="flex items-center text-sm text-slate-300">
                  <CheckIcon className="w-4 h-4 mr-2 text-green-400" /> High Quality Audio
                </li>
                <li className="flex items-center text-sm text-slate-500">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg> No Translation
                </li>
              </ul>

              {currentTier === 'basic' && !isOnboarding ? (
                 <button disabled className="w-full py-2 rounded-lg font-medium bg-blue-600/50 text-white cursor-default">Current Plan</button>
              ) : (
                 <div className="space-y-2">
                    <button onClick={() => handleSubscribe('basic')} className="w-full py-3 rounded-lg font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg transition-colors">
                      {isOnboarding ? 'Confirm & Start (Pay $0.00)' : 'Switch to Basic'}
                    </button>
                    <p className="text-[10px] text-slate-400 text-center leading-tight px-1">
                      By clicking above, you agree that you will be charged $9.99/mo automatically once your 10-minute test limit is exceeded.
                    </p>
                 </div>
              )}
            </div>

            {/* Advanced Plan */}
            <div className={`relative p-6 rounded-xl border ${currentTier === 'advanced' ? 'border-purple-500 bg-purple-500/10' : 'border-slate-700 bg-slate-800'}`}>
              <div className="mb-4">
                <h3 className="text-xl font-bold text-white flex items-center">
                  Advanced <SparklesIcon className="w-4 h-4 ml-2 text-purple-400" />
                </h3>
                <div className="flex items-baseline mt-2">
                  <span className="text-3xl font-bold text-white">$29.99</span>
                  <span className="text-slate-400 ml-1">/ month</span>
                </div>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center text-sm text-slate-300">
                  <CheckIcon className="w-4 h-4 mr-2 text-purple-400" /> 1000+ Minutes / Month
                </li>
                <li className="flex items-center text-sm text-slate-300">
                  <CheckIcon className="w-4 h-4 mr-2 text-purple-400" /> Multi-Language Translation
                </li>
                <li className="flex items-center text-sm text-slate-300">
                  <CheckIcon className="w-4 h-4 mr-2 text-purple-400" /> Priority Support
                </li>
                <li className="flex items-center text-sm text-slate-300">
                  <CheckIcon className="w-4 h-4 mr-2 text-purple-400" /> 5-Day Free Trial
                </li>
              </ul>
              {currentTier === 'advanced' ? (
                 <button disabled className="w-full py-2 rounded-lg font-medium bg-purple-600/50 text-white cursor-default">Current Plan</button>
              ) : (
                 <button onClick={() => handleSubscribe('advanced')} className="w-full py-2 rounded-lg font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 hover:border-slate-500 transition-all">
                   Select Advanced
                 </button>
              )}
              <div className="mt-3 text-center">
                <span className="text-xs text-slate-500 flex items-center justify-center">
                  <CreditCardIcon className="w-3 h-3 mr-1" /> Secured by Stripe
                </span>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default PricingModal;