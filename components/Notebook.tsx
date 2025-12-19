
import React, { useState, useEffect, useRef } from 'react';
import { Note } from '../types';
import { DownloadIcon, PdfIcon, SparklesIcon, WandIcon, AcademicIcon } from './Icons';
import { jsPDF } from "jspdf";

interface NotebookProps {
  notes: Note[];
  activeNoteId: string | null;
  onSaveNote: (note: Note) => void;
  onDeleteNote: (id: string) => void;
  onSelectNote: (id: string) => void;
  onCreateNote: () => void;
}

type DrawTool = 'pen' | 'highlighter' | 'eraser' | 'none';

const Notebook: React.FC<NotebookProps> = ({ 
  notes, 
  activeNoteId, 
  onSaveNote, 
  onDeleteNote, 
  onSelectNote,
  onCreateNote 
}) => {
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<DrawTool>('none');
  const [color, setColor] = useState('#3b82f6'); // Default Blue
  const [isDrawing, setIsDrawing] = useState(false);
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);

  useEffect(() => {
    const note = notes.find(n => n.id === activeNoteId) || null;
    setActiveNote(note);
    if (editorRef.current && note) {
      editorRef.current.innerHTML = note.content;
    }
    
    // Load drawing data if exists
    if (canvasRef.current && note?.drawingData) {
      const img = new Image();
      img.onload = () => {
        const c = canvasRef.current!.getContext('2d');
        if (c) {
          c.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
          c.drawImage(img, 0, 0);
        }
      };
      img.src = note.drawingData;
    } else if (canvasRef.current) {
        const c = canvasRef.current.getContext('2d');
        c?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  }, [activeNoteId, notes]);

  useEffect(() => {
    if (canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        context.lineCap = 'round';
        context.lineJoin = 'round';
        setCtx(context);
      }
    }
  }, [activeNote]);

  const handleInput = () => {
    if (editorRef.current && activeNote) {
      const updatedNote = {
        ...activeNote,
        content: editorRef.current.innerHTML,
        updatedAt: Date.now()
      };
      onSaveNote(updatedNote);
    }
  };

  const saveCanvas = () => {
    if (canvasRef.current && activeNote) {
      const dataUrl = canvasRef.current.toDataURL();
      onSaveNote({
        ...activeNote,
        drawingData: dataUrl,
        updatedAt: Date.now()
      });
    }
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (tool === 'none' || !ctx || !canvasRef.current) return;
    setIsDrawing(true);
    const rect = canvasRef.current.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : (e as React.MouseEvent).clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : (e as React.MouseEvent).clientY - rect.top;
    
    ctx.beginPath();
    ctx.moveTo(x, y);

    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = 20;
    } else if (tool === 'highlighter') {
      ctx.globalCompositeOperation = 'multiply';
      ctx.strokeStyle = color + '44'; // 44 is transparency in hex
      ctx.lineWidth = 15;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !ctx || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : (e as React.MouseEvent).clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : (e as React.MouseEvent).clientY - rect.top;
    
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    ctx?.closePath();
    saveCanvas();
  };

  const execCmd = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    if (editorRef.current) editorRef.current.focus();
  };

  const downloadPdf = async () => {
    if (!editorRef.current || !activeNote) return;
    const doc = new jsPDF({ unit: 'pt', format: 'letter' });
    const margin = 40;
    
    // We render the HTML
    await doc.html(editorRef.current, {
      callback: (d) => {
          // Then overlay the canvas if drawing exists
          if (activeNote.drawingData) {
              d.addImage(activeNote.drawingData, 'PNG', margin, margin, 532, 700);
          }
          d.save(`${activeNote.title}.pdf`);
      },
      x: margin,
      y: margin,
      width: 532,
      windowWidth: 800
    });
  };

  return (
    <div className="flex h-[calc(100vh-140px)] bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 border-r border-slate-800 bg-slate-900 flex flex-col">
        <div className="p-4 border-b border-slate-800">
          <button 
            onClick={onCreateNote}
            className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium flex items-center justify-center space-x-2 transition-colors"
          >
            <span>+ New Note</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {notes.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-sm">No notes yet</div>
          ) : (
            notes.map(note => (
              <button
                key={note.id}
                onClick={() => onSelectNote(note.id)}
                className={`w-full text-left p-3 rounded-lg transition-all group ${
                  activeNoteId === note.id ? 'bg-slate-800 border-l-4 border-blue-500' : 'hover:bg-slate-800/50'
                }`}
              >
                <div className="font-medium text-slate-200 truncate">{note.title || 'Untitled'}</div>
                <div className="text-xs text-slate-500 mt-1">
                  {new Date(note.updatedAt).toLocaleDateString()}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 flex flex-col bg-slate-950 relative overflow-hidden">
        {activeNote ? (
          <>
            {/* Unified Toolbar */}
            <div className="h-14 border-b border-slate-800 bg-slate-900 flex items-center px-4 justify-between shrink-0 z-20">
               <div className="flex items-center space-x-1">
                  {/* Text Tools */}
                  <button onClick={() => execCmd('bold')} className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded font-bold">B</button>
                  <button onClick={() => execCmd('italic')} className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded italic">I</button>
                  <div className="w-px h-4 bg-slate-800 mx-1"></div>
                  
                  {/* Drawing Tools */}
                  <button 
                    onClick={() => setTool(tool === 'pen' ? 'none' : 'pen')} 
                    className={`p-2 rounded flex items-center transition-all ${tool === 'pen' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
                    title="Pen"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  </button>
                  
                  <button 
                    onClick={() => setTool(tool === 'highlighter' ? 'none' : 'highlighter')} 
                    className={`p-2 rounded flex items-center transition-all ${tool === 'highlighter' ? 'bg-yellow-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
                    title="Highlighter"
                  >
                    <WandIcon className="w-4 h-4" />
                  </button>
                  
                  <button 
                    onClick={() => setTool(tool === 'eraser' ? 'none' : 'eraser')} 
                    className={`p-2 rounded flex items-center transition-all ${tool === 'eraser' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
                    title="Eraser"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>

                  <div className="flex items-center space-x-1 px-2">
                     {['#3b82f6', '#ef4444', '#10b981', '#f59e0b'].map(c => (
                        <button 
                          key={c} 
                          onClick={() => setColor(c)} 
                          className={`w-4 h-4 rounded-full border border-white/20 ${color === c ? 'ring-2 ring-white scale-110' : ''}`}
                          style={{ backgroundColor: c }}
                        />
                     ))}
                  </div>
               </div>
               
               <div className="flex items-center space-x-3">
                  <button onClick={downloadPdf} className="text-xs flex items-center space-x-1 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded text-slate-300 transition-colors">
                    <PdfIcon className="w-3 h-3" />
                    <span>PDF</span>
                  </button>
                  <button onClick={() => onDeleteNote(activeNote.id)} className="text-xs text-red-400 hover:text-red-300 px-2 py-1">
                    Delete
                  </button>
               </div>
            </div>

            {/* Canvas + Text Layout */}
            <div className="flex-1 overflow-auto p-8 relative scroll-smooth" id="notebook-canvas-container" style={{
              backgroundImage: 'radial-gradient(#2d3748 0.5px, transparent 0.5px)',
              backgroundSize: '24px 24px'
            }}>
              <div className="max-w-4xl mx-auto min-h-full relative">
                {/* Drawing Layer */}
                <canvas
                  ref={canvasRef}
                  width={900}
                  height={1500}
                  className={`absolute inset-0 z-10 w-full h-full pointer-events-none ${tool !== 'none' ? 'pointer-events-auto cursor-crosshair' : ''}`}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                />
                
                {/* Text Layer */}
                <input 
                  type="text"
                  value={activeNote.title}
                  onChange={(e) => onSaveNote({...activeNote, title: e.target.value})}
                  placeholder="Note Title..."
                  className="w-full bg-transparent text-4xl font-bold text-white outline-none mb-8 placeholder:text-slate-800 relative z-0"
                />
                <div 
                  ref={editorRef}
                  contentEditable
                  onInput={handleInput}
                  className="w-full outline-none text-slate-300 leading-relaxed prose prose-invert max-w-none min-h-[1000px] relative z-0"
                  style={{ userSelect: tool === 'none' ? 'text' : 'none' }}
                />
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-600">
             <SparklesIcon className="w-12 h-12 mb-4 opacity-20" />
             <p>Select or create a note to begin</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Notebook;
