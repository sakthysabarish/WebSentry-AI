import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

export default function DeleteModal({ project, isOpen, isDeleting, onConfirm, onCancel }) {
  if (!isOpen || !project) return null;

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="modal-header">
          <div className="modal-icon-wrapper">
            <AlertTriangle className="modal-warning-icon" size={24} />
          </div>
          <button className="modal-close-btn" onClick={onCancel} disabled={isDeleting} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="modal-content">
          <h3 id="modal-title" className="modal-title">Delete Project?</h3>
          <p className="modal-desc">
            Are you sure you want to delete <strong className="highlight-text">{project.website_name}</strong>?
          </p>
          <div className="modal-project-preview">
            <span className="preview-label">Target URL:</span>
            <span className="preview-value">{project.website_url}</span>
            <span className="preview-id">Project ID: #{project.id}</span>
          </div>
          <p className="modal-warning-note">
            This action will permanently delete the project record from your MySQL database.
          </p>
        </div>

        <div className="modal-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={onCancel}
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-danger"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <span className="spinner-sm" />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <Trash2 size={16} />
                <span>Delete Project</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
