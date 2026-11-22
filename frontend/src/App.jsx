import React, { useState, useEffect, useCallback, useRef } from 'react';
import { projectService } from './services/api';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import StatsCards from './components/StatsCards';
import AddProjectForm from './components/AddProjectForm';
import ProjectList from './components/ProjectList';
import DeleteModal from './components/DeleteModal';
import Toast from './components/Toast';
import './App.css';

export default function App() {
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [notification, setNotification] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [backendOnline, setBackendOnline] = useState(true);

  const addFormRef = useRef(null);

  const fetchProjects = useCallback(async (showLoading = false) => {
    if (showLoading) setIsLoading(true);
    try {
      const response = await projectService.getAll();
      if (response && response.success) {
        setProjects(response.projects || []);
        setBackendOnline(true);
      }
    } catch (err) {
      console.error('Failed to fetch projects:', err);
      setBackendOnline(false);
      setNotification({
        type: 'error',
        message:
          err.response?.data?.message ||
          'Could not reach backend API at http://localhost:5000. Is the server running?'
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    let isMounted = true;
    async function initLoad() {
      try {
        const [projRes] = await Promise.allSettled([
          projectService.getAll(),
          projectService.checkHealth()
        ]);
        if (!isMounted) return;
        if (projRes.status === 'fulfilled' && projRes.value?.success) {
          setProjects(projRes.value.projects || []);
          setBackendOnline(true);
        } else {
          setBackendOnline(false);
        }
      } catch {
        if (isMounted) setBackendOnline(false);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    initLoad();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleCreateProject = async (formData) => {
    setIsSubmitting(true);
    try {
      const res = await projectService.create(formData);
      if (res && res.success) {
        setNotification({
          type: 'success',
          message: `Project "${formData.website_name}" registered successfully!`
        });
        await fetchProjects();
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error creating project:', err);
      const errMsg =
        err.response?.data?.message ||
        err.message ||
        'Failed to register website project.';
      setNotification({
        type: 'error',
        message: errMsg
      });
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!projectToDelete) return;

    setIsDeleting(true);
    try {
      const res = await projectService.delete(projectToDelete.id);
      if (res && res.success) {
        setNotification({
          type: 'success',
          message: `Project "${projectToDelete.website_name}" deleted from database.`
        });
        setProjectToDelete(null);
        await fetchProjects();
      }
    } catch (err) {
      console.error('Error deleting project:', err);
      const errMsg =
        err.response?.data?.message ||
        err.message ||
        'Failed to delete project.';
      setNotification({
        type: 'error',
        message: errMsg
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const scrollToForm = () => {
    if (addFormRef.current) {
      addFormRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const input = addFormRef.current.querySelector('#website_name');
      if (input) input.focus();
    }
  };

  return (
    <div className="dashboard-layout">
      {/* Toast Notification */}
      <Toast notification={notification} onClose={() => setNotification(null)} />

      {/* Responsive Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
        backendOnline={backendOnline}
        projectCount={projects.length}
      />

      {/* Main Content Area */}
      <div className="main-wrapper">
        <Header
          onOpenSidebar={() => setSidebarOpen(true)}
          onRefresh={() => fetchProjects(true)}
          isLoading={isLoading}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          backendOnline={backendOnline}
          onFocusAddForm={scrollToForm}
        />

        <main className="dashboard-content">
          {/* Stats Section */}
          <StatsCards
            totalProjects={projects.length}
            backendOnline={backendOnline}
          />

          {/* Add Project Form Card */}
          <AddProjectForm
            ref={addFormRef}
            onProjectAdded={handleCreateProject}
            isSubmitting={isSubmitting}
          />

          {/* Project List Section */}
          <ProjectList
            projects={projects}
            isLoading={isLoading}
            onDeleteClick={(proj) => setProjectToDelete(proj)}
            searchQuery={searchQuery}
            onClearSearch={() => setSearchQuery('')}
            onFocusAddForm={scrollToForm}
          />
        </main>
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteModal
        project={projectToDelete}
        isOpen={!!projectToDelete}
        isDeleting={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setProjectToDelete(null)}
      />
    </div>
  );
}
