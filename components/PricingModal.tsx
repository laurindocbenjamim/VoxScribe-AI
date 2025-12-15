import React from 'react';
import { CheckIcon, SparklesIcon, CreditCardIcon } from './Icons';
import { PlanTier } from '../types';

interface PricingModalProps {
  currentTier: PlanTier;
  onUpgrade: (tier: PlanTier) => void;
  onClose: () => void;
}

const PricingModal: React.FC<PricingModalProps> = ({ currentTier, onUpgrade, onClose }) => {
  const handleSubscribe = (tier: PlanTier) => {
    // In a real app, this would redirect to Stripe Checkout
    // window.location.href = '/api/create-checkout-session?price_id=...';
    
    const confirmMessage = tier === 'advanced' 
      ? "Proceed to Stripe Checkout for Advanced Plan (5-Day Free Trial)?" 
      : "Proceed to Stripe Checkout for Basic Plan?";
      
    if (window.confirm(confirmMessage)) {
       onUpgrade(tier);
       onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-900 rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto border border-slate-700 shadow-2xl">
        <div className="p-8">
          <div className="flex justify-between items-start mb-8">
             <div>
               <h2 className="text-3xl font-bold text-white mb-2">Upgrade Your Plan</h2>
               <p className="text-slate-400">Choose the perfect plan for your transcription needs.</p>
             </div>
             <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
             </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Free Plan */}
            <div className={`relative p-6 rounded-xl border ${currentTier === 'free' ? 'border-blue-500 bg-blue-500/10' : 'border-slate-700 bg-slate-800'}`}>
              <div className="mb-4">
                <h3 className="text-xl font-bold text-white">Free Trial</h3>
                <div className="flex items-baseline mt-2">
                  <span className="text-3xl font-bold text-white">$0</span>
                  <span className="text-slate-400 ml-1">/ forever</span>
                </div>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center text-sm text-slate-300">
                  <CheckIcon className="w-4 h-4 mr-2 text-green-400" /> 10 Minutes Total
                </li>
                <li className="flex items-center text-sm text-slate-300">
                  <CheckIcon className="w-4 h-4 mr-2 text-green-400" /> Basic Transcription
                </li>
                <li className="flex items-center text-sm text-slate-500">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg> No Translation
                </li>
              </ul>
              <button disabled={true} className="w-full py-2 rounded-lg font-medium bg-slate-700 text-slate-400 cursor-default">
                {currentTier === 'free' ? 'Current Plan' : 'Included'}
              </button>
            </div>

            {/* Basic Plan */}
            <div className={`relative p-6 rounded-xl border ${currentTier === 'basic' ? 'border-blue-500 bg-blue-500/10' : 'border-slate-700 bg-slate-800'}`}>
              <div className="mb-4">
                <h3 className="text-xl font-bold text-white">Basic</h3>
                <div className="flex items-baseline mt-2">
                  <span className="text-3xl font-bold text-white">$9.99</span>
                  <span className="text-slate-400 ml-1">/ month</span>
                </div>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center text-sm text-slate-300">
                  <CheckIcon className="w-4 h-4 mr-2 text-green-400" /> 300 Minutes / Month
                </li>
                <li className="flex items-center text-sm text-slate-300">
                  <CheckIcon className="w-4 h-4 mr-2 text-green-400" /> High Quality Audio
                </li>
                <li className="flex items-center text-sm text-slate-500">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg> No Translation
                </li>
              </ul>
              {currentTier === 'basic' ? (
                 <button disabled className="w-full py-2 rounded-lg font-medium bg-blue-600/50 text-white cursor-default">Current Plan</button>
              ) : (
                 <button onClick={() => handleSubscribe('basic')} className="w-full py-2 rounded-lg font-medium bg-slate-100 hover:bg-white text-slate-900 transition-colors">
                   Subscribe
                 </button>
              )}
            </div>

            {/* Advanced Plan */}
            <div className={`relative p-6 rounded-xl border ${currentTier === 'advanced' ? 'border-purple-500 bg-purple-500/10' : 'border-slate-700 bg-slate-800'}`}>
              <div className="absolute top-0 right-0 transform translate-x-2 -translate-y-2">
                <span className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                  RECOMMENDED
                </span>
              </div>
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
                 <button onClick={() => handleSubscribe('advanced')} className="w-full py-2 rounded-lg font-medium bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-lg transition-all transform hover:scale-[1.02]">
                   Start 5-Day Free Trial
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