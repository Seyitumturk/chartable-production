'use client';

import React, { useState } from 'react';
import { CanvasState } from './InteractiveCanvas';

interface InteractiveEditorToolbarProps {
  isDarkMode: boolean;
  clearCanvas: () => void;
  addNodeAtCenter: () => void;
  generateWithClaude: () => void;
  isGenerating: boolean;
  applyClaudeSuggestions: () => Promise<void>;
}

export const InteractiveEditorToolbar: React.FC<InteractiveEditorToolbarProps> = ({
  isDarkMode,
  clearCanvas,
  addNodeAtCenter,
  generateWithClaude,
  isGenerating,
  applyClaudeSuggestions,
}) => {
  const [showConfirmClear, setShowConfirmClear] = useState(false);

  return (
    <div className={`py-2 px-4 flex justify-between items-center border-b ${
      isDarkMode 
        ? 'bg-[#201c1c]/80 backdrop-blur-md border-[#282424]' 
        : 'bg-white/80 backdrop-blur-md border-[#e8dccc]'
    }`}>
      <div className="flex items-center space-x-2">
        <div className="flex items-center space-x-1">
          <button 
            className={`p-1.5 rounded-md text-sm flex items-center transition-colors ${
              isDarkMode 
                ? 'bg-[#282424] text-gray-300 hover:bg-gray-700' 
                : 'bg-[#f0eee6] text-gray-700 hover:bg-[#e8dccc]'
            }`}
            onClick={addNodeAtCenter}
            title="Add Node"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Add Node
          </button>
          
          {showConfirmClear ? (
            <div className={`flex items-center space-x-1 p-1 rounded-md ${
              isDarkMode ? 'bg-[#282424]' : 'bg-[#f0eee6]'
            }`}>
              <button 
                className={`px-2 py-1 rounded text-xs ${
                  isDarkMode 
                    ? 'bg-red-900/60 text-red-200 hover:bg-red-800/60' 
                    : 'bg-red-100 text-red-700 hover:bg-red-200'
                }`}
                onClick={() => {
                  clearCanvas();
                  setShowConfirmClear(false);
                }}
              >
                Confirm
              </button>
              <button 
                className={`px-2 py-1 rounded text-xs ${
                  isDarkMode 
                    ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' 
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
                onClick={() => setShowConfirmClear(false)}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button 
              className={`p-1.5 rounded-md text-sm flex items-center transition-colors ${
                isDarkMode 
                  ? 'bg-[#282424] text-gray-300 hover:bg-gray-700' 
                  : 'bg-[#f0eee6] text-gray-700 hover:bg-[#e8dccc]'
              }`}
              onClick={() => setShowConfirmClear(true)}
              title="Clear Canvas"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              Clear
            </button>
          )}
        </div>
      </div>
      
      <div className="flex items-center space-x-2">
        <button 
          className={`px-3 py-1.5 rounded-md text-sm flex items-center transition-colors ${
            isDarkMode 
              ? 'bg-[#282424] text-gray-300 hover:bg-gray-700' 
              : 'bg-[#f0eee6] text-gray-700 hover:bg-[#e8dccc]'
          }`}
          onClick={applyClaudeSuggestions}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
            <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
          </svg>
          Apply Suggestions
        </button>
        
        <button 
          className={`px-3 py-1.5 rounded-md text-sm flex items-center transition-colors ${
            isGenerating
              ? isDarkMode
                ? 'bg-green-800/40 text-green-200 cursor-wait'
                : 'bg-green-100 text-green-800 cursor-wait'
              : isDarkMode
                ? 'bg-teal-700 hover:bg-teal-600 text-white'
                : 'bg-teal-600 hover:bg-teal-500 text-white'
          }`}
          onClick={generateWithClaude}
          disabled={isGenerating}
        >
          <svg className={`h-4 w-4 mr-1.5 ${isGenerating ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            {isGenerating ? (
              <path d="M12 4.75V6.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
            ) : (
              <path d="M9.5 14.5L11.5 16.5L14.5 13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
            )}
            <path d="M12 22C16.9706 22 21 17.9706 21 13C21 8.02944 16.9706 4 12 4C7.02944 4
            3 8.02944 3 13C3 17.9706 7.02944 22 12 22Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
          </svg>
          {isGenerating ? 'Generating...' : 'Generate with Claude'}
        </button>
      </div>
    </div>
  );
}; 