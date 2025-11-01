// src/CommentsPanel.tsx
import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, Timestamp, deleteDoc, doc } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import './CommentsPanel.css';

interface Comment {
  id: string;
  cellKey: string;
  userId: string;
  userName: string;
  content: string;
  timestamp: Timestamp;
}

interface CommentsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  sheetId: string;
  selectedCell?: string;
  onCellSelect: (cellKey: string) => void;
}

const CommentsPanel: React.FC<CommentsPanelProps> = ({
  isOpen,
  onClose,
  sheetId,
  selectedCell,
  onCellSelect
}) => {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [selectedCellComments, setSelectedCellComments] = useState<Comment[]>([]);

  useEffect(() => {
    if (!isOpen || !sheetId) return;

    const commentsRef = collection(db, 'sheets', sheetId, 'comments');
    const q = query(commentsRef, orderBy('timestamp', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const commentsList: Comment[] = [];
      snapshot.forEach((doc) => {
        commentsList.push({ id: doc.id, ...doc.data() } as Comment);
      });
      setComments(commentsList);
    });

    return unsubscribe;
  }, [isOpen, sheetId]);

  useEffect(() => {
    if (selectedCell) {
      const cellComments = comments.filter(comment => comment.cellKey === selectedCell);
      setSelectedCellComments(cellComments);
    } else {
      setSelectedCellComments([]);
    }
  }, [selectedCell, comments]);

  const handleAddComment = async () => {
    if (!user || !selectedCell || !newComment.trim()) return;

    const commentsRef = collection(db, 'sheets', sheetId, 'comments');
    await addDoc(commentsRef, {
      cellKey: selectedCell,
      userId: user.uid,
      userName: `User ${user.uid.slice(0, 4)}`,
      content: newComment.trim(),
      timestamp: Timestamp.now()
    });

    setNewComment('');
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!user) return;

    const comment = comments.find(c => c.id === commentId);
    if (comment && comment.userId === user.uid) {
      await deleteDoc(doc(db, 'sheets', sheetId, 'comments', commentId));
    }
  };

  const formatTimestamp = (timestamp: Timestamp) => {
    return timestamp.toDate().toLocaleString();
  };

  const getUniqueCellKeys = () => {
    const cellKeys = Array.from(new Set(comments.map(comment => comment.cellKey)));
    return cellKeys.sort();
  };

  if (!isOpen) return null;

  return (
    <div className="comments-overlay" onClick={onClose}>
      <div className="comments-panel" onClick={(e) => e.stopPropagation()}>
        <div className="comments-header">
          <h3>Comments</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="comments-content">
          <div className="cells-with-comments">
            <h4>Cells with Comments</h4>
            <div className="cell-list">
              {getUniqueCellKeys().map(cellKey => (
                <button
                  key={cellKey}
                  className={`cell-button ${selectedCell === cellKey ? 'selected' : ''}`}
                  onClick={() => onCellSelect(cellKey)}
                >
                  {cellKey}
                  <span className="comment-count">
                    ({comments.filter(c => c.cellKey === cellKey).length})
                  </span>
                </button>
              ))}
              {getUniqueCellKeys().length === 0 && (
                <div className="no-comments">No comments yet</div>
              )}
            </div>
          </div>

          {selectedCell && (
            <div className="comment-thread">
              <h4>Comments for {selectedCell}</h4>

              <div className="add-comment">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  rows={3}
                />
                <button
                  className="add-comment-btn"
                  onClick={handleAddComment}
                  disabled={!newComment.trim()}
                >
                  Add Comment
                </button>
              </div>

              <div className="comments-list">
                {selectedCellComments.length === 0 ? (
                  <div className="no-comments">No comments for this cell</div>
                ) : (
                  selectedCellComments.map(comment => (
                    <div key={comment.id} className="comment-item">
                      <div className="comment-header">
                        <span className="comment-author">{comment.userName}</span>
                        <span className="comment-time">{formatTimestamp(comment.timestamp)}</span>
                        {comment.userId === user?.uid && (
                          <button
                            className="delete-comment-btn"
                            onClick={() => handleDeleteComment(comment.id)}
                          >
                            ×
                          </button>
                        )}
                      </div>
                      <div className="comment-content">{comment.content}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CommentsPanel;
