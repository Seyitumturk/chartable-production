'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface PromptPanelProps {
  isDarkMode: boolean;
  onPromptSubmit: (prompt: string) => Promise<void>;
  isGenerating: boolean;
  messages: Message[];
  onClearChat: () => void;
}

export const PromptPanel: React.FC<PromptPanelProps> = ({
  isDarkMode,
  onPromptSubmit,
  isGenerating,
  messages,
  onClearChat,
}) => {
  const [prompt, setPrompt] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea based on content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [prompt]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isGenerating) return;

    await onPromptSubmit(prompt);
    setPrompt('');
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const formatTimestamp = (date: Date) => {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className={`px-4 py-3 flex items-center justify-between border-b ${
        isDarkMode ? 'border-[#282424]' : 'border-[#e8dccc]'
      }`}>
        <h3 className={`font-medium text-base flex items-center ${
          isDarkMode ? 'text-white' : 'text-gray-800'
        }`}>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-teal-500" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
          </svg>
          Claude Assistant
        </h3>
        <button
          onClick={onClearChat}
          className={`p-1.5 rounded-md transition-colors ${
            isDarkMode 
              ? 'hover:bg-[#282424] text-gray-400 hover:text-gray-300' 
              : 'hover:bg-[#f0eee6] text-gray-500 hover:text-gray-700'
          }`}
          title="Clear chat"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 chat-scroll-container"
      >
        {messages.length === 0 ? (
          <div className={`text-center py-8 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p>Start a conversation with Claude</p>
            <p className="text-sm mt-2">
              Ask for help with your interactive diagram or request Claude to generate a new one.
            </p>
          </div>
        ) : (
          messages.map((message, index) => (
            <div 
              key={index}
              className={`animate-fadeIn ${
                message.role === 'user' ? 'ml-4' : 'mr-4'
              }`}
            >
              <div className={`flex items-start ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}>
                {message.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 mr-2">
                    <img 
                      src="/claude-avatar.png" 
                      alt="Claude" 
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = "https://www.anthropic.com/images/favicon.ico";
                      }}
                    />
                  </div>
                )}
                <div className={`max-w-[85%] rounded-lg px-4 py-2 ${
                  message.role === 'user'
                    ? isDarkMode 
                      ? 'bg-teal-700 text-white' 
                      : 'bg-teal-600 text-white'
                    : isDarkMode 
                      ? 'bg-[#282424] text-gray-200' 
                      : 'bg-[#f0eee6] text-gray-800'
                }`}>
                  <div className="whitespace-pre-wrap text-sm">
                    {message.content}
                  </div>
                  <div className={`text-xs mt-1 ${
                    message.role === 'user'
                      ? isDarkMode ? 'text-teal-300' : 'text-teal-200'
                      : isDarkMode ? 'text-gray-500' : 'text-gray-500'
                  }`}>
                    {formatTimestamp(message.timestamp)}
                  </div>
                </div>
                {message.role === 'user' && (
                  <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 ml-2 bg-gray-300 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-700" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className={`p-3 border-t ${
        isDarkMode ? 'border-[#282424]' : 'border-[#e8dccc]'
      }`}>
        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Claude about your diagram..."
              className={`w-full p-3 pr-10 rounded-lg resize-none transition-colors ${
                isDarkMode 
                  ? 'bg-[#282424] text-white placeholder-gray-500 focus:ring-1 focus:ring-teal-500 border-none' 
                  : 'bg-[#f0eee6] text-gray-800 placeholder-gray-500 focus:ring-1 focus:ring-teal-500 border-none'
              }`}
              rows={1}
              disabled={isGenerating}
            />
            <button
              type="submit"
              disabled={!prompt.trim() || isGenerating}
              className={`absolute right-2 bottom-2 p-1.5 rounded-md transition-colors ${
                !prompt.trim() || isGenerating
                  ? isDarkMode ? 'text-gray-600' : 'text-gray-400'
                  : isDarkMode ? 'text-teal-400 hover:bg-[#343030]' : 'text-teal-600 hover:bg-[#e8dccc]'
              }`}
            >
              {isGenerating ? (
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          </div>
          <div className={`text-xs mt-1.5 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
            Press Enter to send, Shift+Enter for new line
          </div>
        </form>
      </div>
    </div>
  );
}; 