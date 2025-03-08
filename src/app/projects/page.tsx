'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { UserButton } from '@clerk/nextjs';
import CreateProjectModal from '@/components/CreateProjectModal';
import { getProjects } from './actions';
import DeleteProjectModal from '@/components/DeleteProjectModal';
import Image from 'next/image';
import { motion } from 'framer-motion';
import PricingModal from '@/components/PricingModal';

interface Project {
  _id: string;
  title: string;
  diagramType: string;
  description?: string;
  updatedAt: string;
  userId: string;
  createdAt: string;
  __v: number;
  history?: Array<{
    diagram_img?: string;
    diagram: string;
  }>;
  diagramSVG?: string;
}

interface User {
  _id: string;
  wordCountBalance: number;
  hasStarterPlan?: boolean;
}

const EditableTitle = ({ 
  initialTitle, 
  projectId, 
  onUpdate 
}: { 
  initialTitle: string;
  projectId: string;
  onUpdate: (projectId: string, newTitle: string) => void;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSubmit = async () => {
    if (title.trim() === '') {
      setTitle(initialTitle);
      setIsEditing(false);
      return;
    }

    if (title !== initialTitle) {
      onUpdate(projectId, title);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    } else if (e.key === 'Escape') {
      setTitle(initialTitle);
      setIsEditing(false);
    }
  };

  const handleTitleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsEditing(true);
  };

  if (isEditing) {
    return (
      <div onClick={(e) => e.preventDefault()}>
        <input
          ref={inputRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleSubmit}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.preventDefault()}
          className="bg-transparent w-full font-semibold text-lg focus:outline-none focus:ring-2 focus:ring-primary rounded px-1"
        />
      </div>
    );
  }

  return (
    <h3 
      onClick={handleTitleClick}
      className="font-semibold text-lg mb-1 group-hover:text-primary transition-colors cursor-pointer hover:opacity-80"
    >
      {title}
    </h3>
  );
};

const DiagramPreview = ({ project }: { project: Project }) => {
  // Try to get the SVG from different sources
  const svgContent = 
    // First try the diagramSVG field
    project.diagramSVG || 
    // Then try the first history item's diagram_img
    (project.history && project.history[0]?.diagram_img) || 
    // Fallback to empty string if nothing is available
    '';
    
  // Get the most recent diagram code
  const diagramCode = 
    // Try to get the latest diagram code from history
    (project.history && project.history[0]?.diagram) ||
    // Fallback to empty string if not available
    '';
  
  if (!svgContent && !diagramCode) {
    return (
      <div className="flex items-center justify-center h-32 bg-gray-100 dark:bg-[#282424] rounded-lg">
        <span className="text-sm text-gray-500 dark:text-gray-400">No preview available</span>
      </div>
    );
  }
  
  return (
    <div className="relative h-32">
      <div 
        className="h-full w-full overflow-hidden bg-white dark:bg-[#282424] rounded-lg flex items-center justify-center"
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />
    </div>
  );
};

export default function ProjectsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const router = useRouter();

  const [isDarkMode, setIsDarkMode] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const filterScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const storedPref = localStorage.getItem('isDarkMode');
    if (storedPref !== null) {
      setIsDarkMode(storedPref === 'true');
    }
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('isDarkMode', isDarkMode.toString());
  }, [isDarkMode]);

  // Calculate projects that match the search query (case-insensitive)
  const filteredProjects = projects.filter(project => {
    const matchesSearch = project.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = !activeFilter || project.diagramType === activeFilter;
    return matchesSearch && matchesFilter;
  });

  // Get unique diagram types for filtering
  const diagramTypes = [...new Set(projects.map(project => project.diagramType))];

  useEffect(() => {
    async function loadInitialProjects() {
      setIsLoading(true);
      try {
        const data = await getProjects(1, 10);
        setProjects(data.projects);
        setUser(data.user);
        setHasMore(data.hasMore);
      } catch (error) {
        console.error('Failed to load projects:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadInitialProjects();
  }, []);

  const getDiagramIcon = (type: string) => {
    const iconPath = `/diagrams/${type}.svg`;
    return (
      <Image 
        src={iconPath} 
        alt={`${type} diagram icon`}
        className="w-full h-full object-contain"
        width={100}
        height={100}
      />
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  };

  const handleDeleteProject = (projectId: string) => {
    setProjects(projects.filter(project => project._id !== projectId));
  };

  async function loadMoreProjects() {
    const nextPage = page + 1;
    setIsLoadingMore(true);
    try {
      const data = await getProjects(nextPage, 10);
      setProjects(prevProjects => [...prevProjects, ...data.projects]);
      setPage(nextPage);
      setHasMore(data.hasMore);
    } catch (error) {
      console.error('Error loading more projects:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }

  const handleTitleUpdate = async (projectId: string, newTitle: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/update`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle }),
      });

      if (!response.ok) {
        throw new Error('Failed to update title');
      }

      // Update the projects state with the new title
      setProjects(prevProjects =>
        prevProjects.map(project =>
          project._id === projectId
            ? { ...project, title: newTitle }
            : project
        )
      );
    } catch (error) {
      console.error('Error updating project title:', error);
      // You might want to add error handling UI here
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!filterScrollRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - filterScrollRef.current.offsetLeft);
    setScrollLeft(filterScrollRef.current.scrollLeft);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!filterScrollRef.current) return;
    setIsDragging(true);
    setStartX(e.touches[0].pageX - filterScrollRef.current.offsetLeft);
    setScrollLeft(filterScrollRef.current.scrollLeft);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !filterScrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - filterScrollRef.current.offsetLeft;
    const walk = (x - startX) * 1.5; // Scroll speed multiplier
    filterScrollRef.current.scrollLeft = scrollLeft - walk;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || !filterScrollRef.current) return;
    const x = e.touches[0].pageX - filterScrollRef.current.offsetLeft;
    const walk = (x - startX) * 1.5; // Scroll speed multiplier
    filterScrollRef.current.scrollLeft = scrollLeft - walk;
  };

  return (
    <div className={`min-h-screen relative flex flex-col ${isDarkMode ? "bg-[#201c1c]" : "bg-gradient-to-br from-[#f0eee6] via-white to-[#f0eee6]"}`}>
      {/* Modern Navbar */}
      <nav
        className={`sticky top-0 z-50 h-16 backdrop-blur-md ${
          isDarkMode 
            ? "bg-[#201c1c]/80 border-b border-[#281c1c]/50" 
            : "bg-[#e8dccc]/80 border-b border-[#e8dccc]/50"
        }`}
      >
        <div className="container h-full mx-auto px-6 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <Link href="/" className="flex items-center space-x-3 hover:opacity-80 transition-all">
              <Image src="/logo-green.svg" alt="Chartable Logo" width={32} height={32} className="h-8 w-8" />
              <span className={`text-xl font-bold font-geist hidden md:block ${isDarkMode ? "text-white" : "text-gray-900"}`}>Chartable</span>
            </Link>
          </div>
          <div className="flex items-center space-x-6">
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`p-2 rounded-full ${isDarkMode ? "bg-gray-800 hover:bg-gray-700" : "bg-gray-100 hover:bg-gray-200"} transition-colors`}
              title="Toggle Dark Mode"
            >
              {isDarkMode ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.364 4.364l-1.414-1.414M7.05 7.05L5.636 5.636m12.728 0l-1.414 1.414M7.05 16.95l-1.414 1.414M12 8a4 4 0 100 8 4 4 0 000-8z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                </svg>
              )}
            </button>
            {user && (
              <div 
                className={`hidden md:flex items-center space-x-2 px-4 py-2 rounded-lg ${
                  isDarkMode ? "bg-gray-800/50" : "bg-gray-100/80"
                } cursor-pointer hover:bg-primary/10 transition-colors`}
                onClick={() => setIsPricingModalOpen(true)}
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className={`h-4 w-4 ${isDarkMode ? 'text-primary' : 'text-primary'}`} 
                  viewBox="0 0 20 20" 
                  fill="currentColor"
                >
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                </svg>
                <span className="text-sm font-medium">
                  <span className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Credits:</span>
                  <span className={`ml-1 font-mono ${isDarkMode ? 'text-white' : 'text-black'}`}>
                    {user.wordCountBalance.toLocaleString()}
                  </span>
                </span>
              </div>
            )}
            {user && (
              <div 
                className="md:hidden flex items-center space-x-1 cursor-pointer"
                onClick={() => setIsPricingModalOpen(true)}
              >
                <span className={`font-mono text-sm ${isDarkMode ? 'text-white' : 'text-black'}`}>
                  {user.wordCountBalance.toLocaleString()}
                </span>
              </div>
            )}
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </nav>
      <div className="w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-80" />

      <div className="container mx-auto px-4 md:px-6 py-8 flex-grow">
        {/* Hero Section */}
        <div className="mb-12 text-center">
          <motion.h1 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className={`text-4xl md:text-5xl font-bold mb-6 ${isDarkMode ? "text-white" : "text-gray-900"}`}
          >
            Your Diagrams
          </motion.h1>
          
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className={`relative max-w-2xl mx-auto px-6 py-4 rounded-lg ${
              isDarkMode ? "bg-[#281c1c]/60 border border-[#281c1c]/50" : "bg-[#e8dccc]/60 border border-[#d8cbb8]/50"
            } shadow-md`}
          >
            <p className={`text-xl ${isDarkMode ? "text-white" : "text-gray-900"}`}>
              Create, manage, and <span className="text-primary font-semibold">edit</span> your diagrams all in one place
            </p>
          </motion.div>
        </div>
        
        {/* Search and Filter Bar */}
        <div className="mb-10">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            {/* New Diagram button for mobile */}
            <button
              onClick={() => setIsModalOpen(true)}
              className="w-full md:hidden px-4 py-2.5 bg-primary hover:bg-primary-dark text-white rounded-xl transition-colors flex items-center justify-center space-x-2 shadow-lg shadow-primary/20"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              <span>New Diagram</span>
            </button>
            
            {/* Filters section */}
            <div className="relative w-full md:w-auto">
              <div 
                ref={filterScrollRef}
                className={`flex items-center space-x-2 overflow-x-auto pb-2 w-full md:max-w-[400px] cursor-grab ${isDragging ? 'cursor-grabbing' : 'cursor-grab'} no-scrollbar`}
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
                onMouseMove={handleMouseMove}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                onTouchMove={handleTouchMove}
              >
                <button
                  onClick={() => setActiveFilter(null)}
                  className={`px-3 py-1.5 text-sm rounded-full whitespace-nowrap transition-all flex-shrink-0 ${
                    activeFilter === null
                      ? (isDarkMode ? 'bg-primary text-white' : 'bg-primary text-white')
                      : (isDarkMode ? 'bg-[#281c1c] text-gray-300 hover:bg-[#281c1c]' : 'bg-gray-100 text-gray-700 hover:bg-gray-200')
                  }`}
                >
                  All
                </button>
                {diagramTypes.map(type => (
                  <button
                    key={type}
                    onClick={() => setActiveFilter(type)}
                    className={`px-3 py-1.5 text-sm rounded-full whitespace-nowrap flex items-center space-x-1 transition-all flex-shrink-0 ${
                      activeFilter === type
                        ? (isDarkMode ? 'bg-primary text-white' : 'bg-primary text-white')
                        : (isDarkMode ? 'bg-[#281c1c] text-gray-300 hover:bg-[#281c1c]' : 'bg-gray-100 text-gray-700 hover:bg-gray-200')
                    }`}
                  >
                    <span className="w-3 h-3">
                      {getDiagramIcon(type)}
                    </span>
                    <span>{type.replace('_', ' ')}</span>
                  </button>
                ))}
              </div>
            </div>
            
            {/* New Diagram button for desktop - pushed to the right */}
            <button
              onClick={() => setIsModalOpen(true)}
              className="hidden md:flex ml-auto px-4 py-2.5 bg-primary hover:bg-primary-dark text-white rounded-xl transition-colors items-center space-x-2 shadow-lg shadow-primary/20"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              <span>New Diagram</span>
            </button>
          </div>
          
          {/* Search moved under filters */}
          <div className="relative w-full md:w-96 flex-shrink-0 mt-4">
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full px-4 py-3 pl-10 rounded-xl ${
                isDarkMode ? "bg-[#281c1c]/70 text-white focus:bg-[#281c1c] border border-[#281c1c] focus:border-primary/50" : "bg-white text-gray-900 border border-gray-200 focus:border-primary/50"
              } focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all`}
            />
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1110.5 3a7.5 7.5 0 016.15 12.65z" />
              </svg>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className={`rounded-xl p-6 shadow-md animate-pulse ${isDarkMode ? 'bg-[#281c1c]/50' : 'bg-[#e8dccc]/50'}`}
              >
                <div className="h-48 bg-gray-200 dark:bg-[#201c1c] rounded-lg mb-4" />
                <div className="h-8 bg-gray-200 dark:bg-[#201c1c] rounded w-3/4 mb-4" />
                <div className="h-4 bg-gray-200 dark:bg-[#201c1c] rounded w-1/2 mb-2" />
                <div className="h-4 bg-gray-200 dark:bg-[#201c1c] rounded w-1/4" />
              </div>
            ))}
          </div>
        ) : projects.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className={`text-center py-16 px-4 rounded-2xl ${isDarkMode ? 'bg-[#281c1c]/50' : 'bg-[#e8dccc]/50'} shadow-xl`}
          >
            <div className="text-6xl mb-6">🎨</div>
            <h3 className={`text-2xl font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-black'}`}>
              No diagrams yet
            </h3>
            <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'} mb-8 max-w-md mx-auto`}>
              Create your first diagram to get started with visualizing your ideas
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-6 py-3 bg-primary hover:bg-primary-dark text-white rounded-xl transition-colors inline-flex items-center space-x-2 shadow-lg shadow-primary/20"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              <span>Create Diagram</span>
            </button>
          </motion.div>
        ) : searchQuery && filteredProjects.length === 0 ? (
          <div className={`text-center py-12 px-4 rounded-2xl ${isDarkMode ? 'bg-[#281c1c]/50' : 'bg-[#e8dccc]/50'} shadow-xl`}>
            <h3 className={`text-xl font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-black'}`}>
              No diagrams match &quot;{searchQuery}&quot;
            </h3>
            <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'} mb-4`}>
              Try a different search term or clear the filter
            </p>
            <button
              onClick={() => setSearchQuery('')}
              className="px-4 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors"
            >
              Clear Search
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProjects.map((project, index) => (
                <motion.div
                  key={project._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className={`group relative ${
                    isDarkMode ? 'bg-[#281c1c]/70 hover:bg-[#281c1c]' : 'bg-[#e8dccc]/70 hover:bg-[#e8dccc]'
                  } rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 border ${
                    isDarkMode ? 'border-[#201c1c]' : 'border-[#d8cbb8]'
                  }`}
                >
                  {/* Preview section - clickable */}
                  <Link
                    href={`/projects/${project._id}`}
                    className="block"
                  >
                    <div className={`h-48 ${
                      isDarkMode ? 'bg-gradient-to-br from-gray-900/50 to-gray-800/50 border-b border-gray-700/50' : 'bg-gradient-to-br from-[#f0eee6] to-[#e8dccc]/50 border-b border-[#d8cbb8]/50'
                    } p-4 flex items-center justify-center relative overflow-hidden group-hover:from-gray-100 group-hover:to-gray-200 dark:group-hover:from-gray-800/50 dark:group-hover:to-gray-700/50 transition-all duration-300`}>
                      <DiagramPreview project={project} />
                      
                      {/* Type badge */}
                      <div className={`absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-medium flex items-center space-x-1 ${
                        isDarkMode ? 'bg-[#281c1c]/70 text-gray-300' : 'bg-[#d8cbb8]/70 text-[#6a5c4c]'
                      }`}>
                        <span className="w-3 h-3 flex items-center justify-center">
                          {getDiagramIcon(project.diagramType)}
                        </span>
                        <span className="capitalize">{project.diagramType.replace('_', ' ')}</span>
                      </div>
                    </div>
                  </Link>

                  {/* Info section - title editable, rest clickable */}
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className={`${isDarkMode ? "text-white" : "text-black"}`}>
                          <EditableTitle
                            initialTitle={project.title}
                            projectId={project._id}
                            onUpdate={handleTitleUpdate}
                          />
                        </div>
                        <Link href={`/projects/${project._id}`}>
                          <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} flex items-center space-x-2 mt-1`}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>Updated {formatDate(project.updatedAt)}</span>
                          </p>
                        </Link>
                      </div>
                    </div>
                    {project.description && (
                      <Link href={`/projects/${project._id}`}>
                        <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'} text-sm line-clamp-2`}>
                          {project.description}
                        </p>
                      </Link>
                    )}
                    
                    {/* Action buttons */}
                    <div className="mt-6 flex items-center justify-between">
                      <Link 
                        href={`/projects/${project._id}`}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                          isDarkMode ? 'bg-[#281c1c] hover:bg-[#281c1c] text-white' : 'bg-[#d8cbb8] text-[#6a5c4c] hover:bg-[#c8bba8]'
                        } transition-colors flex items-center space-x-1`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        <span>View</span>
                      </Link>
                      
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          setProjectToDelete(project);
                        }}
                        className={`p-2 rounded-lg ${
                          isDarkMode ? 'text-red-400 hover:bg-red-900/20' : 'text-red-500 hover:bg-red-50'
                        } transition-colors`}
                        title="Delete project"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {!searchQuery && !activeFilter && hasMore && (
              <div className="flex justify-center py-8 mt-4">
                <button
                  onClick={loadMoreProjects}
                  disabled={isLoadingMore}
                  className={`px-6 py-3 rounded-xl ${
                    isDarkMode ? 'bg-[#281c1c] hover:bg-[#281c1c] text-white border border-[#281c1c]' : 'bg-[#e8dccc] hover:bg-[#d8cbb8] text-[#6a5c4c] border border-[#d8cbb8]'
                  } transition-colors shadow-sm flex items-center space-x-2`}
                >
                  {isLoadingMore ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Loading...</span>
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                      <span>Load More</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        )}

        <CreateProjectModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          isDarkMode={isDarkMode}
        />
        
        {projectToDelete && (
          <DeleteProjectModal
            isOpen={!!projectToDelete}
            projectId={projectToDelete._id}
            projectTitle={projectToDelete.title}
            onClose={() => setProjectToDelete(null)}
            onDelete={handleDeleteProject}
          />
        )}

        {user && (
          <PricingModal
            isOpen={isPricingModalOpen}
            onClose={() => setIsPricingModalOpen(false)}
            currentCredits={user.wordCountBalance}
            isDarkMode={isDarkMode}
            hasPurchasedStarter={user.hasStarterPlan || false}
          />
        )}
      </div>
      
      {/* Footer */}
      <footer className={`py-8 border-t ${isDarkMode ? 'border-gray-800' : 'border-[#e8dccc]'} mt-auto`}>
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <Image src="/logo-green.svg" alt="Chartable Logo" width={24} height={24} />
              <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-[#8a7a66]'}`}>
                © {new Date().getFullYear()} Chartable. All rights reserved.
              </span>
            </div>
            <div className="flex items-center space-x-6">
              <a href="#" className={`text-sm ${isDarkMode ? 'text-gray-400 hover:text-white' : 'text-[#8a7a66] hover:text-[#6a5c4c]'} transition-colors`}>
                Privacy
              </a>
              <a href="#" className={`text-sm ${isDarkMode ? 'text-gray-400 hover:text-white' : 'text-[#8a7a66] hover:text-[#6a5c4c]'} transition-colors`}>
                Terms
              </a>
              <a href="#" className={`text-sm ${isDarkMode ? 'text-gray-400 hover:text-white' : 'text-[#8a7a66] hover:text-[#6a5c4c]'} transition-colors`}>
                Help
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
} 