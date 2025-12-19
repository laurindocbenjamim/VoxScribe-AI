import React, { useState } from 'react';

interface RefinementInputModalProps {
  onConfirm: (observation: string) => void;
  onClose: () => void;
  title: string;
}

const RefinementInputModal: React.FC<RefinementInputModalProps> = ({ onConfirm, onClose, title }) => {
  const [observation, setObservation] = useState('');
  const maxLength = 250;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(observation);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-900 rounded-2xl w-full max-w-lg border border-slate-700 shadow-2xl p-6">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-xl font-bold text-white">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="text-slate-400 text-sm mb-4">
          Optionally add a specific observation, context, or instruction for the AI to consider while refining the text.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Observation / Context (Optional)
            </label>
            <textarea
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              maxLength={maxLength}
              rows={4}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none"
              placeholder="e.g., Focus on the medical terminology..."
            />
            <div className="text-right text-xs text-slate-500 mt-1">
              {observation.length} / {maxLength}
            </div>
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-lg shadow-blue-500/25 transition-colors"
            >
              Process
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RefinementInputModal;