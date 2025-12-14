import React, { useEffect, useRef, useState } from 'react';
import { DownloadIcon } from './Icons';

interface MindMapModalProps {
  mermaidCode: string;
  onClose: () => void;
}

const MindMapModal: React.FC<MindMapModalProps> = ({ mermaidCode, onClose }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [renderError, setRenderError] = useState<string | null>(null);

  useEffect(() => {
    const renderMap = async () => {
      if (!containerRef.current || !mermaidCode) return;
      
      try {
        const mermaid = (window as any).mermaid;
        if (!mermaid) {
            setRenderError("Mermaid library not loaded.");
            return;
        }

        // Clear previous content
        containerRef.current.innerHTML = '';
        
        // Generate unique ID for this render
        const id = `mermaid-${Math.floor(Math.random() * 10000)}`;
        
        // Use mermaid API to render
        const { svg } = await mermaid.render(id, mermaidCode);
        containerRef.current.innerHTML = svg;
      } catch (err: any) {
        console.error("Mermaid Render Error", err);
        setRenderError("Failed to render mind map syntax. The text might be too complex or unstructured.");
      }
    };

    renderMap();
  }, [mermaidCode]);

  const handleDownload = () => {
    if (!containerRef.current) return;
    
    const svgElement = containerRef.current.querySelector('svg');
    if (!svgElement) return;

    // Get the SVG content
    const svgData = new XMLSerializer().serializeToString(svgElement);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `mindmap-${new Date().getTime()}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
      <div className="bg-slate-900 rounded-2xl w-full max-w-6xl h-[85vh] flex flex-col border border-slate-700 shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-slate-700 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white">Concept Map</h2>
          <div className="flex items-center space-x-4">
             <button 
                onClick={handleDownload}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
             >
                <DownloadIcon className="w-4 h-4" />
                <span>Download Map</span>
             </button>
             <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
             </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-8 bg-slate-950 flex items-center justify-center relative">
          {renderError ? (
            <div className="text-center text-red-400">
                <p className="mb-2 text-xl font-semibold">Visualization Error</p>
                <p>{renderError}</p>
            </div>
          ) : (
             <div ref={containerRef} className="w-full h-full flex items-center justify-center [&>svg]:max-w-full [&>svg]:max-h-full [&>svg]:w-auto [&>svg]:h-auto" />
          )}
        </div>
      </div>
    </div>
  );
};

export default MindMapModal;