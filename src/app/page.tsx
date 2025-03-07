'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';

// Landing page component
export default function LandingPage() {
  const [videoLoaded, setVideoLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [prompt, setPrompt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.6 }
    }
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2
      }
    }
  };

  const handlePromptSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    
    setIsSubmitting(true);
    // This would normally send the prompt to the backend
    // For now, we'll just redirect to the projects page
    setTimeout(() => {
      window.location.href = '/projects';
    }, 1000);
  };

  useEffect(() => {
    const styleSheet = document.styleSheets[0];
    
    // Add hover effect
    styleSheet.insertRule(`
      .hover-text {
        position: relative;
        filter: brightness(1);
      }
    `, styleSheet.cssRules.length);
    
    styleSheet.insertRule(`
      .hover-text:hover {
        filter: brightness(1.2);
        text-shadow: 0 0 10px rgba(15, 224, 163, 0.2);
        transform: translateY(-1px);
      }
    `, styleSheet.cssRules.length);
    
    // Star background
    styleSheet.insertRule(`
      .stars-container {
        background-image: 
          radial-gradient(1px 1px at 25% 25%, rgba(255, 255, 255, 0.2) 1px, transparent 0),
          radial-gradient(1px 1px at 50% 50%, rgba(255, 255, 255, 0.2) 1px, transparent 0),
          radial-gradient(1px 1px at 75% 75%, rgba(255, 255, 255, 0.2) 1px, transparent 0),
          radial-gradient(2px 2px at 10% 10%, rgba(255, 255, 255, 0.3) 1px, transparent 0),
          radial-gradient(2px 2px at 30% 70%, rgba(255, 255, 255, 0.3) 1px, transparent 0),
          radial-gradient(2px 2px at 60% 20%, rgba(255, 255, 255, 0.3) 1px, transparent 0),
          radial-gradient(2px 2px at 90% 40%, rgba(255, 255, 255, 0.3) 1px, transparent 0);
        background-size: 100% 100%;
        animation: stars-move 120s linear infinite;
      }
    `, styleSheet.cssRules.length);
    
    // Tech grid
    styleSheet.insertRule(`
      .tech-grid {
        background-image: 
          linear-gradient(rgba(16, 185, 129, 0.05) 1px, transparent 1px),
          linear-gradient(to right, rgba(16, 185, 129, 0.05) 1px, transparent 1px);
        background-size: 40px 40px;
        animation: grid-move 60s linear infinite;
      }
    `, styleSheet.cssRules.length);
    
    // Glow orbs
    styleSheet.insertRule(`
      .glow-orb {
        animation: pulse-glow 8s ease-in-out infinite alternate;
      }
    `, styleSheet.cssRules.length);
    
    // Define animations
    styleSheet.insertRule(`
      @keyframes stars-move {
        0% {
          background-position: 0% 0%;
        }
        100% {
          background-position: 100% 100%;
        }
      }
    `, styleSheet.cssRules.length);
    
    styleSheet.insertRule(`
      @keyframes grid-move {
        0% {
          background-position: 0px 0px;
        }
        100% {
          background-position: 40px 40px;
        }
      }
    `, styleSheet.cssRules.length);
    
    styleSheet.insertRule(`
      @keyframes pulse-glow {
        0%, 100% {
          opacity: 0.2;
          transform: scale(1);
        }
        50% {
          opacity: 0.3;
          transform: scale(1.2);
        }
      }
    `, styleSheet.cssRules.length);
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-[#1a1a1a] to-[#282424] text-white relative overflow-hidden">
      {/* Space background elements */}
      <div className="absolute inset-0 z-0">
        <div className="stars-container absolute inset-0"></div>
        <div className="glow-orb absolute top-1/4 -left-[20%] w-[40%] h-[40%] rounded-full bg-[#10B981]/5 blur-[100px]"></div>
        <div className="glow-orb absolute bottom-1/4 -right-[20%] w-[40%] h-[40%] rounded-full bg-[#10B981]/5 blur-[100px]"></div>
        <div className="tech-grid absolute inset-0 opacity-10"></div>
      </div>
    
      {/* Content with relative positioning to appear above background */}
      <div className="relative z-10">
        {/* Announcement bar */}
        <div className="bg-[#1E293B] py-3 px-4 flex items-center justify-center text-sm text-white relative">
          <div className="flex items-center space-x-2">
            <span className="bg-[#10B981] text-[#1a1a1a] px-2 py-0.5 rounded-full text-xs font-semibold">NEW</span>
            <p>We've just launched our diagram sharing feature!</p>
            <Link href="/features" className="text-[#10B981] font-medium hover:underline ml-2">
              Learn more
            </Link>
          </div>
          <button className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Main navigation */}
        <header className="bg-[#121212]/80 backdrop-blur-md border-b border-gray-800 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              {/* Logo and brand */}
              <div className="flex items-center">
                <Link href="/" className="flex items-center">
                  <Image src="/logo-green.svg" alt="Chartable Logo" width={32} height={32} className="h-8 w-8 mr-2" />
                  <span className="text-white font-semibold text-xl">Chartable</span>
                </Link>
                {/* Navigation links */}
                <nav className="hidden md:ml-10 md:flex md:space-x-8">
                  <Link href="/features" className="text-gray-300 hover:text-white px-3 py-2 text-sm font-medium">Features</Link>
                  <Link href="/templates" className="text-gray-300 hover:text-white px-3 py-2 text-sm font-medium">Templates</Link>
                  <Link href="/pricing" className="text-gray-300 hover:text-white px-3 py-2 text-sm font-medium">Pricing</Link>
                  <Link href="/docs" className="text-gray-300 hover:text-white px-3 py-2 text-sm font-medium">Documentation</Link>
                </nav>
              </div>
              {/* Right-side buttons */}
              <div className="flex items-center space-x-4">
                <Link href="/sign-in" className="text-gray-300 hover:text-white text-sm font-medium">
                  Log in
                </Link>
                <Link href="/sign-up">
                  <button className="bg-gradient-to-r from-[#10B981] to-[#0bd999] px-4 py-2 rounded-md text-[#1a1a1a] text-sm font-medium hover:shadow-lg transition-all duration-300 flex items-center">
                    Get started
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-center text-center">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            className="max-w-4xl mx-auto"
          >
            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-tight leading-tight mb-3 text-gray-100">
              Where your prompt turns into{' '}
              <span className="hover-text inline-block bg-gradient-to-br from-[#0fe0a3] via-[#10B981] to-[#0fe0a3] bg-clip-text text-transparent transition-all duration-300">
                AI-Diagrams
              </span>
            </h1>
            <p className="mt-6 text-base sm:text-lg text-gray-300 max-w-2xl mx-auto">
              Transform your ideas into stunning, functional diagrams with Chartable—the ultimate 
              AI-powered tool for creating flowcharts, Gantt charts, ERDs, and more. Simplify your workflow and bring clarity to every project with ease.
            </p>
          </motion.div>

          {/* Prompt Input Section */}
          <motion.div 
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            className="mt-8 w-full max-w-2xl mx-auto"
          >
            <form onSubmit={handlePromptSubmit} className="relative">
              <div className="relative">
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Enter your diagram description here..."
                  className="w-full px-6 py-4 rounded-full bg-[#323232] border border-[#10B981]/20 shadow-md focus:outline-none focus:ring-2 focus:ring-[#10B981]/50 text-gray-200 placeholder-gray-400 pr-36"
                />
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-5 py-2.5 bg-gradient-to-r from-[#10B981] to-[#0bd999] rounded-full text-[#1a1a1a] font-medium shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-[#1a1a1a] border-t-transparent rounded-full animate-spin"></div>
                      <span>Generating...</span>
                    </div>
                  ) : (
                    'Generate Diagram'
                  )}
                </button>
              </div>
              <p className="mt-2 text-xs text-gray-400 text-left ml-4">
                Our AI will automatically select the best diagram type based on your description
              </p>
            </form>
          </motion.div>

          {/* Video Demo Section - Reduced top margin */}
          <motion.div 
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            className="mt-14 w-full max-w-4xl mx-auto relative"
          >
            <div className="aspect-video rounded-xl overflow-hidden border-2 border-[#10B981]/20 shadow-2xl">
              <div className="w-full h-full bg-[#1e1e1e] flex items-center justify-center relative">
                {/* Video element - Admin can replace this with an actual video */}
                <div className="w-full h-full min-h-[300px] bg-gradient-to-br from-[#323232] to-[#10B981]/10 flex items-center justify-center relative">
                  <div className="absolute inset-0 flex items-center justify-center flex-col gap-4">
                    <div className="bg-[#10B981] rounded-full p-3 cursor-pointer hover:scale-110 transition-transform duration-300">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-[#1a1a1a]" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                    <p className="text-center font-medium text-gray-300">Watch how Chartable works</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Features Section */}
        <section className="py-16 px-4 sm:px-6 lg:px-8 bg-[#232323]">
          <div className="max-w-7xl mx-auto">
            <motion.div 
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={fadeInUp}
              className="text-center mb-16"
            >
              <h2 className="text-3xl font-bold mb-4 text-gray-100">Supported Diagram Types</h2>
              <p className="text-lg text-gray-300 max-w-2xl mx-auto">
                Our AI can generate various types of diagrams to match your specific needs
              </p>
            </motion.div>

            <motion.div 
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={staggerContainer}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
            >
              {[
                { title: 'Flowcharts', description: 'Visualize processes and workflows', icon: '📊' },
                { title: 'ER Diagrams', description: 'Model database relationships', icon: '🔄' },
                { title: 'Sequence Diagrams', description: 'Illustrate object interactions', icon: '📝' },
                { title: 'Class Diagrams', description: 'Design object-oriented systems', icon: '📚' },
                { title: 'Gantt Charts', description: 'Schedule project timelines', icon: '📅' },
                { title: 'Mind Maps', description: 'Organize thoughts and ideas', icon: '🧠' },
              ].map((feature, index) => (
                <motion.div
                  key={index}
                  variants={fadeInUp}
                  className="bg-[#2a2a2a] p-6 rounded-xl shadow-lg border border-gray-700 hover:shadow-xl transition-shadow duration-300"
                >
                  <div className="text-4xl mb-4">{feature.icon}</div>
                  <h3 className="text-xl font-bold mb-2 text-gray-100">{feature.title}</h3>
                  <p className="text-gray-300">{feature.description}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-[#1a1a1a] to-[#282424]">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={fadeInUp}
            >
              <h2 className="text-3xl sm:text-4xl font-bold mb-6 text-gray-100">Ready to start creating diagrams?</h2>
              <p className="text-lg text-gray-300 mb-8 max-w-2xl mx-auto">
                Sign up today and transform your ideas into beautiful diagrams in seconds.
              </p>
              <Link href="/sign-up">
                <button className="cta-button px-8 py-4 bg-[#10B981] font-bold tracking-wider text-lg rounded-full shadow-[0_0_12px_rgba(16,185,129,0.5)] transition-transform duration-300 hover:scale-105 hover:shadow-[0_0_20px_rgba(16,185,129,0.8)] text-[#1a1a1a]">
                  Get Started Now
                </button>
              </Link>
            </motion.div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-10 px-4 border-t border-gray-200 dark:border-gray-800 mt-auto">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <span className="text-2xl font-bold bg-gradient-to-r from-[#10B981] to-[#8B5CF6] bg-clip-text text-transparent">
                Chartable
              </span>
            </div>
            <div className="flex space-x-6">
              <Link href="/projects" className="text-gray-600 dark:text-gray-300 hover:text-[#10B981] dark:hover:text-[#10B981] transition-colors">
                App
              </Link>
              <Link href="/sign-in" className="text-gray-600 dark:text-gray-300 hover:text-[#10B981] dark:hover:text-[#10B981] transition-colors">
                Sign In
              </Link>
              <Link href="/sign-up" className="text-gray-600 dark:text-gray-300 hover:text-[#10B981] dark:hover:text-[#10B981] transition-colors">
                Sign Up
              </Link>
            </div>
            <div className="mt-4 md:mt-0 text-sm text-gray-500">
              © {new Date().getFullYear()} Chartable. All rights reserved.
            </div>
          </div>
        </footer>

        {/* CSS for animations and effects */}
        <style jsx>{`
          .cta-button {
            position: relative;
            overflow: hidden;
            z-index: 0;
          }
          
          .cta-button::before {
            content: "";
            position: absolute;
            top: -2px;
            left: -2px;
            right: -2px;
            bottom: -2px;
            z-index: -1;
            border-radius: inherit;
            background: linear-gradient(45deg, #10B981, #8B5CF6, #3B82F6, #10B981);
            background-size: 400% 400%;
            animation: gradientBorder 3s ease infinite;
          }
          
          @keyframes gradientBorder {
            0% {
              background-position: 0% 50%;
            }
            50% {
              background-position: 100% 50%;
            }
            100% {
              background-position: 0% 50%;
            }
          }
        `}</style>
      </div>
    </div>
  );
}
