'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
}

export default function CreateProjectModal({ isOpen, onClose, isDarkMode }: CreateProjectModalProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    title: '',
    diagramType: '',
  });
  
  // Reset form when modal is openedd
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setFormData({ title: '', diagramType: '' });
      setError('');
    }
  }, [isOpen]);

  const diagramTypes = [
    { value: 'erd', label: 'Entity Relationship Diagram (ERD)', icon: '/diagrams/erd.svg' },
    { value: 'flowchart', label: 'Flowchart', icon: '/diagrams/flowchart.svg' },
    { value: 'sequence', label: 'Sequence Diagram', icon: '/diagrams/sequence.svg' },
    { value: 'class', label: 'Class Diagram', icon: '/diagrams/class.svg' },
    { value: 'state', label: 'State Diagram', icon: '/diagrams/state.svg' },
    { value: 'mindmap', label: 'Mind Map', icon: '/diagrams/mindmap.svg' },
    { value: 'timeline', label: 'Timeline', icon: '/diagrams/timeline.svg' },
    { value: 'gantt', label: 'Gantt Chart', icon: '/diagrams/gantt.svg' },
    { value: 'architecture', label: 'Architecture Diagram', icon: '/diagrams/flowchart.svg' },
    { value: 'git', label: 'Git Graph', icon: '/diagrams/git.svg' },
    { value: 'interactive', label: 'Interactive Editor (Claude 3.7)', icon: '/diagrams/interactive.svg' },
  ];

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create project');
      }

      const project = await response.json();
      router.push(`/projects/${project._id}`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleNext = () => {
    if (step === 1 && !formData.title.trim()) return;
    setStep(2);
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className={`${isDarkMode 
            ? "bg-[#201c1c] border-[#281c1c]/50" 
            : "bg-gradient-to-br from-white to-[#f0eee6]"} 
            rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border ${
            isDarkMode ? "border-[#281c1c]/50" : "border-gray-200/70"
          }`}
        >
          <form
            onSubmit={handleSubmit}
            className="relative"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (step === 1 && formData.title.trim()) {
                  e.preventDefault();
                  handleNext();
                } else if (step === 2 && formData.diagramType && !isSubmitting) {
                  e.preventDefault();
                  handleSubmit(e as unknown as React.FormEvent<HTMLFormElement>);
                }
              }
            }}
          >
            {/* Header with decorative elements */}
            <div className="relative">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-80"></div>
              
              <div className="p-6 border-b dark:border-[#281c1c]/70">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <h2 className="text-2xl font-semibold font-geist text-gray-900 dark:text-white">
                      Create New Diagram
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className={`p-2 rounded-full transition-colors ${
                      isDarkMode 
                        ? "hover:bg-gray-700/70 text-gray-300 hover:text-white" 
                        : "hover:bg-gray-100 text-gray-500 hover:text-gray-900"
                    }`}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 011.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
                
                {/* Progress Steps */}
                <div className="flex items-center space-x-4 mt-6">
                  <div className="flex items-center space-x-3 w-full">
                    <div 
                      className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                        step >= 1 
                          ? "bg-primary text-white" 
                          : isDarkMode ? "bg-gray-700 text-gray-300" : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      1
                    </div>
                    <div className={`h-1 flex-1 rounded-full ${
                      step >= 2 
                        ? "bg-primary" 
                        : isDarkMode ? "bg-gray-700" : "bg-gray-200"
                    }`} />
                    <div 
                      className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                        step >= 2 
                          ? "bg-primary text-white" 
                          : isDarkMode ? "bg-gray-700 text-gray-300" : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      2
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <div className="p-4 mx-6 mt-6 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg border border-red-200 dark:border-red-800/30 flex items-start space-x-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <p>{error}</p>
              </div>
            )}

            {/* Step Content */}
            <div className="p-6 min-h-[300px] flex items-center">
              <AnimatePresence mode="wait">
                {step === 1 && (
                  <motion.div
                    key="step1"
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 20, opacity: 0 }}
                    className="w-full"
                  >
                    <div className="flex flex-col space-y-6">
                      <div className="flex items-center space-x-3 text-primary">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        <h3 className="text-lg font-medium">Name Your Diagram</h3>
                      </div>
                      
                      <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                        What would you like to name your diagram?
                      </label>
                      
                      <div className={`relative rounded-xl overflow-hidden ${
                        isDarkMode 
                          ? "bg-[#281c1c]/70 border border-[#281c1c]" 
                          : "bg-white/80 border border-gray-200 shadow-sm"
                      }`}>
                        <input
                          type="text"
                          value={formData.title}
                          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                          className={`w-full px-4 py-3 bg-transparent focus:outline-none ${
                            isDarkMode ? "text-white placeholder-gray-500" : "text-gray-900 placeholder-gray-400"
                          }`}
                          placeholder="Enter a descriptive title..."
                          autoFocus
                        />
                        {formData.title && (
                          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-primary">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                      </div>
                      
                      <p className={`text-xs ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
                        Choose a clear, descriptive name that reflects the purpose of your diagram.
                      </p>
                    </div>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div
                    key="step2"
                    initial={{ x: 20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: -20, opacity: 0 }}
                    className="w-full space-y-6"
                  >
                    <div className="flex items-center space-x-3 text-primary">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                      </svg>
                      <h3 className="text-lg font-medium">Select Diagram Type</h3>
                    </div>
                    
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                      What type of diagram would you like to create?
                    </label>
                    
                    <div className="max-h-[320px] overflow-y-auto pr-2 custom-scrollbar">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                        {diagramTypes.map((type) => (
                          <motion.button
                            key={type.value}
                            type="button"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setFormData({ ...formData, diagramType: type.value })}
                            className={`flex items-center space-x-4 p-4 rounded-xl text-left transition-all ${
                              formData.diagramType === type.value
                                ? isDarkMode 
                                  ? "bg-primary/20 border-2 border-primary" 
                                  : "bg-primary/10 border-2 border-primary"
                                : isDarkMode 
                                  ? "bg-[#281c1c]/70 border border-[#281c1c] hover:border-primary/50" 
                                  : "bg-white/80 border border-gray-200 hover:border-primary/50 shadow-sm"
                            }`}
                          >
                            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                              formData.diagramType === type.value
                                ? "bg-primary/20"
                                : isDarkMode ? "bg-[#281c1c] border border-[#281c1c]/80" : "bg-gray-100"
                            }`}>
                              <Image 
                                src={type.icon} 
                                alt={type.label} 
                                width={32} 
                                height={32} 
                                className="w-8 h-8 object-contain" 
                              />
                            </div>
                            <div className="flex-1">
                              <div className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                {type.label.split(' ')[0]}
                              </div>
                              <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                {type.label.split(' ').slice(1).join(' ')}
                              </div>
                            </div>
                            {formData.diagramType === type.value && (
                              <div className="text-primary">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                              </div>
                            )}
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className={`p-6 border-t ${isDarkMode ? "border-gray-700/50" : "border-gray-200/70"} flex justify-between items-center`}>
              <button
                type="button"
                onClick={step === 1 ? onClose : handleBack}
                className={`px-5 py-2.5 rounded-xl transition-all flex items-center space-x-2 ${
                  isDarkMode 
                    ? "bg-gray-800 hover:bg-gray-700 text-white border border-gray-700" 
                    : "bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 shadow-sm"
                }`}
              >
                {step === 1 ? (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                    <span>Cancel</span>
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z" clipRule="evenodd" />
                    </svg>
                    <span>Back</span>
                  </>
                )}
              </button>
              
              {step < 2 ? (
                <motion.button
                  type="button"
                  onClick={handleNext}
                  disabled={!formData.title.trim()}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`px-5 py-2.5 rounded-xl bg-primary text-white transition-all flex items-center space-x-2 ${
                    !formData.title.trim() ? "opacity-50 cursor-not-allowed" : "hover:bg-primary-dark shadow-lg shadow-primary/20"
                  }`}
                >
                  <span>Next</span>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </motion.button>
              ) : (
                <motion.button
                  type="submit"
                  disabled={isSubmitting || !formData.title.trim() || !formData.diagramType}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`px-5 py-2.5 rounded-xl bg-primary text-white transition-all flex items-center space-x-2 ${
                    isSubmitting || !formData.title.trim() || !formData.diagramType 
                      ? "opacity-50 cursor-not-allowed" 
                      : "hover:bg-primary-dark shadow-lg shadow-primary/20"
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <span>Create Diagram</span>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </>
                  )}
                </motion.button>
              )}
            </div>
          </form>
        </motion.div>
      </motion.div>
      
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-track {
          background: ${isDarkMode ? 'rgba(31, 41, 55, 0.5)' : 'rgba(243, 244, 246, 0.5)'};
          border-radius: 10px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: ${isDarkMode ? 'rgba(75, 85, 99, 0.8)' : 'rgba(209, 213, 219, 0.8)'};
          border-radius: 10px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: ${isDarkMode ? 'rgba(107, 114, 128, 0.8)' : 'rgba(156, 163, 175, 0.8)'};
        }
      `}</style>
    </AnimatePresence>
  );
} 