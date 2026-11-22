import React, { useState, forwardRef } from 'react';
import { Plus, Globe, Link2, Sparkles, Check } from 'lucide-react';

const AddProjectForm = forwardRef(function AddProjectForm(
  { onProjectAdded, isSubmitting },
  ref
) {
  const [websiteName, setWebsiteName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [errors, setErrors] = useState({});

  const validate = () => {
    const errs = {};
    const trimmedName = websiteName.trim();
    const trimmedUrl = websiteUrl.trim();

    if (!trimmedName) {
      errs.websiteName = 'Website name is required.';
    } else if (trimmedName.length > 150) {
      errs.websiteName = 'Website name must be 150 characters or less.';
    }

    if (!trimmedUrl) {
      errs.websiteUrl = 'Website URL is required.';
    } else if (trimmedUrl.length > 500) {
      errs.websiteUrl = 'Website URL must be 500 characters or less.';
    } else {
      try {
        const parsed = new URL(trimmedUrl);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          errs.websiteUrl = 'URL must begin with http:// or https://';
        }
      } catch {
        errs.websiteUrl = 'Please enter a valid URL (e.g., https://example.com)';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    const success = await onProjectAdded({
      website_name: websiteName.trim(),
      website_url: websiteUrl.trim(),
    });

    if (success) {
      setWebsiteName('');
      setWebsiteUrl('');
      setErrors({});
    }
  };

  const handleQuickFill = (name, url) => {
    setWebsiteName(name);
    setWebsiteUrl(url);
    setErrors({});
  };

  return (
    <div className="add-project-card" ref={ref}>
      <div className="form-card-header">
        <div className="form-title-group">
          <div className="form-icon-pill">
            <Plus size={18} />
          </div>
          <div>
            <h2 className="form-card-title">Register New Website</h2>
            <p className="form-card-subtitle">
              Add a web application to monitor, track, and prepare for AI audits.
            </p>
          </div>
        </div>

        {/* Quick presets for convenience */}
        <div className="quick-fill-presets">
          <span className="preset-label">Quick samples:</span>
          <button
            type="button"
            className="preset-btn"
            onClick={() => handleQuickFill('GitHub Portal', 'https://github.com')}
          >
            GitHub
          </button>
          <button
            type="button"
            className="preset-btn"
            onClick={() => handleQuickFill('React Docs', 'https://react.dev')}
          >
            React
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="project-form" noValidate>
        <div className="form-fields-grid">
          {/* Website Name field */}
          <div className="form-group">
            <label htmlFor="website_name" className="form-label">
              <span>Website Name</span>
              <span className="required-star">*</span>
            </label>
            <div className={`input-wrapper ${errors.websiteName ? 'has-error' : ''}`}>
              <Globe size={18} className="input-icon" />
              <input
                id="website_name"
                type="text"
                className="form-input"
                placeholder="e.g. My SaaS Platform"
                value={websiteName}
                onChange={(e) => {
                  setWebsiteName(e.target.value);
                  if (errors.websiteName) setErrors({ ...errors, websiteName: null });
                }}
                disabled={isSubmitting}
                maxLength={150}
              />
            </div>
            {errors.websiteName && (
              <span className="field-error-text">{errors.websiteName}</span>
            )}
          </div>

          {/* Website URL field */}
          <div className="form-group">
            <label htmlFor="website_url" className="form-label">
              <span>Website URL</span>
              <span className="required-star">*</span>
            </label>
            <div className={`input-wrapper ${errors.websiteUrl ? 'has-error' : ''}`}>
              <Link2 size={18} className="input-icon" />
              <input
                id="website_url"
                type="url"
                className="form-input"
                placeholder="e.g. https://myapp.example.com"
                value={websiteUrl}
                onChange={(e) => {
                  setWebsiteUrl(e.target.value);
                  if (errors.websiteUrl) setErrors({ ...errors, websiteUrl: null });
                }}
                disabled={isSubmitting}
                maxLength={500}
              />
            </div>
            {errors.websiteUrl && (
              <span className="field-error-text">{errors.websiteUrl}</span>
            )}
          </div>
        </div>

        {/* Submit action row */}
        <div className="form-submit-row">
          <span className="form-hint">
            <Check size={14} className="hint-check" />
            Stored securely in MySQL <code>projects</code> table.
          </span>

          <button
            type="submit"
            className="btn-submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span className="spinner-sm" />
                <span>Registering...</span>
              </>
            ) : (
              <>
                <Sparkles size={16} />
                <span>Register Project</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
});

export default AddProjectForm;
