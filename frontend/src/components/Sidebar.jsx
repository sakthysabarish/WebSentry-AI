import React from 'react';
import {
  Layers,
  Globe,
  Shield,
  Zap,
  Settings,
  Server,
  X,
  Activity
} from 'lucide-react';

export default function Sidebar({ isOpen, onClose, activeTab, onTabChange, backendOnline, projectCount }) {
  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={`sidebar-overlay ${isOpen ? 'active' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside className={`dashboard-sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-icon-wrapper">
            <Activity className="brand-icon" size={24} />
          </div>
          <div className="brand-text">
            <h2>WebAnalyzer</h2>
            <span className="brand-badge">AI SaaS</span>
          </div>
          <button className="sidebar-close-mobile" onClick={onClose} aria-label="Close sidebar">
            <X size={20} />
          </button>
        </div>

        <div className="sidebar-divider" />

        <nav className="sidebar-nav">
          <span className="nav-section-title">MAIN NAVIGATION</span>

          <button
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => {
              onTabChange('dashboard');
              onClose();
            }}
          >
            <Layers size={18} />
            <span>Dashboard</span>
            <span className="nav-counter">{projectCount}</span>
          </button>

          <button
            className={`nav-item ${activeTab === 'projects' ? 'active' : ''}`}
            onClick={() => {
              onTabChange('projects');
              onClose();
            }}
          >
            <Globe size={18} />
            <span>Projects</span>
          </button>

          <span className="nav-section-title">ANALYZER SUITE</span>

          <div className="nav-item disabled" title="Available in next phase">
            <Shield size={18} />
            <span>Security Scan</span>
            <span className="pill-soon">Soon</span>
          </div>

          <div className="nav-item disabled" title="Available in next phase">
            <Zap size={18} />
            <span>AI Performance</span>
            <span className="pill-soon">Soon</span>
          </div>

          <div className="nav-item disabled" title="Available in next phase">
            <Settings size={18} />
            <span>Settings</span>
            <span className="pill-soon">Soon</span>
          </div>
        </nav>

        {/* System info footer */}
        <div className="sidebar-footer">
          <div className="server-status-card">
            <div className="status-header">
              <Server size={16} className="server-icon" />
              <span className="server-title">Backend API</span>
            </div>
            <div className="status-indicator-row">
              <span className={`status-dot ${backendOnline ? 'online' : 'offline'}`} />
              <span className="status-text">
                {backendOnline ? 'Online (5000)' : 'Offline / Checking'}
              </span>
            </div>
            <span className="server-url">http://localhost:5000</span>
          </div>
        </div>
      </aside>
    </>
  );
}
