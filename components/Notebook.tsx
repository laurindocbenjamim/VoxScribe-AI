
import React, { useState, useEffect, useRef } from 'react';
import { Note } from '../types';
import { DownloadIcon, PdfIcon, RefreshIcon, CopyIcon, SparklesIcon } from './Icons';
import * as docx from "docx";
import { jsPDF } from "jspdf";

interface NotebookProps {
  notes: Note[];
  activeNoteId: string | null;
  onSaveNote: (note: Note) => void;
  onDeleteNote: (id: string) => void;
  onSelectNote: (id: string) => void;
  onCreateNote: () => void;
}

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

  useEffect(() => {
    const note = notes.find(n => n.id === activeNoteId) || null;
    setActiveNote(note);
    if (editorRef.current && note) {
      editorRef.current.innerHTML = note.content;
    }
  }, [activeNoteId, notes]);

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

  const execCmd = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    if (editorRef.current) editorRef.current.focus();
  };

  const downloadPdf = async () => {
    if (!editorRef.current) return;
    const doc = new jsPDF({ unit: 'pt', format: 'letter' });
    const margin = 40;
    await doc.html(editorRef.current, {
      callback: (d) => d.save(`${activeNote?.title || 'note'}.pdf`),
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

      {/* Main Canvas */}
      <div className="flex-1 flex flex-col bg-slate-950 relative">
        {activeNote ? (
          <>
            {/* Notebook Toolbar */}
            <div className="h-14 border-b border-slate-800 bg-slate-900 flex items-center px-4 justify-between shrink-0">
               <div className="flex items-center space-x-1">
                  <button onClick={() => execCmd('formatBlock', 'h1')} className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded" title="Heading 1">H1</button>
                  <button onClick={() => execCmd('formatBlock', 'h2')} className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded" title="Heading 2">H2</button>
                  <div className="w-px h-4 bg-slate-800 mx-1"></div>
                  <button onClick={() => execCmd('bold')} className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded font-bold">B</button>
                  <button onClick={() => execCmd('italic')} className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded italic">I</button>
                  <div className="w-px h-4 bg-slate-800 mx-1"></div>
                  <button onClick={() => execCmd('insertUnorderedList')} className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded">List</button>
               </div>
               <div className="flex items-center space-x-3">
                  <button onClick={downloadPdf} className="text-xs flex items-center space-x-1 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded text-slate-300">
                    <PdfIcon className="w-3 h-3" />
                    <span>PDF</span>
                  </button>
                  <button onClick={() => onDeleteNote(activeNote.id)} className="text-xs text-red-400 hover:text-red-300 px-2 py-1">
                    Delete
                  </button>
               </div>
            </div>

            {/* Smart Paper Canvas */}
            <div className="flex-1 overflow-y-auto p-8 scroll-smooth" style={{
              backgroundImage: 'radial-gradient(#2d3748 0.5px, transparent 0.5px)',
              backgroundSize: '24px 24px'
            }}>
              <div className="max-w-4xl mx-auto min-h-full">
                <input 
                  type="text"
                  value={activeNote.title}
                  onChange={(e) => onSaveNote({...activeNote, title: e.target.value})}
                  placeholder="Note Title..."
                  className="w-full bg-transparent text-4xl font-bold text-white outline-none mb-8 placeholder:text-slate-800"
                />
                <div 
                  ref={editorRef}
                  contentEditable
                  onInput={handleInput}
                  className="w-full outline-none text-slate-300 leading-relaxed prose prose-invert max-w-none min-h-[500px]"
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
