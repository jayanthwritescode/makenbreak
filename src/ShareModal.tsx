// src/ShareModal.tsx
import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import { usePresence } from './usePresence';
import './ShareModal.css';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  sheetId: string;
}

const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, sheetId }) => {
  const { user } = useAuth();
  const onlineUsers = usePresence();
  const [copiedLink, setCopiedLink] = useState<string>('');

  const generateShareLink = (access: 'view' | 'edit') => {
    const baseUrl = window.location.origin + window.location.pathname;
    const params = new URLSearchParams({
      sheet: sheetId,
      access: access,
      shared: 'true'
    });
    return `${baseUrl}?${params.toString()}`;
  };

  const copyToClipboard = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiedLink(link);
      setTimeout(() => setCopiedLink(''), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  const getAccessLevel = () => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('access') || 'edit'; // Default to edit for owner
  };

  if (!isOpen) return null;

  const currentAccess = getAccessLevel();
  const isOwner = !new URLSearchParams(window.location.search).has('shared');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Share Spreadsheet</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="access-level">
            <span className="access-badge">
              Access Level: <strong>{currentAccess === 'edit' ? 'Edit' : 'View Only'}</strong>
            </span>
            {!isOwner && <span className="shared-badge">Shared Link</span>}
          </div>

          {isOwner && (
            <div className="share-links">
              <h4>Share with others</h4>

              <div className="link-section">
                <label>Edit Access:</label>
                <div className="link-input-group">
                  <input
                    type="text"
                    value={generateShareLink('edit')}
                    readOnly
                    className="link-input"
                  />
                  <button
                    className="copy-btn"
                    onClick={() => copyToClipboard(generateShareLink('edit'))}
                  >
                    {copiedLink === generateShareLink('edit') ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              <div className="link-section">
                <label>View Only:</label>
                <div className="link-input-group">
                  <input
                    type="text"
                    value={generateShareLink('view')}
                    readOnly
                    className="link-input"
                  />
                  <button
                    className="copy-btn"
                    onClick={() => copyToClipboard(generateShareLink('view'))}
                  >
                    {copiedLink === generateShareLink('view') ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="collaborators">
            <h4>Current Collaborators</h4>
            <div className="collaborators-list">
              {onlineUsers.map(user => (
                <div key={user.id} className="collaborator-item">
                  <span className="collaborator-name" style={{ color: user.color }}>
                    {user.name}
                  </span>
                  <span className="collaborator-status">Online</span>
                </div>
              ))}
              {onlineUsers.length === 0 && (
                <div className="no-collaborators">No one else is online</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShareModal;
