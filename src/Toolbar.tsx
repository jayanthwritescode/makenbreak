// src/Toolbar.tsx
import React from 'react';
import './Toolbar.css';

interface ToolbarProps {
  onImport: () => void;
  onExportCSV: () => void;
  onExportExcel: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onShare: () => void;
  onHistory: () => void;
  onComments: () => void;
}

const Toolbar: React.FC<ToolbarProps> = ({ onImport, onExportCSV, onExportExcel, onUndo, onRedo, onShare, onHistory, onComments }) => {
  return (
    <div className="toolbar">
      <button onClick={onUndo}>Undo</button>
      <button onClick={onRedo}>Redo</button>
      <button onClick={onImport}>Import</button>
      <button onClick={onExportCSV}>Export CSV</button>
      <button onClick={onExportExcel}>Export Excel</button>
      <button onClick={onShare}>Share</button>
      <button onClick={onHistory}>History</button>
      <button onClick={onComments}>💬 Comments</button>
    </div>
  );
};

export default Toolbar;
