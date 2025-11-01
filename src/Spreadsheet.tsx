// src/Spreadsheet.tsx
import React, { useState, useEffect, useRef } from 'react';
import { db } from './firebase';
import { doc, onSnapshot, setDoc, getDoc, addDoc, collection, Timestamp } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import Toolbar from './Toolbar';
import { useAuth } from './AuthContext';
import { usePresence } from './usePresence';
import { useCursors } from './useCursors';
import ShareModal from './ShareModal';
import HistoryPanel from './HistoryPanel';
import CommentsPanel from './CommentsPanel';
import './Spreadsheet.css';

const COLUMNS = 26;
const ROWS = 100;

const columnLabels = Array.from({ length: COLUMNS }, (_, i) => String.fromCharCode(65 + i));
const rowLabels = Array.from({ length: ROWS }, (_, i) => (i + 1).toString());

interface CellData {
  value: string;
  formula?: string;
}

const evaluateFormula = (formula: string, data: Record<string, CellData>): string => {
  const upperFormula = formula.toUpperCase();

  // SUM
  const sumMatch = upperFormula.match(/^SUM\((.+)\)$/);
  if (sumMatch) {
    const values = parseValues(sumMatch[1], data);
    return values.reduce((sum, val) => sum + val, 0).toString();
  }

  // AVERAGE
  const avgMatch = upperFormula.match(/^AVERAGE\((.+)\)$/);
  if (avgMatch) {
    const values = parseValues(avgMatch[1], data);
    const sum = values.reduce((sum, val) => sum + val, 0);
    return values.length > 0 ? (sum / values.length).toString() : '0';
  }

  // COUNT
  const countMatch = upperFormula.match(/^COUNT\((.+)\)$/);
  if (countMatch) {
    const values = parseValues(countMatch[1], data);
    return values.filter(val => !isNaN(val)).length.toString();
  }

  // MIN
  const minMatch = upperFormula.match(/^MIN\((.+)\)$/);
  if (minMatch) {
    const values = parseValues(minMatch[1], data);
    const numbers = values.filter(val => !isNaN(val));
    return numbers.length > 0 ? Math.min(...numbers).toString() : '0';
  }

  // MAX
  const maxMatch = upperFormula.match(/^MAX\((.+)\)$/);
  if (maxMatch) {
    const values = parseValues(maxMatch[1], data);
    const numbers = values.filter(val => !isNaN(val));
    return numbers.length > 0 ? Math.max(...numbers).toString() : '0';
  }

  // IF
  const ifMatch = upperFormula.match(/^IF\(([^,]+),([^,]+),([^)]+)\)$/);
  if (ifMatch) {
    const condition = ifMatch[1].trim();
    const trueVal = ifMatch[2].trim();
    const falseVal = ifMatch[3].trim();
    const conditionResult = evaluateCondition(condition, data);
    if (conditionResult) {
      return evaluateValue(trueVal, data);
    } else {
      return evaluateValue(falseVal, data);
    }
  }

  return '0'; // Default
};

const parseValues = (arg: string, data: Record<string, CellData>): number[] => {
  const trimmed = arg.trim();
  if (trimmed.includes(':')) {
    // Range
    return parseRange(trimmed, data).map(val => parseFloat(val) || 0);
  } else {
    // Single cell or number
    const val = evaluateValue(trimmed, data);
    return [parseFloat(val) || 0];
  }
};

const evaluateValue = (val: string, data: Record<string, CellData>): string => {
  // If it's a cell reference like A1
  const cellMatch = val.match(/^([A-Z]+)(\d+)$/);
  if (cellMatch) {
    const cellKey = cellMatch[0].toUpperCase();
    return data[cellKey]?.value || '0';
  }
  // If it's a number or string
  return val.replace(/['"]/g, ''); // Remove quotes
};

const evaluateCondition = (condition: string, data: Record<string, CellData>): boolean => {
  // Simple conditions like A1 > 5, A1 > B1
  const parts = condition.split(/\s*([<>=!]+)\s*/);
  if (parts.length === 3) {
    const left = parseFloat(evaluateValue(parts[0], data)) || 0;
    const op = parts[1];
    const right = parseFloat(evaluateValue(parts[2], data)) || 0;
    switch (op) {
      case '>': return left > right;
      case '<': return left < right;
      case '>=': return left >= right;
      case '<=': return left <= right;
      case '==': case '=': return left === right;
      case '!=': case '<>': return left !== right;
      default: return false;
    }
  }
  return false;
};

const parseRange = (range: string, data: Record<string, CellData>): string[] => {
  // Simple: A1:A5
  const [start, end] = range.split(':');
  const startCol = start.charCodeAt(0) - 65;
  const startRow = parseInt(start.slice(1)) - 1;
  const endCol = end.charCodeAt(0) - 65;
  const endRow = parseInt(end.slice(1)) - 1;

  const cells = [];
  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      const key = `${String.fromCharCode(65 + c)}${r + 1}`;
      cells.push(data[key]?.value.toString() || '0');
    }
  }
  return cells;
};

const Spreadsheet: React.FC = () => {
  const { user } = useAuth();
  const onlineUsers = usePresence();
  const { cursors, updateCursor, removeCursor } = useCursors();
  const [data, setData] = useState<Record<string, CellData>>({});
  const [selectedCell, setSelectedCell] = useState<string>('');
  const [editingCell, setEditingCell] = useState<string>('');
  const [editValue, setEditValue] = useState<string>('');
  const [history, setHistory] = useState<Record<string, CellData>[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isHistoryPanelOpen, setIsHistoryPanelOpen] = useState(false);
  const [previewData, setPreviewData] = useState<Record<string, CellData>>({});
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isCommentsPanelOpen, setIsCommentsPanelOpen] = useState(false);
  const [selectedCommentCell, setSelectedCommentCell] = useState<string>('');
  const [cellsWithComments, setCellsWithComments] = useState<Set<string>>(new Set());
  const [zoomLevel, setZoomLevel] = useState(1);
  const [showScrollHint, setShowScrollHint] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; cell: string } | null>(null);
  const [focusedCell, setFocusedCell] = useState<string>('');
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);
  const sheetId = 'default-sheet'; // For now, single sheet

  // Check access level from URL parameters
  const getAccessLevel = () => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('access') || 'edit'; // Default to edit for owner
  };

  const isViewOnly = getAccessLevel() === 'view';
  const isOwner = !new URLSearchParams(window.location.search).has('shared');

  const saveData = async (newData: Record<string, CellData>) => {
    const docRef = doc(db, 'sheets', sheetId);
    await setDoc(docRef, { data: newData }, { merge: true });
  };

  const saveVersion = async (data: Record<string, CellData>, description?: string) => {
    if (!user) return;

    const versionsRef = collection(db, 'sheets', sheetId, 'versions');
    await addDoc(versionsRef, {
      timestamp: Timestamp.now(),
      userId: user.uid,
      userName: `User ${user.uid.slice(0, 4)}`,
      data: data,
      description: description || 'Manual save'
    });
  };

  const undo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setData(history[newIndex]);
      setHistoryIndex(newIndex);
      saveData(history[newIndex]);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setData(history[newIndex]);
      setHistoryIndex(newIndex);
      saveData(history[newIndex]);
    }
  };

  const exportCSV = () => {
    const csvData = [];
    for (let row = 0; row < ROWS; row++) {
      const rowData = [];
      for (let col = 0; col < COLUMNS; col++) {
        const key = getCellKey(col, row);
        rowData.push(data[key]?.value || '');
      }
      csvData.push(rowData);
    }
    const ws = XLSX.utils.aoa_to_sheet(csvData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, 'spreadsheet.xlsx');
  };

  const exportAsCSV = () => {
    const csvData = [];
    for (let row = 0; row < ROWS; row++) {
      const rowData = [];
      for (let col = 0; col < COLUMNS; col++) {
        const key = getCellKey(col, row);
        rowData.push(data[key]?.value || '');
      }
      csvData.push(rowData);
    }

    // Convert to CSV string
    const csvContent = csvData.map(row =>
      row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')
    ).join('\n');

    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'spreadsheet.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileImport = async (file: File) => {
    if (isViewOnly) return;

    const fileType = file.name.split('.').pop()?.toLowerCase();

    try {
      let importedData: any[][] = [];

      if (fileType === 'csv') {
        // Parse CSV
        const text = await file.text();
        importedData = text.split('\n').map(line =>
          line.split(',').map(cell => cell.replace(/^"|"$/g, '').replace(/""/g, '"'))
        );
      } else if (fileType === 'xlsx' || fileType === 'xls') {
        // Parse Excel
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        importedData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      } else {
        alert('Unsupported file type. Please use CSV or Excel files.');
        return;
      }

      // Convert to spreadsheet data format
      const newData: Record<string, CellData> = {};

      importedData.forEach((row, rowIndex) => {
        if (rowIndex >= ROWS) return; // Limit to available rows

        row.forEach((cell, colIndex) => {
          if (colIndex >= COLUMNS) return; // Limit to available columns

          const key = getCellKey(colIndex, rowIndex);
          const cellValue = cell?.toString() || '';
          newData[key] = { value: cellValue };
        });
      });

      setData(newData);
      addToHistory(newData);
      saveData(newData);
      alert(`Successfully imported ${importedData.length} rows of data.`);
    } catch (error) {
      console.error('Import error:', error);
      alert('Error importing file. Please check the file format.');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isViewOnly) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    if (isViewOnly) return;

    const files = Array.from(e.dataTransfer.files);
    const validFile = files.find(file =>
      file.name.endsWith('.csv') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls')
    );

    if (validFile) {
      handleFileImport(validFile);
    } else {
      alert('Please drop a CSV or Excel file.');
    }
  };

  const handleImportClick = () => {
    if (isViewOnly) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.xlsx,.xls';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        handleFileImport(file);
      }
    };
    input.click();
  };

  const addToHistory = (newData: Record<string, CellData>) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ ...newData });
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  useEffect(() => {
    const commentsRef = collection(db, 'sheets', sheetId, 'comments');
    const unsubscribe = onSnapshot(commentsRef, (snapshot) => {
      const commentCells = new Set<string>();
      snapshot.forEach((doc) => {
        const comment = doc.data();
        commentCells.add(comment.cellKey);
      });
      setCellsWithComments(commentCells);
    });

    return unsubscribe;
  }, [sheetId]);

  const handleContextMenu = (e: React.MouseEvent, cellKey: string) => {
    if (isViewOnly) return;

    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      cell: cellKey
    });
  };

  const handleContextMenuAction = (action: string) => {
    if (!contextMenu) return;

    switch (action) {
      case 'cut':
        // Implement cut
        break;
      case 'copy':
        // Implement copy
        break;
      case 'paste':
        // Implement paste
        break;
      case 'comment':
        setSelectedCommentCell(contextMenu.cell);
        setIsCommentsPanelOpen(true);
        break;
      case 'clear':
        if (!isViewOnly) {
          const newData = { ...data };
          delete newData[contextMenu.cell];
          setData(newData);
          addToHistory(newData);
          saveData(newData);
          saveVersion(newData, 'Cell cleared');
        }
        break;
    }
    setContextMenu(null);
  };

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.25, 2));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.25, 0.5));
  };

  const handleZoomReset = () => {
    setZoomLevel(1);
  };
  const isMobile = () => {
    return window.innerWidth <= 768;
  };

  // Pinch-to-zoom variables
  const pinchRef = useRef<{ initialDistance: number; initialZoom: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) +
        Math.pow(touch2.clientY - touch1.clientY, 2)
      );

      pinchRef.current = {
        initialDistance: distance,
        initialZoom: zoomLevel
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      e.preventDefault();

      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) +
        Math.pow(touch2.clientY - touch1.clientY, 2)
      );

      const scale = distance / pinchRef.current.initialDistance;
      const newZoom = Math.max(0.5, Math.min(2, pinchRef.current.initialZoom * scale));

      setZoomLevel(newZoom);
    }
  };

  const handleTouchEnd = () => {
    pinchRef.current = null;
  };

  // Scroll hint management
  useEffect(() => {
    if (!isMobile()) return;

    const handleScroll = () => {
      const container = document.querySelector('.spreadsheet-container');
      if (container) {
        const { scrollLeft, scrollWidth, clientWidth } = container as HTMLElement;
        setShowScrollHint(scrollLeft < scrollWidth - clientWidth - 50);
      }
    };

    const container = document.querySelector('.spreadsheet-container');
    if (container) {
      container.addEventListener('scroll', handleScroll);
      handleScroll(); // Initial check

      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, []);

  // Keyboard navigation and global event handling
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (isViewOnly) return;

      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') {
          e.preventDefault();
          undo();
        } else if (e.key === 'y') {
          e.preventDefault();
          redo();
        } else if (e.key === 'c') {
          // Copy - TODO: implement clipboard
        } else if (e.key === 'v') {
          // Paste - TODO: implement clipboard
        } else if (e.key === 'x') {
          // Cut - TODO: implement clipboard
        }
      } else {
        // Arrow key navigation
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Tab'].includes(e.key)) {
          e.preventDefault();
          handleKeyboardNavigation(e.key);
        }
      }
    };

    const handleClickOutside = () => {
      setContextMenu(null);
      setTooltip(null);
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    document.addEventListener('click', handleClickOutside);

    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [selectedCell]);

  const getCellKey = (col: number, row: number) => `${columnLabels[col]}${rowLabels[row]}`;

  const handleCellClick = (key: string) => {
    if (isViewOnly) return; // Prevent interaction in view-only mode

    setSelectedCell(key);
    setEditingCell(key);
    setEditValue(data[key]?.value.toString() || '');
    // Update cursor
    const col = key.charCodeAt(0) - 65;
    const row = parseInt(key.slice(1)) - 1;
    updateCursor(row, col);
  };

  const handleCellChange = (value: string) => {
    if (isViewOnly) return;
    setEditValue(value);
  };

  const handleKeyboardNavigation = (key: string) => {
    if (!selectedCell) return;

    const col = selectedCell.match(/([A-Z]+)/)?.[1] || 'A';
    const row = parseInt(selectedCell.match(/(\d+)/)?.[1] || '1');

    let newCol = col;
    let newRow = row;

    switch (key) {
      case 'ArrowUp':
        newRow = Math.max(1, row - 1);
        break;
      case 'ArrowDown':
      case 'Enter':
        newRow = Math.min(ROWS, row + 1);
        break;
      case 'ArrowLeft':
        if (col.length === 1) {
          newCol = String.fromCharCode(Math.max(65, col.charCodeAt(0) - 1));
        }
        break;
      case 'ArrowRight':
      case 'Tab':
        if (col.length === 1) {
          newCol = String.fromCharCode(Math.min(90, col.charCodeAt(0) + 1));
        }
        break;
    }

    const newCellKey = `${newCol}${newRow}`;
    handleCellClick(newCellKey);
    setFocusedCell(newCellKey);
  };

  const handleComments = () => {
    setIsCommentsPanelOpen(true);
  };

  const handleCommentCellSelect = (cellKey: string) => {
    setSelectedCommentCell(cellKey);
  };

  // Mouse event handlers
  const handleMouseEnter = (cellKey: string) => {
    if (cellsWithComments.has(cellKey)) {
      // Position tooltip near mouse cursor
      setTooltip({ x: 0, y: 0, text: `Click to view comments` });
    }
  };

  const handleMouseLeave = () => {
    setTooltip(null);
  };

  const handleCellBlur = () => {
    if (isViewOnly) return;

    const newData = { ...data };
    if (editValue.startsWith('=')) {
      newData[selectedCell] = { value: evaluateFormula(editValue.slice(1), newData), formula: editValue };
    } else {
      newData[selectedCell] = { value: editValue };
    }
    // Re-evaluate all formulas
    Object.keys(newData).forEach(key => {
      if (newData[key].formula) {
        newData[key].value = evaluateFormula(newData[key].formula!.slice(1), newData);
      }
    });
    setData(newData);
    addToHistory(newData);
    saveData(newData);
    saveVersion(newData, 'Cell edit'); // Save version on cell changes
    setEditingCell('');
  };

  const handleShare = () => {
    if (!isOwner) return; // Only owners can share
    setIsShareModalOpen(true);
  };

  const handleHistory = () => {
    setIsHistoryPanelOpen(true);
  };

  const handlePreview = (versionData: Record<string, CellData>) => {
    setPreviewData(versionData);
    setIsPreviewing(true);
  };

  const handleRestore = async (versionData: Record<string, CellData>) => {
    setData(versionData);
    setPreviewData({});
    setIsPreviewing(false);
    addToHistory(versionData);
    await saveData(versionData);
    await saveVersion(versionData, 'Restored from version history');
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleCellBlur();
    }
  };

  const renderCell = (col: number, row: number) => {
    const key = getCellKey(col, row);
    const currentData = isPreviewing ? previewData : data;
    const cellData = currentData[key];
    const isEditing = editingCell === key;
    const isSelected = selectedCell === key;
    const isFocused = focusedCell === key;
    const hasComments = cellsWithComments.has(key);

    // Check for cursors
    const cellCursors = cursors.filter(cursor => cursor.cursor && cursor.cursor.row === row && cursor.cursor.col === col);

    return (
      <td
        key={key}
        className={`cell ${isSelected ? 'selected' : ''} ${isFocused ? 'focused' : ''} ${isViewOnly ? 'view-only' : ''} ${isPreviewing ? 'preview' : ''}`}
        onClick={() => handleCellClick(key)}
        onContextMenu={(e) => handleContextMenu(e, key)}
        onMouseEnter={() => handleMouseEnter(key)}
        onMouseLeave={handleMouseLeave}
        style={{ position: 'relative' }}
      >
        {isEditing ? (
          <input
            type="text"
            value={editValue}
            onChange={(e) => handleCellChange(e.target.value)}
            onBlur={handleCellBlur}
            onKeyDown={handleInputKeyDown}
            autoFocus
            disabled={isViewOnly}
          />
        ) : (
          <span>{cellData?.value || ''}</span>
        )}
        {hasComments && (
          <div
            className="comment-indicator"
            title="This cell has comments"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedCommentCell(key);
              setIsCommentsPanelOpen(true);
            }}
          >
            💬
          </div>
        )}
        {cellCursors.map(cursor => (
          <div
            key={cursor.id}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              border: `2px solid ${cursor.color}`,
              pointerEvents: 'none',
              zIndex: 10
            }}
            title={cursor.name}
          />
        ))}
      </td>
    );
  };

  return (
    <div
      className="spreadsheet-container"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className="spreadsheet-content"
        style={{
          transform: `scale(${zoomLevel})`,
          transformOrigin: 'top left',
          width: `${100 / zoomLevel}%`,
          height: `${100 / zoomLevel}%`
        }}
      >
        <div
          className="spreadsheet"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {isDragOver && !isViewOnly && (
            <div className="drag-overlay">
              <div className="drag-zone">
                <div className="drag-icon">📄</div>
                <div className="drag-text">Drop CSV or Excel file to import</div>
              </div>
            </div>
          )}
          <div className="header">
            <h2>Cloud Spreadsheet</h2>
            <div className="online-users">
              {onlineUsers.map(u => (
                <span key={u.id} style={{ color: u.color, marginRight: '10px' }}>
                  {u.name}
                </span>
              ))}
            </div>
          </div>
          <Toolbar onImport={handleImportClick} onExportCSV={exportAsCSV} onExportExcel={exportCSV} onUndo={undo} onRedo={redo} onShare={handleShare} onHistory={handleHistory} onComments={handleComments} />
          <table>
            <thead>
              <tr>
                <th></th>
                {columnLabels.map((label) => (
                  <th key={label}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rowLabels.map((rowLabel, rowIndex) => (
                <tr key={rowLabel}>
                  <th>{rowLabel}</th>
                  {columnLabels.map((_, colIndex) => renderCell(colIndex, rowIndex))}
                </tr>
              ))}
            </tbody>
          </table>
          <ShareModal
            isOpen={isShareModalOpen}
            onClose={() => setIsShareModalOpen(false)}
            sheetId={sheetId}
          />
          <HistoryPanel
            isOpen={isHistoryPanelOpen}
            onClose={() => {
              setIsHistoryPanelOpen(false);
              setIsPreviewing(false);
              setPreviewData({});
            }}
            sheetId={sheetId}
            onPreview={handlePreview}
            onRestore={handleRestore}
          />
          <CommentsPanel
            isOpen={isCommentsPanelOpen}
            onClose={() => {
              setIsCommentsPanelOpen(false);
              setSelectedCommentCell('');
            }}
            sheetId={sheetId}
            selectedCell={selectedCommentCell}
            onCellSelect={handleCommentCellSelect}
          />
        </div>
      </div>

      {/* Mobile Zoom Controls */}
      {isMobile() && (
        <div className="zoom-controls">
          <button className="zoom-btn" onClick={handleZoomIn}>+</button>
          <div className="zoom-level">{Math.round(zoomLevel * 100)}%</div>
          <button className="zoom-btn" onClick={handleZoomOut}>−</button>
          <button className="zoom-btn" onClick={handleZoomReset} style={{ fontSize: '14px' }}>↻</button>
        </div>
      )}

      {/* Mobile Scroll Hint */}
      {isMobile() && showScrollHint && (
        <div className="mobile-scroll-hint show">
          ← Scroll for more columns
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <div className="context-menu-item" onClick={() => handleContextMenuAction('cut')}>
            ✂️ Cut
          </div>
          <div className="context-menu-item" onClick={() => handleContextMenuAction('copy')}>
            📋 Copy
          </div>
          <div className="context-menu-item" onClick={() => handleContextMenuAction('paste')}>
            📄 Paste
          </div>
          <div className="context-menu-item" onClick={() => handleContextMenuAction('comment')}>
            💬 Add Comment
          </div>
          <div className="context-menu-item" onClick={() => handleContextMenuAction('clear')}>
            🗑️ Clear Cell
          </div>
        </div>
      )}

      {/* Tooltip */}
      {tooltip && (
        <div
          className="tooltip show"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
};

export default Spreadsheet;
