import React, { useState, useEffect, useRef } from 'react';
import { SpeakerIcon, DownloadIcon, CopyIcon, MapIcon, EyeIcon, EyeOffIcon, RefreshIcon, PdfIcon } from './Icons';
import * as docx from "docx";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

interface RefinementModalProps {
  originalText: string;
  refinedText: string;
  title?: string;
  onClose: () => void;
  onPlay: (text: string) => void;
  onDownloadAudio: (text: string) => void;
  onCopy: (text: string) => void;
  onVisualize: (text: string) => void;
  onRegenerate: () => void;
  isRegenerating: boolean;
  isPlaying: boolean;
  isGeneratingAudio: boolean;
}

const RefinementModal: React.FC<RefinementModalProps> = ({ 
  originalText, 
  refinedText, 
  title = "Refined Transcript",
  onClose,
  onPlay,
  onDownloadAudio,
  onCopy,
  onVisualize,
  onRegenerate,
  isRegenerating,
  isPlaying,
  isGeneratingAudio
}) => {
  const [showOriginal, setShowOriginal] = useState(true);
  const editorRef = useRef<HTMLDivElement>(null);
  
  // Track colors for the toolbar inputs
  const [foreColor, setForeColor] = useState("#000000");
  const [hiliteColor, setHiliteColor] = useState("#ffffff");

  // Initialize editor content
  useEffect(() => {
    if (editorRef.current && refinedText) {
        const html = renderContentToHtmlString(refinedText);
        editorRef.current.innerHTML = html;
    }
  }, [refinedText]);

  // Helper to parse Markdown-like content into stylized HTML for the "Editor" view
  const renderContentToHtmlString = (text: string) => {
    let safeText = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    // Headers
    safeText = safeText.replace(/^# (.*$)/gim, '<h1 style="font-size: 24pt; font-weight: bold; margin-top: 24px; margin-bottom: 12px; border-bottom: 1px solid #475569;">$1</h1>');
    safeText = safeText.replace(/^## (.*$)/gim, '<h2 style="font-size: 18pt; font-weight: bold; margin-top: 18px; margin-bottom: 12px;">$1</h2>');
    safeText = safeText.replace(/^### (.*$)/gim, '<h3 style="font-size: 14pt; font-weight: bold; margin-top: 14px; margin-bottom: 8px;">$1</h3>');

    // Bold, Italic
    safeText = safeText.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
    safeText = safeText.replace(/\*(.*?)\*/g, '<i>$1</i>');

    // Links
    safeText = safeText.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" style="color: #60a5fa; text-decoration: underline;">$1</a>');

    // Citations
    safeText = safeText.replace(/(\[\d+\])/g, '<span style="color: #34d399; font-weight: bold;">$1</span>');

    // Paragraphs
    const paragraphs = safeText.split(/\n\n/);
    return paragraphs.map(p => {
        if (p.trim().startsWith('<h')) return p;
        return `<p style="margin-bottom: 1em;">${p.replace(/\n/g, '<br/>')}</p>`;
    }).join('');
  };

  // --- Formatting Toolbar Functions ---
  const execCmd = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    if (editorRef.current) editorRef.current.focus();
  };

  const handleDownloadPdf = async () => {
    if (!editorRef.current) return;
    
    // Use jsPDF html method which relies on html2canvas
    const doc = new jsPDF({
        orientation: 'p',
        unit: 'pt',
        format: 'letter'
    });

    // Provide html2canvas explicitly to window for jspdf to find if module loading is quirky, 
    // though usually ESM imports work fine if passed in options or globally available.
    // ESM build of jspdf typically includes the html method but needs html2canvas dependency.
    
    // We will use the callback approach.
    const margin = 36; // 0.5 inch
    
    // Note: The 'html' method is async.
    await doc.html(editorRef.current, {
        callback: function(doc) {
            doc.save('Scientific_IEEE_Report.pdf');
        },
        x: margin,
        y: margin,
        width: 612 - (margin * 2), // Letter width minus margins
        windowWidth: 816 // Scale down from screen pixels to points approx
    });
  };

  const handleDownloadDocx = async () => {
    if (!editorRef.current) return;
  
    // Recursively parse DOM to Docx
    // Explicitly cast to ChildNode[] to prevent TS inference as unknown[]
    const children = Array.from(editorRef.current.childNodes) as ChildNode[];
    const docChildren: (docx.Paragraph | docx.Table)[] = [];

    const parseNode = (node: ChildNode, styles: { bold?: boolean, italics?: boolean, underline?: boolean, color?: string, background?: string, size?: number, font?: string } = {}): docx.TextRun[] => {
        const runs: docx.TextRun[] = [];
        
        if (node.nodeType === Node.TEXT_NODE) {
            if (node.textContent) {
                runs.push(new docx.TextRun({
                    text: node.textContent,
                    bold: styles.bold,
                    italics: styles.italics,
                    underline: styles.underline ? { type: docx.UnderlineType.SINGLE } : undefined,
                    color: styles.color ? styles.color.replace('#', '') : undefined,
                    shading: styles.background ? { type: docx.ShadingType.CLEAR, fill: styles.background.replace('#', '') } : undefined,
                    size: styles.size ? styles.size * 2 : 24, // Half-points
                    font: styles.font || "Times New Roman"
                }));
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as HTMLElement;
            const newStyles = { ...styles };
            
            // Map CSS/Tags to styles
            if (el.tagName === 'B' || el.tagName === 'STRONG' || el.style.fontWeight === 'bold') newStyles.bold = true;
            if (el.tagName === 'I' || el.tagName === 'EM' || el.style.fontStyle === 'italic') newStyles.italics = true;
            if (el.tagName === 'U' || el.style.textDecoration.includes('underline')) newStyles.underline = true;
            
            // Colors from style attribute
            if (el.style.color) {
                // Convert basic color names or RGB to hex if needed, 
                // but for now we assume the picker gives hex or simple values.
                // Docx expects hex without #.
                // Simple workaround for this demo: only take it if it looks like a hex or handle externally
                // We mainly rely on the <font> tag logic below for execCommand results
            }
            
            // Font tag handling (execCommand legacy)
            if (el.tagName === 'FONT') {
                // Cast to any to access deprecated attributes safely in TS
                const fontEl = el as any; 
                if (fontEl.color) newStyles.color = fontEl.color;
                if (fontEl.face) newStyles.font = fontEl.face;
                if (fontEl.size) {
                    const sizes = [10, 13, 16, 18, 24, 32, 48];
                    const sizeIndex = parseInt(fontEl.size) - 1;
                    newStyles.size = sizes[sizeIndex] || 12;
                }
            }

            // Recursion
            el.childNodes.forEach(child => {
                runs.push(...parseNode(child, newStyles));
            });
        }
        return runs;
    };

    children.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as HTMLElement;
            let headingLevel: any = undefined;
            
            if (el.tagName === 'H1') headingLevel = docx.HeadingLevel.HEADING_1;
            if (el.tagName === 'H2') headingLevel = docx.HeadingLevel.HEADING_2;
            if (el.tagName === 'H3') headingLevel = docx.HeadingLevel.HEADING_3;

            const runs = parseNode(node);
            
            docChildren.push(new docx.Paragraph({
                children: runs,
                heading: headingLevel,
                spacing: { after: 200 }
            }));
        } else if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
            // Loose text at root
             docChildren.push(new docx.Paragraph({
                children: [new docx.TextRun({ text: node.textContent, font: "Times New Roman", size: 24 })],
                spacing: { after: 200 }
            }));
        }
    });

    const doc = new docx.Document({
        sections: [{
            properties: {},
            children: docChildren,
        }],
    });

    const blob = await docx.Packer.toBlob(doc);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "Scientific_IEEE_Report.docx";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
      <div className="bg-slate-900 rounded-2xl w-full max-w-6xl max-h-[95vh] flex flex-col border border-slate-700 shadow-2xl transition-all duration-300">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900 rounded-t-2xl shrink-0">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center">
                {title}
                <span className="ml-3 px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-xs border border-blue-500/50">
                    AI Enhanced
                </span>
            </h2>
          </div>
          <div className="flex items-center space-x-2">
             <button onClick={onRegenerate} disabled={isRegenerating} className={`flex items-center space-x-2 text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 ${isRegenerating ? 'opacity-50' : ''}`} title="Regenerate">
                <RefreshIcon className={`w-4 h-4 ${isRegenerating ? 'animate-spin' : ''}`} />
                <span className="text-sm hidden sm:inline">Regenerate</span>
            </button>
             <button onClick={() => setShowOriginal(!showOriginal)} className="flex items-center space-x-2 text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800">
                {showOriginal ? <EyeOffIcon className="w-4 h-4"/> : <EyeIcon className="w-4 h-4"/>}
                <span className="text-sm hidden sm:inline">{showOriginal ? 'Hide Original' : 'Show Original'}</span>
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-white ml-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="bg-slate-800 border-b border-slate-700 p-2 flex flex-wrap items-center gap-2 shrink-0">
            {/* Font Style */}
            <div className="flex items-center bg-slate-900 rounded-lg p-1 border border-slate-700">
                <button onClick={() => execCmd('bold')} className="p-1.5 hover:bg-slate-700 rounded text-slate-300 hover:text-white font-bold" title="Bold">B</button>
                <button onClick={() => execCmd('italic')} className="p-1.5 hover:bg-slate-700 rounded text-slate-300 hover:text-white italic" title="Italic">I</button>
                <button onClick={() => execCmd('underline')} className="p-1.5 hover:bg-slate-700 rounded text-slate-300 hover:text-white underline" title="Underline">U</button>
            </div>

            {/* Font Family & Size */}
            <div className="flex items-center bg-slate-900 rounded-lg p-1 border border-slate-700 gap-2">
                <select onChange={(e) => execCmd('fontName', e.target.value)} className="bg-transparent text-xs text-slate-300 focus:outline-none w-24">
                    <option value="Times New Roman">Times New Roman</option>
                    <option value="Arial">Arial</option>
                    <option value="Verdana">Verdana</option>
                    <option value="Courier New">Courier New</option>
                    <option value="Inter">Inter</option>
                </select>
                <div className="w-px h-4 bg-slate-700"></div>
                <select onChange={(e) => execCmd('fontSize', e.target.value)} className="bg-transparent text-xs text-slate-300 focus:outline-none">
                    <option value="3">Normal</option>
                    <option value="1">Small</option>
                    <option value="5">Large</option>
                    <option value="7">Huge</option>
                </select>
            </div>

            {/* Colors */}
            <div className="flex items-center bg-slate-900 rounded-lg p-1 border border-slate-700 gap-2">
                <div className="flex items-center space-x-1" title="Text Color">
                    <span className="text-xs text-slate-400 font-bold px-1">A</span>
                    <input type="color" value={foreColor} onChange={(e) => { setForeColor(e.target.value); execCmd('foreColor', e.target.value); }} className="w-6 h-6 bg-transparent cursor-pointer border-none p-0" />
                </div>
                <div className="w-px h-4 bg-slate-700"></div>
                <div className="flex items-center space-x-1" title="Highlight Color">
                    <span className="text-xs bg-yellow-200 text-black font-bold px-1 rounded-sm">H</span>
                    <input type="color" value={hiliteColor} onChange={(e) => { setHiliteColor(e.target.value); execCmd('hiliteColor', e.target.value); }} className="w-6 h-6 bg-transparent cursor-pointer border-none p-0" />
                </div>
            </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden p-0 bg-slate-950 flex flex-col md:flex-row min-h-0">
            {/* Original Text Sidebar */}
            {showOriginal && (
                <div className="w-full md:w-1/3 border-r border-slate-800 flex flex-col bg-slate-900/50 min-h-0">
                    <div className="p-3 bg-slate-900 border-b border-slate-800 shrink-0">
                        <h3 className="text-xs font-bold text-slate-500 uppercase">Original</h3>
                    </div>
                    <div className="flex-1 p-4 text-slate-400 overflow-y-auto font-mono text-sm leading-relaxed whitespace-pre-wrap">
                        {originalText}
                    </div>
                </div>
            )}
            
            {/* Editor Area */}
            <div className={`flex-1 flex flex-col ${showOriginal ? 'md:w-2/3' : 'w-full'} bg-[#0B1120] min-h-0 relative`}>
                 <div className="flex-1 overflow-y-auto scroll-smooth bg-white">
                     <div className="max-w-[8.5in] mx-auto min-h-[11in] bg-white text-black p-[1in] shadow-lg my-8">
                        {/* ContentEditable Div acting as the Document Page */}
                        <div 
                            ref={editorRef}
                            contentEditable
                            className="outline-none prose max-w-none font-serif text-black min-h-[500px]"
                            style={{ fontFamily: '"Times New Roman", Times, serif' }}
                            suppressContentEditableWarning={true}
                        >
                        </div>
                     </div>
                 </div>
            </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-900 rounded-b-2xl shrink-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="hidden sm:flex items-center space-x-2 text-xs text-slate-500">
                    <span>IEEE Standard</span>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleDownloadPdf}
                        className="flex items-center space-x-2 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-medium transition-all text-sm"
                    >
                        <PdfIcon className="w-4 h-4" />
                        <span>Download PDF</span>
                    </button>
                    
                     <button
                        onClick={handleDownloadDocx}
                        className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-all text-sm"
                    >
                        <DownloadIcon className="w-4 h-4" />
                        <span>Download .docx</span>
                    </button>

                    <button
                        onClick={() => onPlay(editorRef.current?.innerText || refinedText)}
                        disabled={isGeneratingAudio || isRegenerating}
                        className="flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded-lg font-medium transition-all text-sm"
                    >
                        {isGeneratingAudio ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                        <SpeakerIcon className="w-4 h-4" />
                        )}
                        <span>{isPlaying ? 'Stop' : 'Listen'}</span>
                    </button>

                    <button
                        onClick={() => onCopy(editorRef.current?.innerText || refinedText)}
                        className="flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded-lg font-medium transition-all text-sm"
                    >
                        <CopyIcon className="w-4 h-4" />
                        <span>Copy Text</span>
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default RefinementModal;