import React from 'react';
import { Menu, RefreshCw, PlusCircle, Sparkles, Search } from 'lucide-react';

export default function Header({
  onOpenSidebar,
  onRefresh,
  isLoading,
  searchQuery,
  onSearchChange,
  backendOnline,
  onFocusAddForm
}) {
  return (
    <header className="dashboard-header">
      <div className="header-left">
        <button
          className="mobile-menu-btn"
          onClick={onOpenSidebar}
          aria-label="Toggle navigation menu"
        >
          <Menu size={22} />
        </button>

        <div className="header-title-group">
          <div className="app-title-row">
            <h1 className="header-app-name">WebSentry AI</h1>
            <span className="ai-badge">
              <Sparkles size={12} />
              <span>AI Engine</span>
            </span>
          </div>
          <p className="header-subtitle">
            Enterprise Website Security, Performance & Codebase Analyzer
          </p>
        </div>
      </div>

      <div className="header-right">
        {/* Search input */}
        <div className="header-search-bar">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="search-input"
          />
        </div>

        {/* Backend live status indicator */}
        <div
          className={`api-status-pill ${backendOnline ? 'status-online' : 'status-offline'}`}
          title={backendOnline ? 'Connected to http://localhost:5000' : 'Unable to connect to backend'}
        >
          <span className="status-dot-pulse" />
          <span className="status-pill-text">
            {backendOnline ? 'API Connected' : 'API Offline'}
          </span>
        </div>

        {/* Refresh button */}
        <button
          className="btn-icon"
          onClick={onRefresh}
          disabled={isLoading}
          title="Refresh project list from backend"
          aria-label="Refresh project list"
        >
          <RefreshCw size={18} className={isLoading ? 'spin-animation' : ''} />
        </button>

        {/* Quick add button */}
        <button className="btn-primary-header" onClick={onFocusAddForm}>
          <PlusCircle size={17} />
          <span>New Project</span>
        </button>
      </div>
    </header>
  );
}
