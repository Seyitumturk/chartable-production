import { useState, useEffect, useRef, useCallback } from 'react';
import useLocalStorage from '@/lib/useLocalStorage';
import { EditorProps, MermaidTheme } from './types';
import { ChatMessageData } from '../chatMessage/types';

// Import specialized hooks
import useHistory from './hooks/useHistory';
import useDiagramRendering from './hooks/useDiagramRendering';
import useDiagramExport from './hooks/useDiagramExport';
import useZoomAndPan from './hooks/useZoomAndPan';
import useFileProcessing from './hooks/useFileProcessing';
import useImageProcessing from './hooks/useImageProcessing';

function useDiagramEditor({ projectId, projectTitle, diagramType, initialDiagram, user, history: initialHistory }: EditorProps) {
  // --- Core state ---
  const [prompt, setPrompt] = useState('');
  const [lastPrompt, setLastPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [showPromptPanel, setShowPromptPanel] = useState(true);
  const [svgOutput, _setSvgOutput] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [versionId, setVersionId] = useState<string>('');
  const [isVersionSelectionInProgress, setIsVersionSelectionInProgress] = useState<boolean>(false);
  const [isEditorReady, setIsEditorReady] = useState(false);
  const [editorMode, setEditorMode] = useState<'chat' | 'code'>('chat');
  const [documentSummary, setDocumentSummary] = useState('');
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // --- Theme state ---
  const [currentTheme, setCurrentTheme] = useLocalStorage<MermaidTheme>('mermaid-theme', 'default');
  const [isDarkMode, setIsDarkMode] = useLocalStorage('dark-mode', false);

  // --- Loading and error states ---
  const [isDownloading, setIsDownloading] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  
  // Add a state to track when chat history is loading
  const [isChatHistoryLoading, setIsChatHistoryLoading] = useState(false);
  
  // Add a ref to always track the latest SVG to ensure it's available for saves
  const latestSvgRef = useRef<string>('');

  // --- Refs ---
  const diagramRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // --- Module imports ---
  const { 
    currentDiagram, 
    setCurrentDiagram, 
    diagramHistory, 
    setDiagramHistory,
    updateHistory
  } = useHistory({ initialDiagram, initialHistory });

  // Create a wrapper for setSvgOutput that also updates the ref
  const setSvgOutput = useCallback((value: React.SetStateAction<string>) => {
    if (typeof value === 'function') {
      _setSvgOutput(prevSvg => {
        const newSvg = value(prevSvg);
        if (newSvg && newSvg.length > 0) {
          latestSvgRef.current = newSvg;
          console.log(`[setSvgOutput] Updated latestSvgRef with SVG, length: ${newSvg.length}`);
        }
        return newSvg;
      });
    } else {
      // It's a direct string value
      if (value && value.length > 0) {
        latestSvgRef.current = value;
        console.log(`[setSvgOutput] Updated latestSvgRef with SVG, length: ${value.length}`);
      }
      _setSvgOutput(value);
    }
  }, []);

  // Function to persist history changes to the database
  const persistHistory = async (historyData: {
    prompt?: string;
    diagram: string;
    diagram_img?: string;
    updateType: 'chat' | 'code' | 'reversion';
  }) => {
    try {
      console.log(`[persistHistory] Persisting diagram to database, projectId: ${projectId}`);
      const response = await fetch('/api/project-history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId,
          ...historyData
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to save history: ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`[persistHistory] History saved successfully:`, data);
      return true;
    } catch (error) {
      console.error(`[persistHistory] Error saving history:`, error);
      return false;
    }
  };

  const {
    renderDiagram,
    handleCodeChange,
    changeTheme,
  } = useDiagramRendering({
    currentDiagram,
    setCurrentDiagram,
    setSvgOutput,
    setVersionId,
    setRenderError,
    currentTheme,
    setCurrentTheme,
    diagramType
  });

  const {
    scale, 
    setScale, 
    position, 
    setPosition,
    isDragging,
    setIsDragging,
    handleMouseDown
  } = useZoomAndPan();

  const {
    downloadSVG,
    downloadPNG,
  } = useDiagramExport({
    projectTitle,
    svgRef,
    svgOutput,
    setIsDownloading,
    diagramType
  });

  const {
    processDocument: originalProcessDocument,
    processWebsite,
    handleFileUpload
  } = useFileProcessing({
    setPrompt,
    setError
  });

  // Wrap the processDocument function to update documentSummary
  const processDocument = async (file: File) => {
    const textContent = await file.text();
    setDocumentSummary(textContent.substring(0, 1000) + (textContent.length > 1000 ? '...' : ''));
    return originalProcessDocument(file);
  };

  const {
    processImage,
    handleImageUpload
  } = useImageProcessing({
    setIsUploadingImage,
    setPrompt,
    setError
  });

  // Modify state variables for retry functionality
  const [isRetrying, setIsRetrying] = useState<boolean>(false);
  // Remove auto-retry related states
  const [lastErrorMessage, setLastErrorMessage] = useState<string>('');

  // Modify the handleGenerateDiagram function to simplify error handling
  const handleGenerateDiagram = async (e: React.FormEvent<HTMLFormElement> | null, initialPrompt?: string, isRetry: boolean = false, failureReason?: string) => {
    if (e) e.preventDefault();
    
    // Clear any previous errors
    setError('');
    
    // Get the prompt value
    const promptToUse = initialPrompt || prompt;
    
    // Store last prompt for retry functionality
    setLastPrompt(promptToUse);
    
    // Don't proceed if no prompt or if currently generating or retrying
    if (!promptToUse || isGenerating) {
      return;
    }
    
    // Update retry state
    if (isRetry) {
      setIsRetrying(true);
    } else {
      setIsRetrying(false);
    }

    setIsGenerating(true);
    
    // Add user message to chat
    const userMessage: ChatMessageData = {
      role: 'user',
      content: promptToUse,
      timestamp: new Date(),
    };
    
    // Add typing indicator message
    const typingMessage: ChatMessageData = {
      role: 'assistant',
      content: 'Generating your diagram...',
      timestamp: new Date(),
      isTyping: true,
      isRetrying: isRetry,
    };
    
    // Only add user message if it's not a retry attempt
    if (!isRetry) {
      setMessages(prev => [...prev, userMessage, typingMessage]);
    } else {
      // If it's a retry, add a retry notification and a new typing indicator
      const retryNotification: ChatMessageData = {
        role: 'assistant',
        content: 'Retrying diagram generation...',
        timestamp: new Date(),
        isSystemNotification: true,
      };
      
      // Replace the last typing message with the retry notification and a new typing indicator
      setMessages(prev => {
        // Filter out the previous typing message
        const withoutTyping = prev.filter(msg => !msg.isTyping);
        // Add the retry notification and a new typing indicator
        return [...withoutTyping, retryNotification, typingMessage];
      });
    }

    try {
      // Use currentMessagesForContext to prepare chat history
      // but skip the last two messages (user prompt and typing indicator)
      // so we don't duplicate them in the request
      const currentMessagesForContext = isRetry 
        ? messages
            .filter(msg => 
              !msg.isRetrying && 
              !msg.isTyping && 
              !msg.error && 
              !msg.isSystemNotification && 
              (msg.role === 'user' || msg.role === 'assistant')
            ) // Filter out all system messages and notifications
        : messages
            .slice(0, -2)
            .filter(msg => msg.role === 'user' || msg.role === 'assistant'); // Only include user and assistant roles

      // Configure request options
      const options: RequestInit = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          textPrompt: promptToUse,
          diagramType,
          projectId,
          clientSvg: svgOutput,
          chatHistory: currentMessagesForContext,
          isRetry: isRetry,
          clearCache: isRetry, // Clear cache on retry attempts
          failureReason: failureReason || lastErrorMessage, // Pass the failure reason to the API
        }),
      };

      console.log(`[handleGenerateDiagram] Calling /api/diagrams API endpoint with projectId: ${projectId}, diagramType: ${diagramType}`);
      console.log(`[handleGenerateDiagram] Including SVG in request: ${!!svgOutput}, SVG length: ${svgOutput?.length || 0}`);
      
      // Call API to generate diagram with streaming response
      const response = await fetch('/api/diagrams', options);

      console.log(`[handleGenerateDiagram] API response status: ${response.status}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Failed to generate diagram: ${response.status}`);
      }

      // Check if response is a stream
      const contentType = response.headers.get('content-type');
      console.log(`[handleGenerateDiagram] Response content type: ${contentType}`);
      
      if (contentType && contentType.includes('text/event-stream')) {
        // Handle streaming response
        const reader = response.body?.getReader();
        if (!reader) throw new Error('Response body is not readable');
        
        const decoder = new TextDecoder();
        let receivedDiagram = '';
        let explanation = '';
        let isComplete = false;
        let hasError = false;
        let errorMessage = '';
        let allErrorMessages: string[] = []; // Collect all error messages during streaming
        let isFinalError = false; // Flag to track if we're at the final error state
        let isStreamActive = true; // New flag to track if streaming is active
        
        while (!isComplete) {
          const { done, value } = await reader.read();
          
          if (done) {
            isComplete = true;
            isStreamActive = false; // Mark streaming as complete
            break;
          }
          
          // Process the chunk
          const chunk = decoder.decode(value, { stream: true });
          
          // Properly handle SSE format - split by double newlines for event boundaries
          // and then by single newlines for data lines
          const events = chunk.split(/\n\n+/);
          
          for (const event of events) {
            if (!event.trim()) continue;
            
            // Extract data lines from the event
            const lines = event.split('\n');
            
            for (const line of lines) {
              if (line.trim().startsWith('data:')) {
                try {
                  // Extract JSON from "data: {json}"
                  const jsonStr = line.trim().substring(5).trim();
                  if (!jsonStr) continue;
                  
                  const data = JSON.parse(jsonStr);
                  
                  // Silently collect errors during streaming, don't display them
                  if (data.error) {
                    // Just collect the error info, don't set state or display it
                    hasError = true;
                    errorMessage = data.errorMessage || 'Failed to generate diagram';
                    
                    // Collect error message but don't display or throw
                    if (errorMessage && !allErrorMessages.includes(errorMessage)) {
                      allErrorMessages.push(errorMessage);
                      console.log(`[handleGenerateDiagram] Collected streaming error (not displaying): ${errorMessage}`);
                    }
                    
                    // Mark as final error only if explicitly complete
                    if (data.isComplete) {
                      isComplete = true;
                      isFinalError = true;
                      isStreamActive = false; // Mark streaming as complete
                      break;
                    }
                    
                    // Skip completely - no state updates for streaming errors
                    continue;
                  }
                  
                  // If we got mermaid syntax, update the diagram
                  if (data.mermaidSyntax) {
                    receivedDiagram = data.mermaidSyntax;
                    // Update current diagram in real-time if we have syntax
                    setCurrentDiagram(receivedDiagram);
                    // Render the updated diagram immediately
                    const renderSuccess = await renderDiagram(receivedDiagram);
                    console.log(`[handleGenerateDiagram] Diagram rendered successfully: ${renderSuccess}, SVG length after render: ${svgOutput?.length || 0}`);
                    
                    // Track successful renders for improved save reliability
                    if (renderSuccess && svgOutput && svgOutput.length > 0) {
                      console.log(`[handleGenerateDiagram] Successfully rendered diagram with SVG length: ${svgOutput.length}`);
                      latestSvgRef.current = svgOutput; // Explicitly update the ref for safety
                    }
                    
                    // If we still don't have SVG output after rendering, try rendering again with increased delay
                    if ((!svgOutput || svgOutput.length === 0) && renderSuccess) {
                      console.log(`[handleGenerateDiagram] Initial render didn't produce SVG, rendering again`);
                      setTimeout(async () => {
                        const reRenderSuccess = await renderDiagram(receivedDiagram);
                        console.log(`[handleGenerateDiagram] Re-render result: ${reRenderSuccess}, SVG length: ${svgOutput?.length || 0}`);
                        if (reRenderSuccess && svgOutput && svgOutput.length > 0) {
                          latestSvgRef.current = svgOutput;
                        }
                      }, 500); // Increased from 200ms to 500ms for better reliability
                    }
                  }
                  
                  if (data.explanation) {
                    explanation = data.explanation;
                  }
                  
                  if (data.isComplete && data.gptResponseId) {
                    console.log(`[handleGenerateDiagram] Stream complete, gptResponseId: ${data.gptResponseId}`);
                    isComplete = true;
                    isStreamActive = false; // Mark streaming as complete
                    
                    // Immediately save the current SVG if available
                    const immediateCurrentSvg = svgOutput || latestSvgRef.current;
                    if (immediateCurrentSvg && immediateCurrentSvg.length > 0) {
                      console.log(`[handleGenerateDiagram] Saving immediate SVG, length: ${immediateCurrentSvg.length}`);
                      try {
                        const saveSvgResponse = await fetch('/api/diagrams/save-svg', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                          },
                          body: JSON.stringify({
                            projectId,
                            gptResponseId: data.gptResponseId,
                            svg: immediateCurrentSvg
                          }),
                        });
                        console.log(`[handleGenerateDiagram] Immediate SVG save response: ${saveSvgResponse.status}`);
                      } catch (error) {
                        console.error('[handleGenerateDiagram] Error saving immediate SVG:', error);
                      }
                    }
                    
                    // Wait a moment for final rendering to complete, then save the SVG again
                    setTimeout(async () => {
                      // Get the most recent SVG output
                      const currentSvg = svgOutput || latestSvgRef.current;
                      
                      // Perform one final render attempt if needed
                      if (!currentSvg || currentSvg.length === 0) {
                        console.log(`[handleGenerateDiagram] No SVG available at stream completion, attempting final render`);
                        if (receivedDiagram && receivedDiagram.length > 0) {
                          const finalRenderSuccess = await renderDiagram(receivedDiagram);
                          console.log(`[handleGenerateDiagram] Final render attempt result: ${finalRenderSuccess}, svg length now: ${svgOutput?.length || 0}`);
                          // Update latest SVG ref after final render
                          if (svgOutput && svgOutput.length > 0) {
                            latestSvgRef.current = svgOutput;
                          }
                        }
                      }
                      
                      // Now try to save whatever SVG we have
                      const svgToSave = svgOutput || latestSvgRef.current;
                      if (svgToSave && svgToSave.length > 0) {
                        console.log(`[handleGenerateDiagram] Saving SVG separately after stream completion, SVG length: ${svgToSave.length}`);
                        try {
                          const saveSvgResponse = await fetch('/api/diagrams/save-svg', {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                              projectId,
                              gptResponseId: data.gptResponseId,
                              svg: svgToSave
                            }),
                          });
                          console.log(`[handleGenerateDiagram] SVG save response status: ${saveSvgResponse.status}`);
                          
                          if (saveSvgResponse.ok) {
                            console.log('[handleGenerateDiagram] SVG saved successfully');
                          } else {
                            console.error('[handleGenerateDiagram] Failed to save SVG:', await saveSvgResponse.text());
                          }
                        } catch (error) {
                          console.error('[handleGenerateDiagram] Error saving SVG:', error);
                        }
                      } else {
                        console.log('[handleGenerateDiagram] No SVG available to save after stream completion, trying again in 1 second');
                        
                        // Try one more time after another delay
                        setTimeout(async () => {
                          // Force one last render attempt before final save
                          if (receivedDiagram) {
                            await renderDiagram(receivedDiagram);
                          }
                          
                          const finalSvg = latestSvgRef.current || svgOutput;
                          if (finalSvg && finalSvg.length > 0) {
                            console.log(`[handleGenerateDiagram] Second attempt - Saving SVG after delay, length: ${finalSvg.length}`);
                            try {
                              const saveSvgResponse = await fetch('/api/diagrams/save-svg', {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                  projectId,
                                  gptResponseId: data.gptResponseId,
                                  svg: finalSvg
                                }),
                              });
                              console.log(`[handleGenerateDiagram] Second attempt SVG save response: ${saveSvgResponse.status}`);
                            } catch (error) {
                              console.error('[handleGenerateDiagram] Error in second attempt to save SVG:', error);
                            }
                          } else {
                            console.error('[handleGenerateDiagram] Still no SVG available after second attempt');
                          }
                        }, 1500); // Increased from 1000ms to 1500ms for better reliability
                      }
                    }, 2500); // Increased from 2000ms to 2500ms for better reliability
                  }
                } catch (e) {
                  console.error('Error parsing SSE data:', e, line);
                  // Only propagate critical errors, not parsing issues at the end of stream
                  if (!isRetry && line.includes('error') && !isComplete) {
                    throw new Error('Failed to parse diagram data');
                  } else {
                    // For errors at the end of streaming, just log them but don't propagate
                    // This prevents unnecessary retries when the diagram is actually valid
                    console.log('[handleGenerateDiagram] Non-critical parse error, continuing');
                  }
                }
              }
            }
          }
        }
        
        // Handle errors after streaming is completely done
        isStreamActive = false; // Ensure streaming state is marked as complete
        
        // Only show error UI if this was a true final error and not a resolved streaming error
        if (isFinalError) {
          const finalErrorMessage = allErrorMessages.length > 0 
            ? allErrorMessages[allErrorMessages.length - 1] 
            : 'Failed to generate diagram';
            
          console.log(`[handleGenerateDiagram] Final error occurred: ${finalErrorMessage}`);
          
          // Now we can set error states
          setError(finalErrorMessage);
          setLastErrorMessage(finalErrorMessage);
          
          // Create error message for chat
          const errorMessage: ChatMessageData = {
            role: 'assistant',
            content: `I couldn't create your diagram. Would you like to try again with a different prompt?`,
            timestamp: new Date(),
            error: finalErrorMessage,
            hasRetryButton: true,
          };
          
          // Add the error message to chat, replacing any typing indicators
          setMessages(prev => {
            // Filter out any existing typing indicators
            const filteredMessages = prev.filter(msg => !msg.isTyping);
            return [...filteredMessages, errorMessage];
          });
          
          // Clean up
          setIsGenerating(false);
          setIsRetrying(false);
          return; // Exit early - don't proceed to processing the diagram
        } 
        else if (hasError && allErrorMessages.length > 0) {
          // We had streaming errors, but the final diagram rendered successfully
          console.log(`[handleGenerateDiagram] Had ${allErrorMessages.length} streaming errors but final diagram rendered successfully. Not showing error UI.`);
          // Clear any existing error state to be safe
          setError('');
        }
        
        // Process the successful diagram if we get here
        // Use the received diagram
        const newDiagram = receivedDiagram;
        console.log(`[handleGenerateDiagram] Received final diagram code, length: ${newDiagram.length}`);
        console.log(`[handleGenerateDiagram] Current SVG output length: ${svgOutput?.length || 0}`);
        
        // Only proceed with saving if we have a valid diagram
        if (!newDiagram || newDiagram.trim().length === 0) {
          const emptyDiagramError = new Error('Generated diagram is empty');
          (emptyDiagramError as any).hasRetryButton = true;
          throw emptyDiagramError;
        }
        
        // Important: Clear any streaming errors since we have a complete diagram now
        hasError = false;
        setError('');
        
        // Remove typing indicator and add real AI response
        const aiMessage: ChatMessageData = {
          role: 'assistant',
          content: 'Here is your updated diagram.',
          timestamp: new Date(),
          diagramVersion: newDiagram,
        };
        
        // Remove all typing indicators and add the real response
        setMessages(prev => {
          // When adding a success message, remove any existing error messages and typing indicators
          const filteredMessages = prev.filter(msg => !msg.error && !msg.isTyping);
          return [...filteredMessages, aiMessage];
        });
        
        // Update history in database only for successful diagrams
        console.log(`[handleGenerateDiagram] Calling updateHistory with promptToUse: ${promptToUse.substring(0, 30)}..., newDiagram length: ${newDiagram.length}, type: chat`);
        await updateHistory({
          prompt: promptToUse,
          diagram: newDiagram,
          diagram_img: svgOutput || latestSvgRef.current,
          updateType: 'chat'
        });
        
        // Persist history to database
        await persistHistory({
          prompt: promptToUse,
          diagram: newDiagram,
          diagram_img: svgOutput || latestSvgRef.current,
          updateType: 'chat'
        });
        
        // Clear prompt
        setPrompt('');
      } else {
        // Fallback to regular JSON response if not streaming
        const data = await response.json();
        console.log(`[handleGenerateDiagram] Received non-streaming response, contains mermaidSyntax: ${!!data.mermaidSyntax}, contains extractedSyntax: ${!!data.extractedSyntax}`);
        
        // Update diagram and chat history
        const newDiagram = data.mermaidSyntax || data.extractedSyntax;
        setCurrentDiagram(newDiagram);
        
        // Remove typing indicator and add real AI response
        const aiMessage: ChatMessageData = {
          role: 'assistant',
          content: 'Here is your updated diagram.',
          timestamp: new Date(),
          diagramVersion: newDiagram,
        };
        
        // Remove all typing indicators and add the real response
        setMessages(prev => {
          // When adding a success message, remove any existing error messages and typing indicators
          const filteredMessages = prev.filter(msg => !msg.error && !msg.isTyping);
          return [...filteredMessages, aiMessage];
        });
        
        // Update history in database
        console.log(`[handleGenerateDiagram] Calling updateHistory with promptToUse: ${promptToUse.substring(0, 30)}..., newDiagram length: ${newDiagram.length}, type: chat`);
        await updateHistory({
          prompt: promptToUse,
          diagram: newDiagram,
          diagram_img: svgOutput || latestSvgRef.current,
          updateType: 'chat'
        });
        
        // Persist history to database
        await persistHistory({
          prompt: promptToUse,
          diagram: newDiagram,
          diagram_img: svgOutput || latestSvgRef.current,
          updateType: 'chat'
        });
        
        // Clear prompt
        setPrompt('');
        
        // Render the diagram
        renderDiagram(newDiagram);
      }
    } catch (err: any) {
      console.error('Error generating diagram:', err);
      
      // Enhanced error handling
      const errorText = err?.message || 'Failed to generate diagram';
      setError(errorText);
      setLastErrorMessage(errorText); // Store for potential retry
      
      // Create a single error message for chat
      const errorMessage: ChatMessageData = {
        role: 'assistant',
        content: `I couldn't create your diagram. Would you like to try again with a different prompt?`,
        timestamp: new Date(),
        error: errorText,
        hasRetryButton: true,
      };
      
      // Remove all typing indicators and add the error message
      setMessages(prev => {
        // Filter out any existing error messages and typing indicators
        const filteredMessages = prev.filter(msg => !msg.error && !msg.isTyping);
        return [...filteredMessages, errorMessage];
      });
    } finally {
      setIsGenerating(false);
      setIsRetrying(false);
    }
  };

  // Add listener for the DIAGRAM_SYNTAX_ERROR message from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'DIAGRAM_SYNTAX_ERROR') {
        // Only process final diagram errors, not intermediate streaming ones
        if (!event.data.isFinal) {
          console.log('[handleMessage] Ignoring non-final diagram error');
          return;
        }
        
        console.log('[handleMessage] Processing final diagram error');
        
        // This ensures the error from the diagram rendering is properly handled
        const errorText = event.data.error || 'Diagram syntax error';
        
        // Only process the error if it's not already being displayed
        if (!error || error !== errorText) {
          setError(errorText);
          setLastErrorMessage(errorText);
          
          // Create error message for chat
          const errorMessage: ChatMessageData = {
            role: 'assistant',
            content: `I couldn't create your diagram. Would you like to try again with a different prompt?`,
            timestamp: new Date(),
            error: errorText,
            hasRetryButton: event.data.hasRetryButton !== false, // Honor the hasRetryButton property, default to true
          };
          
          // Add the error message to chat, but only if we're not already showing errors
          setMessages(prev => {
            // Filter out any existing error messages and typing indicators
            const filteredMessages = prev.filter(msg => !msg.error && !msg.isTyping);
            return [...filteredMessages, errorMessage];
          });
        }
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [error]); // Add error to dependency array

  // Simplified function to handle manual retry from the UI
  const handleRetry = () => {
    if (lastPrompt) {
      // Reset error state
      setError('');
      setRenderError(null);
      
      // Add a system message about retry
      setMessages(prev => {
        // Filter out error messages and previous retry messages
        const filteredMessages = prev.filter(msg => 
          !msg.error && 
          !msg.isSystemNotification && 
          !(msg.content && msg.content.includes('Retrying diagram generation'))
        );
        
        // Add single retry message
        const retryMessage: ChatMessageData = {
          role: 'assistant', // Important: Use 'assistant' role instead of 'system' to avoid API errors
          content: 'Creating a new diagram for you...',
          timestamp: new Date(),
          isSystemNotification: true,
        };
        
        return [...filteredMessages, retryMessage];
      });
      
      // Log retry attempt
      console.log(`[handleRetry] Retrying diagram generation`);
      
      // Trigger generation with fresh cache - set isGenerating to prevent multiple clicks
      setIsGenerating(true);
      // Use timeout to ensure UI updates before starting the request
      setTimeout(() => {
        handleGenerateDiagram(null, lastPrompt, true, lastErrorMessage);
      }, 100);
    } else {
      // If somehow there's no last prompt, show an error
      setError('No previous prompt to retry. Please enter a new prompt.');
    }
  };

  // Use a wrapper around handleDiagramVersionSelect to maintain backward compatibility
  const handleDiagramVersionSelect = async (version: string): Promise<void> => {
    try {
      setIsVersionSelectionInProgress(true);
      
      // Use the selected version as the current diagram
      setCurrentDiagram(version);
      
      // Render the selected version
      await renderDiagram(version);
      
      // Don't switch to code editor mode, stay in chat mode
      
    } catch (error) {
      console.error('Error selecting diagram version:', error);
      setError('Failed to load diagram version');
    } finally {
      setIsVersionSelectionInProgress(false);
    }
  };

  // Function to load chat history
  const loadChatHistory = async () => {
    try {
      setIsChatHistoryLoading(true);
      
      const response = await fetch(`/api/project-history/messages?projectId=${projectId}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Failed to load chat history: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.chatMessages && data.chatMessages.length > 0) {
        // Convert dates to Date objects
        const formattedMessages = data.chatMessages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
        
        setMessages(formattedMessages);
      }
    } catch (err) {
      console.error('Error loading chat history:', err);
      // Don't show an error to the user, just log it
    } finally {
      setIsChatHistoryLoading(false);
    }
  };

  // Initial setup effect
  useEffect(() => {
    console.log(`[Initial Setup] Starting with initialHistory length: ${initialHistory?.length || 0}`);
    
    if (currentDiagram) {
      console.log(`[Initial Setup] Have currentDiagram, length: ${currentDiagram.length}`);
      
      // If we have initialHistory with diagram_img for the current diagram, use it immediately
      if (initialHistory && initialHistory.length > 0 && initialHistory[0]?.diagram_img) {
        console.log(`[Initial Setup] Using SVG from history immediately, length: ${initialHistory[0].diagram_img.length}`);
        setSvgOutput(initialHistory[0].diagram_img);
        latestSvgRef.current = initialHistory[0].diagram_img;
      } else {
        // If no SVG in history, render the diagram to generate it
        console.log(`[Initial Setup] No SVG in history, rendering diagram to generate SVG`);
        renderDiagram(currentDiagram);
      }
    }
    
    // Load chat history
    loadChatHistory();
  }, []);

  // Function to handle diagram syntax errors
  const handleDiagramSyntaxError = useCallback((errorText: string) => {
    console.log(`[handleDiagramSyntaxError] Handling syntax error: ${errorText}`);
    setError(errorText);
    setLastErrorMessage(errorText);
    
    // Create error message for chat
    const errorMessage: ChatMessageData = {
      role: 'assistant',
      content: `I had trouble understanding how to create this diagram. Let's try a different approach or use a simpler description.`,
      timestamp: new Date(),
      error: errorText, // Store actual error for debugging
      hasRetryButton: true,
    };
    
    // Add the error message to chat, but only if we're not already showing errors
    setMessages(prev => {
      // Filter out any existing error messages and typing indicators
      const filteredMessages = prev.filter(msg => !msg.error && !msg.isTyping);
      return [...filteredMessages, errorMessage];
    });
  }, [setError, setLastErrorMessage, setMessages]);

  // Listen for render errors and handle them
  useEffect(() => {
    if (renderError && !error) { // Only handle render errors if no other error is already displayed
      handleDiagramSyntaxError(renderError);
    }
  }, [renderError, handleDiagramSyntaxError, error]);

  return {
    // State
    prompt,
    setPrompt,
    lastPrompt,
    isGenerating,
    error,
    showPromptPanel,
    setShowPromptPanel,
    svgOutput,
    messages,
    chatHistory: messages,
    currentDiagram,
    setCurrentDiagram,
    diagramHistory,
    currentTheme,
    isDarkMode,
    setIsDarkMode,
    renderError,
    isDownloading,
    isUploadingImage,
    scale,
    position,
    isDragging,
    dragStart,
    setDragStart,
    versionId,
    isVersionSelectionInProgress,
    setIsVersionSelectionInProgress,
    isEditorReady,
    setIsEditorReady,
    editorMode,
    setEditorMode,
    documentSummary,
    showFileUpload,
    setShowFileUpload,
    isProcessingFile,
    isProcessingImage: isUploadingImage,
    showExportMenu,
    setShowExportMenu,
    isLoading,
    isChatHistoryLoading,
    
    // Refs
    diagramRef,
    svgRef,
    chatContainerRef,
    
    // Functions
    renderDiagram,
    handleCodeChange,
    handleGenerateDiagram,
    downloadSVG,
    downloadPNG,
    changeTheme,
    processDocument,
    processWebsite,
    handleFileUpload,
    processImage,
    handleImageUpload,
    handleMouseDown,
    setIsDragging,
    setPosition,
    setScale,
    updateHistory,
    handleDiagramVersionSelect,
    handleRetry,
  };
}

export default useDiagramEditor; 