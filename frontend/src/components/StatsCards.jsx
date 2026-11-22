import React from 'react';
import { Globe, Database, Cpu, ShieldCheck } from 'lucide-react';

export default function StatsCards({ totalProjects, backendOnline }) {
  return (
    <div className="stats-grid">
      {/* Total Registered Projects */}
      <div className="stat-card">
        <div className="stat-card-glow" />
        <div className="stat-card-header">
          <span className="stat-label">Total Projects</span>
          <div className="stat-icon-wrapper purple">
            <Globe size={20} />
          </div>
        </div>
        <div className="stat-value-row">
          <span className="stat-number">{totalProjects}</span>
          <span className="stat-trend positive">Registered</span>
        </div>
        <p className="stat-footer-text">Managed targets in MySQL database</p>
      </div>

      {/* Database Connection */}
      <div className="stat-card">
        <div className="stat-card-glow" />
        <div className="stat-card-header">
          <span className="stat-label">Database Engine</span>
          <div className="stat-icon-wrapper blue">
            <Database size={20} />
          </div>
        </div>
        <div className="stat-value-row">
          <span className="stat-text-status">websentry_ai</span>
          <span className="stat-trend neutral">MySQL 8.0</span>
        </div>
        <p className="stat-footer-text">Table: `projects` (Active & Synced)</p>
      </div>

      {/* Analyzer Status */}
      <div className="stat-card">
        <div className="stat-card-glow" />
        <div className="stat-card-header">
          <span className="stat-label">Analyzer Engine</span>
          <div className="stat-icon-wrapper violet">
            <Cpu size={20} />
          </div>
        </div>
        <div className="stat-value-row">
          <span className="stat-text-status">
            {backendOnline ? 'Ready to Scan' : 'Waiting Server'}
          </span>
          <span className={`stat-trend ${backendOnline ? 'positive' : 'warning'}`}>
            {backendOnline ? 'Standby' : 'Paused'}
          </span>
        </div>
        <p className="stat-footer-text">Target URL crawler & AI evaluator</p>
      </div>

      {/* System Health */}
      <div className="stat-card">
        <div className="stat-card-glow" />
        <div className="stat-card-header">
          <span className="stat-label">Service Health</span>
          <div className="stat-icon-wrapper green">
            <ShieldCheck size={20} />
          </div>
        </div>
        <div className="stat-value-row">
          <span className="stat-text-status">
            {backendOnline ? '100% Operational' : 'Offline'}
          </span>
          <span className={`stat-trend ${backendOnline ? 'positive' : 'negative'}`}>
            {backendOnline ? '200 OK' : 'Unavailable'}
          </span>
        </div>
        <p className="stat-footer-text">Express REST API on port 5000</p>
      </div>
    </div>
  );
}
