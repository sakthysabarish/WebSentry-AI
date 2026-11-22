import React from 'react';
import {
  Globe,
  Trash2,
  Calendar,
  Layers,
  SearchX,
  ArrowUpRight
} from 'lucide-react';

export default function ProjectList({
  projects,
  isLoading,
  onDeleteClick,
  searchQuery,
  onClearSearch,
  onFocusAddForm
}) {
  const filteredProjects = projects.filter((p) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const nameMatch = p.website_name && p.website_name.toLowerCase().includes(query);
    const urlMatch = p.website_url && p.website_url.toLowerCase().includes(query);
    const idMatch = String(p.id).includes(query);
    return nameMatch || urlMatch || idMatch;
  });

  const formatDate = (dateString) => {
    if (!dateString) return 'Just now';
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    } catch {
      return dateString;
    }
  };

  return (
    <div className="project-list-section">
      <div className="section-header-row">
        <div>
          <h2 className="section-title">Registered Web Applications</h2>
          <p className="section-subtitle">
            Showing {filteredProjects.length} of {projects.length} targets saved in the database
          </p>
        </div>

        {searchQuery && (
          <div className="search-filter-tag">
            <span>Filter: "{searchQuery}"</span>
            <button onClick={onClearSearch} className="clear-filter-btn">
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Loading state skeleton */}
      {isLoading && (
        <div className="skeleton-grid">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton-card">
              <div className="skeleton-line shimmer title" />
              <div className="skeleton-line shimmer url" />
              <div className="skeleton-line shimmer footer" />
            </div>
          ))}
        </div>
      )}

      {/* Empty State: No projects registered at all */}
      {!isLoading && projects.length === 0 && (
        <div className="empty-state-card">
          <div className="empty-icon-wrapper">
            <Layers size={40} className="empty-icon" />
          </div>
          <h3 className="empty-title">No Projects Registered Yet</h3>
          <p className="empty-desc">
            Get started by entering your target website name and URL in the form above.
            The backend will store it in MySQL for automated analysis.
          </p>
          <button className="btn-primary" onClick={onFocusAddForm}>
            Add Your First Project
          </button>
        </div>
      )}

      {/* Empty State: Search filter found nothing */}
      {!isLoading && projects.length > 0 && filteredProjects.length === 0 && (
        <div className="empty-state-card">
          <div className="empty-icon-wrapper">
            <SearchX size={36} className="empty-icon" />
          </div>
          <h3 className="empty-title">No Matching Projects Found</h3>
          <p className="empty-desc">
            No projects match the search query "{searchQuery}".
          </p>
          <button className="btn-secondary" onClick={onClearSearch}>
            Clear Search Filter
          </button>
        </div>
      )}

      {/* Projects Grid / Table */}
      {!isLoading && filteredProjects.length > 0 && (
        <div className="projects-grid">
          {filteredProjects.map((project) => (
            <div key={project.id} className="project-card">
              <div className="project-card-top">
                <div className="project-id-badge">
                  <span>#{project.id}</span>
                </div>
                <div className="project-status-pill">
                  <span className="dot-active" />
                  <span>Ready for Audit</span>
                </div>
              </div>

              <div className="project-main-info">
                <div className="website-name-row">
                  <div className="project-avatar">
                    <Globe size={18} />
                  </div>
                  <h3 className="project-name" title={project.website_name}>
                    {project.website_name}
                  </h3>
                </div>

                <a
                  href={project.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="project-url-link"
                  title="Open website in new tab"
                >
                  <span className="url-text">{project.website_url}</span>
                  <ArrowUpRight size={14} className="external-icon" />
                </a>
              </div>

              <div className="project-card-divider" />

              <div className="project-card-bottom">
                <div className="project-date">
                  <Calendar size={13} className="date-icon" />
                  <span>{formatDate(project.created_at)}</span>
                </div>

                <div className="project-actions">
                  <button
                    type="button"
                    className="btn-action-delete"
                    onClick={() => onDeleteClick(project)}
                    title="Delete project"
                    aria-label={`Delete project ${project.website_name}`}
                  >
                    <Trash2 size={16} />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
