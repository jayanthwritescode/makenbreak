// src/HistoryPanel.tsx
import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, query, orderBy, onSnapshot, doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import './HistoryPanel.css';

interface Version {
  id: string;
  timestamp: Timestamp;
  userId: string;
  userName: string;
  data: Record<string, any>;
  description?: string;
}

interface HistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  sheetId: string;
  onPreview: (data: Record<string, any>) => void;
  onRestore: (data: Record<string, any>) => void;
}

const HistoryPanel: React.FC<HistoryPanelProps> = ({
  isOpen,
  onClose,
  sheetId,
  onPreview,
  onRestore
}) => {
  const { user } = useAuth();
  const [versions, setVersions] = useState<Version[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);

  useEffect(() => {
    if (!isOpen || !sheetId) return;

    const versionsRef = collection(db, 'sheets', sheetId, 'versions');
    const q = query(versionsRef, orderBy('timestamp', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const versionsList: Version[] = [];
      snapshot.forEach((doc) => {
        versionsList.push({ id: doc.id, ...doc.data() } as Version);
      });
      setVersions(versionsList);
    });

    return unsubscribe;
  }, [isOpen, sheetId]);

  const handlePreview = async (versionId: string) => {
    const version = versions.find(v => v.id === versionId);
    if (version) {
      setSelectedVersion(versionId);
      setIsPreviewing(true);
      onPreview(version.data);
    }
  };

  const handleRestore = async (versionId: string) => {
    const version = versions.find(v => v.id === versionId);
    if (version && window.confirm('Are you sure you want to restore this version? This will replace the current spreadsheet.')) {
      setSelectedVersion(null);
      setIsPreviewing(false);
      onRestore(version.data);
      onClose();
    }
  };

  const handleExitPreview = () => {
    setSelectedVersion(null);
    setIsPreviewing(false);
    onPreview({}); // Clear preview
  };

  const formatTimestamp = (timestamp: Timestamp) => {
    return timestamp.toDate().toLocaleString();
  };

  if (!isOpen) return null;

  return (
    <div className="history-overlay" onClick={onClose}>
      <div className="history-panel" onClick={(e) => e.stopPropagation()}>
        <div className="history-header">
          <h3>Version History</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        {isPreviewing && (
          <div className="preview-banner">
            <span>Previewing version • </span>
            <button className="exit-preview-btn" onClick={handleExitPreview}>
              Exit Preview
            </button>
          </div>
        )}

        <div className="versions-list">
          {versions.length === 0 ? (
            <div className="no-versions">
              No version history available
            </div>
          ) : (
            versions.map((version) => (
              <div
                key={version.id}
                className={`version-item ${selectedVersion === version.id ? 'selected' : ''}`}
              >
                <div className="version-info">
                  <div className="version-meta">
                    <span className="user-name">{version.userName}</span>
                    <span className="timestamp">{formatTimestamp(version.timestamp)}</span>
                  </div>
                  {version.description && (
                    <div className="version-description">{version.description}</div>
                  )}
                </div>
                <div className="version-actions">
                  <button
                    className="preview-btn"
                    onClick={() => handlePreview(version.id)}
                    disabled={selectedVersion === version.id}
                  >
                    {selectedVersion === version.id ? 'Previewing' : 'Preview'}
                  </button>
                  <button
                    className="restore-btn"
                    onClick={() => handleRestore(version.id)}
                  >
                    Restore
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default HistoryPanel;
