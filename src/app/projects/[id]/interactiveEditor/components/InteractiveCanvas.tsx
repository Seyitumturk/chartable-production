'use client';

import React, { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { motion } from 'framer-motion';

// Define basic types
type Point = { x: number, y: number };

// Types for diagram elements
interface DiagramNode {
  id: string;
  type: 'node';
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  shape?: 'rectangle' | 'rounded-rectangle' | 'circle' | 'diamond' | 'parallelogram' | 'cylinder' | 'document';
  style?: {
    backgroundColor?: string;
    borderColor?: string;
    textColor?: string;
    borderWidth?: number;
    borderRadius?: number;
    boxShadow?: string;
    skewX?: number;
    skewY?: number;
    opacity?: number;
  };
}

interface DiagramConnection {
  id: string;
  type: 'connection';
  sourceId: string;
  targetId: string;
  points?: { x: number, y: number }[];
  label?: string;
  style?: {
    strokeColor?: string;
    strokeWidth?: number;
    arrowType?: 'none' | 'arrow' | 'triangle' | 'diamond';
    lineStyle?: 'straight' | 'bezier' | 'orthogonal';
    cornerRadius?: number;
    strokeDasharray?: string;
    endArrowSize?: number;
    labelBackgroundColor?: string;
    labelTextColor?: string;
    labelFontSize?: number;
    labelPadding?: number;
    labelBorderRadius?: number;
  };
}

type DiagramElement = DiagramNode | DiagramConnection;

// Canvas state interface
export interface CanvasState {
  elements: DiagramElement[];
  version: number;
  canvasWidth?: number;
  canvasHeight?: number;
}

interface InteractiveCanvasProps {
  projectId: string;
  initialState?: string;
  isDarkMode: boolean;
  onSave?: (state: string) => Promise<void>;
}

// Define the ref type
export interface InteractiveCanvasRef {
  getCanvasState: () => CanvasState;
  setCanvasState: (state: CanvasState) => void;
  addNode: (x: number, y: number, text?: string) => void;
  getCanvasRect: () => DOMRect | null;
}

const defaultCanvasState: CanvasState = {
  elements: [],
  version: 1,
};

export const InteractiveCanvas = forwardRef<InteractiveCanvasRef, InteractiveCanvasProps>(({
  projectId,
  initialState,
  isDarkMode,
  onSave,
}, ref) => {
  // Canvas state
  const [canvasState, setCanvasState] = useState<CanvasState>(() => {
    if (initialState) {
      try {
        return JSON.parse(initialState);
      } catch (error) {
        console.error('Error parsing canvas state:', error);
        return { elements: [], version: 1 };
      }
    }
    return { elements: [], version: 1 };
  });
  
  // Interaction states
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [isDraggingElement, setIsDraggingElement] = useState(false);
  const [isDrawingConnection, setIsDrawingConnection] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState<Point | null>(null);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [mousePosition, setMousePosition] = useState<{ x: number, y: number }>({ x: 0, y: 0 });
  const [isDirty, setIsDirty] = useState(false);
  
  // Drawing connection
  const [connectionStart, setConnectionStart] = useState<{ id: string, x: number, y: number } | null>(null);
  const [currentConnection, setCurrentConnection] = useState<{
    start: { id: string, x: number, y: number };
    end: { x: number, y: number };
    targetNodeId?: string;
  } | null>(null);
  
  // For panning/zooming
  const [viewPosition, setViewPosition] = useState({ x: 0, y: 0 });
  const [viewPositionStart, setViewPositionStart] = useState({ x: 0, y: 0 });
  const [mousePositionStart, setMousePositionStart] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  
  // Refs
  const canvasRef = useRef<HTMLDivElement>(null);

  // Expose methods through the ref
  useImperativeHandle(ref, () => ({
    getCanvasState: () => canvasState,
    setCanvasState: (state: CanvasState) => {
      updateCanvasState(state);
    },
    addNode: (x: number, y: number, text: string = 'New Node', style?: DiagramNode['style']) => {
      addNode(x, y, text, style);
    },
    getCanvasRect: () => canvasRef.current?.getBoundingClientRect() || null,
  }));

  // Save canvas state when it changes
  useEffect(() => {
    if (isDirty && onSave) {
      const saveTimer = setTimeout(async () => {
        try {
          await onSave(JSON.stringify(canvasState));
          setIsDirty(false);
        } catch (error) {
          console.error('Error saving canvas state:', error);
        }
      }, 1000); // Auto-save after 1 second of no changes
      
      return () => clearTimeout(saveTimer);
    }
  }, [canvasState, isDirty, onSave]);

  // Handle mouse down on the canvas
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    // Only proceed if left mouse button was clicked
    if (e.button !== 0) return;
    
    // Close context menu if it's open
    if (contextMenuPosition) {
      setContextMenuPosition(null);
    }
    
    // Check if we clicked on any element
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = (e.clientX - rect.left) / scale - viewPosition.x;
    const y = (e.clientY - rect.top) / scale - viewPosition.y;
    
    // Look for a node at this position
    const clickedNode = canvasState.elements.find(
      el => el.type === 'node' && isPointInNode(x, y, el as DiagramNode)
    );
    
    if (clickedNode) {
      // We clicked on a node, select it and prepare for dragging
      setSelectedElement(clickedNode.id);
      setIsDraggingElement(true);
    } else {
      // We clicked on the canvas background, prepare for panning
      setSelectedElement(null);
      setIsDraggingCanvas(true);
      setViewPositionStart(viewPosition);
      setMousePositionStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    // Get mouse position relative to canvas
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale - viewPosition.x;
    const y = (e.clientY - rect.top) / scale - viewPosition.y;
    
    // Update mouse position for tooltips/context menus
    setMousePosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    
    // Handle dragging based on what's being dragged
    if (isDraggingElement && selectedElement) {
      // Get the element being dragged
      const element = canvasState.elements.find(el => el.id === selectedElement);
      if (element && element.type === 'node') {
        // Update the position of the dragged node
        const elements = canvasState.elements.map(el => {
          if (el.id === selectedElement) {
            return { ...el, x, y };
          }
          return el;
        });
        
        setCanvasState({
          ...canvasState,
          elements,
        });
      }
    }
    else if (isDraggingCanvas) {
      // Update the canvas offset (pan) - reversed to be more intuitive
      // Now moving the mouse right/left/up/down will move the canvas in the same direction
      setViewPosition({
        x: viewPositionStart.x - (mousePositionStart.x - e.clientX) / scale,
        y: viewPositionStart.y - (mousePositionStart.y - e.clientY) / scale,
      });
    }
    else if (isDrawingConnection) {
      // Update the preview connection end point
      setCurrentConnection({
        start: connectionStart,
        end: { x, y },
      });
      
      // Check if mouse is over a node for connecting
      const hoveredNode = canvasState.elements.find(el => 
        el.type === 'node' && 
        el.id !== connectionStart.id && 
        isPointInNode(x, y, el as DiagramNode)
      ) as DiagramNode;
      
      if (hoveredNode) {
        // Snap the end point to the node's top center when hovering over a node
        // This is for vertical flowchart connections by default
        setCurrentConnection({
          start: connectionStart,
          end: { 
            x: hoveredNode.x + hoveredNode.width / 2, 
            y: hoveredNode.y 
          },
          targetNodeId: hoveredNode.id
        });
      } else {
        setCurrentConnection({
          start: connectionStart,
          end: { x, y },
          targetNodeId: undefined
        });
      }
    }
  };

  const handleCanvasMouseUp = (e: React.MouseEvent) => {
    // If we were drawing a connection, create it if the mouse is over a node
    if (isDrawingConnection && connectionStart && currentConnection) {
      // Get the target node if we're over one
      if (currentConnection.targetNodeId) {
        // Create a new connection
        const newConnection: DiagramConnection = {
          id: `connection-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`,
          type: 'connection',
          sourceId: connectionStart.id,
          targetId: currentConnection.targetNodeId,
          style: {
            strokeColor: isDarkMode ? '#94a3b8' : '#64748b',
            strokeWidth: 2,
            arrowType: 'triangle',
            lineStyle: 'orthogonal',
            cornerRadius: 12
          }
        };
        
        // Add the new connection to the canvas state
        updateCanvasState({
          ...canvasState,
          elements: [...canvasState.elements, newConnection],
        });
      }
      
      // Reset the connection drawing state
      setIsDrawingConnection(false);
      setCurrentConnection(null);
    }
    
    // Reset other interaction states
    setIsDraggingCanvas(false);
    setIsDraggingElement(false);
  };

  // Handle element-specific events
  const handleElementMouseDown = (e: React.MouseEvent, elementId: string) => {
    e.stopPropagation();
    
    setSelectedElement(elementId);
    setIsDraggingElement(true);
  };

  const handleElementMouseMove = (e: React.MouseEvent) => {
    // This function isn't needed - we handle all mouse move in the canvas handler
  };

  const handleElementMouseUp = () => {
    setIsDraggingElement(false);
  };

  const handleCanvasContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowContextMenu(true);
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
  };

  // Helper function to check if a point is inside a node
  const isPointInNode = (x: number, y: number, node: DiagramNode): boolean => {
    return (
      x >= node.x && 
      x <= node.x + node.width && 
      y >= node.y && 
      y <= node.y + node.height
    );
  };

  // Update canvas state and mark as dirty
  const updateCanvasState = (newState: CanvasState) => {
    setCanvasState(newState);
    setIsDirty(true);
  };

  // Add a new node to the canvas
  const addNode = (x: number, y: number, text: string = 'New Node', style?: DiagramNode['style']) => {
    // Generate a unique ID for the new node
    const nodeId = `node-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    
    // Create the new node with default dimensions
    const newNode: DiagramNode = {
      id: nodeId,
      type: 'node',
      x: x,
      y: y,
      width: 150,
      height: 80,
      text: text,
      style: style || {
        backgroundColor: isDarkMode ? '#333333' : '#ffffff',
        borderColor: isDarkMode ? '#666666' : '#cccccc',
        textColor: isDarkMode ? '#ffffff' : '#333333',
        borderRadius: 5
      }
    };
    
    // If adding to an empty canvas, position the node in the center
    if (canvasState.elements.length === 0) {
      const canvasRect = canvasRef.current?.getBoundingClientRect();
      if (canvasRect) {
        newNode.x = (canvasRect.width / 2 - 75) / scale - viewPosition.x;
        newNode.y = (canvasRect.height / 3 - 40) / scale - viewPosition.y; // Start higher on the canvas
      }
    } else {
      // Try to place the node below existing nodes for vertical flow
      const nodeElements = canvasState.elements.filter(el => el.type === 'node') as DiagramNode[];
      if (nodeElements.length > 0) {
        // Find the lowest node's position
        const lowestNode = nodeElements.reduce((lowest, node) => 
          (node.y + node.height > lowest.y + lowest.height) ? node : lowest, nodeElements[0]);
        
        // Position the new node below the lowest node, and centered horizontally
        if (x === 0 && y === 0) { // If no specific position was requested
          newNode.x = lowestNode.x;
          newNode.y = lowestNode.y + lowestNode.height + 60; // Add vertical spacing
        }
      }
    }
    
    // Update the canvas state to include the new node
    updateCanvasState({
      ...canvasState,
      elements: [...canvasState.elements, newNode],
    });
    
    return nodeId;
  };

  // Handle canvas wheel for zooming
  const handleCanvasWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    
    // Get mouse position relative to canvas
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    // Calculate mouse position in the canvas coordinate system (before zoom)
    const mouseX = (e.clientX - rect.left);
    const mouseY = (e.clientY - rect.top);
    
    // Calculate mouse position in the transformed canvas space
    const mouseCanvasX = mouseX / scale - viewPosition.x;
    const mouseCanvasY = mouseY / scale - viewPosition.y;
    
    // Calculate new scale with smoother transition
    const zoomSpeed = 0.05; // Reduced for smoother zooming
    const delta = e.deltaY > 0 ? -zoomSpeed : zoomSpeed;
    const newScale = Math.max(0.1, Math.min(5, scale + (scale * delta)));
    
    // Calculate new viewPosition to zoom toward mouse position
    const newViewPosition = {
      x: -(mouseX / newScale - mouseCanvasX),
      y: -(mouseY / newScale - mouseCanvasY)
    };
    
    // Apply new scale and position with smooth transition
    setScale(newScale);
    setViewPosition(newViewPosition);
  };

  // Render the diagram elements
  const renderDiagramElements = () => {
    return canvasState.elements.map(element => {
      if (element.type === 'node') {
        return renderNode(element as DiagramNode);
      } else if (element.type === 'connection') {
        return renderConnection(element as DiagramConnection);
      }
      return null;
    });
  };

  const renderNode = (node: DiagramNode) => {
    const isSelected = selectedElement === node.id;
    const shape = node.shape || 'rectangle';
    
    // Base node style
    const baseStyle = {
      left: node.x,
      top: node.y,
      width: node.width,
      height: node.height,
      backgroundColor: node.style?.backgroundColor || (isDarkMode ? '#333333' : '#ffffff'),
      border: `${node.style?.borderWidth || 1}px solid ${node.style?.borderColor || (isDarkMode ? '#666666' : '#cccccc')}`,
      borderRadius: `${node.style?.borderRadius || 5}px`,
      color: node.style?.textColor || (isDarkMode ? '#ffffff' : '#333333'),
      boxShadow: node.style?.boxShadow || '',
      opacity: node.style?.opacity || 1,
      zIndex: isSelected ? 10 : 1,
      transform: ''
    };
    
    // Apply shape-specific styles
    switch (shape) {
      case 'diamond':
        baseStyle.transform = 'rotate(45deg)';
        break;
      case 'parallelogram':
        baseStyle.transform = `skewX(${node.style?.skewX || 0}deg)`;
        break;
      case 'cylinder':
        // Cylinder is handled with special inner elements
        break;
      case 'document':
        // Document is handled with a wavy bottom border
        break;
      case 'rounded-rectangle':
        baseStyle.borderRadius = '16px';
        break;
      case 'circle':
        baseStyle.borderRadius = '50%';
        break;
    }
    
    return (
      <motion.div
        key={node.id}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ y: -2, boxShadow: `0 6px 15px rgba(0, 0, 0, ${isDarkMode ? 0.5 : 0.15})` }}
        transition={{ duration: 0.2 }}
        className={`absolute cursor-move ${
          isSelected ? 'ring-2 ring-blue-500' : ''
        }`}
        style={{
          ...baseStyle,
          transition: 'box-shadow 0.3s ease, border-color 0.3s ease, background-color 0.3s ease',
        }}
        onMouseDown={(e) => handleElementMouseDown(e, node.id)}
        onDoubleClick={() => {
          // Enable text editing
          // This would be implemented with a modal or inline edit
        }}
      >
        {/* Special shape elements */}
        {shape === 'cylinder' && (
          <>
            <div className="absolute top-0 left-0 right-0 h-4 bg-inherit" 
                 style={{ 
                   borderTopLeftRadius: baseStyle.borderRadius, 
                   borderTopRightRadius: baseStyle.borderRadius,
                   borderBottom: 'none',
                   borderLeft: baseStyle.border,
                   borderRight: baseStyle.border,
                   borderTop: baseStyle.border
                 }} />
            <div className="absolute bottom-0 left-0 right-0 h-4 bg-inherit"
                 style={{ 
                   borderBottomLeftRadius: baseStyle.borderRadius, 
                   borderBottomRightRadius: baseStyle.borderRadius,
                   borderTop: 'none',
                   borderLeft: baseStyle.border,
                   borderRight: baseStyle.border,
                   borderBottom: baseStyle.border
                 }} />
            <div className="absolute top-2 left-0 right-0 bottom-2 bg-inherit"
                 style={{ 
                   borderLeft: baseStyle.border,
                   borderRight: baseStyle.border
                 }} />
          </>
        )}
        
        {shape === 'document' && (
          <div className="absolute bottom-0 left-0 right-0 h-4 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-8"
                 style={{ 
                   borderRadius: '50%',
                   border: baseStyle.border,
                   borderTop: 'none'
                 }} />
          </div>
        )}
        
        {/* Text container needs special styling based on shape */}
        <div 
          className={`p-2 flex items-center justify-center h-full w-full text-center break-words
                      ${shape === 'diamond' ? 'transform -rotate-45' : ''}
                      ${shape === 'parallelogram' ? `transform skewX(${-(node.style?.skewX || 0)}deg)` : ''}`}
        >
          {node.text}
        </div>
        
        {/* Connection handles */}
        {/* Top handle - for incoming connections */}
        <div 
          className="absolute top-0 left-1/2 w-3 h-3 bg-blue-500 rounded-full transform -translate-x-1/2 -translate-y-1/2 cursor-crosshair z-10"
          onMouseDown={(e) => {
            e.stopPropagation();
            setIsDrawingConnection(true);
            setConnectionStart({ 
              id: node.id, 
              x: node.x + node.width / 2, 
              y: node.y 
            });
          }}
        />
        
        {/* Bottom handle - for outgoing connections (primary for flowcharts) */}
        <div 
          className="absolute bottom-0 left-1/2 w-4 h-4 bg-green-500 rounded-full transform -translate-x-1/2 translate-y-1/2 cursor-crosshair z-10"
          onMouseDown={(e) => {
            e.stopPropagation();
            setIsDrawingConnection(true);
            setConnectionStart({ 
              id: node.id, 
              x: node.x + node.width / 2, 
              y: node.y + node.height 
            });
          }}
        />
        
        {/* Right handle - for special case connections */}
        <div 
          className="absolute top-1/2 right-0 w-3 h-3 bg-blue-500 rounded-full transform translate-x-1/2 -translate-y-1/2 cursor-crosshair z-10"
          onMouseDown={(e) => {
            e.stopPropagation();
            setIsDrawingConnection(true);
            setConnectionStart({ 
              id: node.id, 
              x: node.x + node.width, 
              y: node.y + node.height / 2 
            });
          }}
        />
      </motion.div>
    );
  };

  const renderConnection = (connection: DiagramConnection) => {
    const sourceNode = canvasState.elements.find(
      el => el.id === connection.sourceId
    ) as DiagramNode;
    
    const targetNode = canvasState.elements.find(
      el => el.id === connection.targetId
    ) as DiagramNode;
    
    if (!sourceNode || !targetNode) return null;
    
    const hasLabel = !!connection.label;
    
    // Determine if this is a vertical connection (preferred for tree structures)
    const isVerticalConnection = targetNode.y > sourceNode.y;
    const isHorizontalConnection = Math.abs(targetNode.x - sourceNode.x) > Math.abs(targetNode.y - sourceNode.y);
    
    // Calculate better connection points based on the relative positions
    let startX, startY, endX, endY;
    
    // For vertical connections (preferred in tree structure)
    if (isVerticalConnection) {
      // Source connects from bottom
      startX = sourceNode.x + sourceNode.width / 2;
      startY = sourceNode.y + sourceNode.height;
      
      // Target connects at top
      endX = targetNode.x + targetNode.width / 2;
      endY = targetNode.y;
    } 
    // For connections that need to go sideways then down
    else if (isHorizontalConnection) {
      // If source is to the left of target
      if (sourceNode.x < targetNode.x) {
        startX = sourceNode.x + sourceNode.width;
        startY = sourceNode.y + sourceNode.height / 2;
      } else {
        // Source is to the right of target
        startX = sourceNode.x;
        startY = sourceNode.y + sourceNode.height / 2;
      }
      
      // If target is below source, connect to top of target
      if (targetNode.y > sourceNode.y) {
        endX = targetNode.x + targetNode.width / 2;
        endY = targetNode.y;
      } 
      // If target is above source, connect to bottom of target
      else if (targetNode.y < sourceNode.y) {
        endX = targetNode.x + targetNode.width / 2;
        endY = targetNode.y + targetNode.height;
      }
      // If on same level, connect to sides
      else {
        if (sourceNode.x < targetNode.x) {
          endX = targetNode.x;
          endY = targetNode.y + targetNode.height / 2;
        } else {
          endX = targetNode.x + targetNode.width;
          endY = targetNode.y + targetNode.height / 2;
        }
      }
    } 
    // Fallback - use center points (should rarely happen in tree structure)
    else {
      startX = sourceNode.x + sourceNode.width / 2;
      startY = sourceNode.y + sourceNode.height / 2;
      endX = targetNode.x + targetNode.width / 2;
      endY = targetNode.y + targetNode.height / 2;
    }
    
    const startPoint = { x: startX, y: startY };
    const endPoint = { x: endX, y: endY };
    
    // Use orthogonal connections by default for a more structured flowchart
    // This creates connections with right angles (angled lines) rather than curves
    
    // Determine path based on relative positions of nodes
    let path = '';
    let pathPoints = [];
    
    if (connection.style?.lineStyle === 'straight') {
      // Simple straight line
      pathPoints = [
        startPoint,
        endPoint
      ];
    } else {
      // Default to orthogonal connections for all lines
      // This creates angled lines with right angles (like in traditional flowcharts)
      
      // Vertical connection (default for flowcharts)
      if (isVerticalConnection) {
        const midY = startPoint.y + (endPoint.y - startPoint.y) / 2;
        
        // If nodes are not aligned, use two corners
        if (Math.abs(startPoint.x - endPoint.x) > 10) {
          pathPoints = [
            startPoint,
            { x: startPoint.x, y: midY },
            { x: endPoint.x, y: midY },
            endPoint
          ];
        }
        // If nodes are closely aligned, use direct vertical line
        else {
          pathPoints = [
            startPoint,
            endPoint
          ];
        }
      }
      // Horizontal or other connections
      else if (isHorizontalConnection) {
        // For horizontal connections, can use multiple segments if needed
        
        // If one is below the other but not aligned horizontally
        if (Math.abs(startPoint.y - endPoint.y) > 10) {
          const midX = startPoint.x + (endPoint.x - startPoint.x) / 2;
          
          pathPoints = [
            startPoint,
            { x: midX, y: startPoint.y },
            { x: midX, y: endPoint.y },
            endPoint
          ];
        }
        // If roughly on the same level
        else {
          pathPoints = [
            startPoint,
            endPoint
          ];
        }
      }
      // For other connections (rare case)
      else {
        const midX = (startPoint.x + endPoint.x) / 2;
        const midY = (startPoint.y + endPoint.y) / 2;
        
        pathPoints = [
          startPoint,
          { x: midX, y: startPoint.y },
          { x: midX, y: endPoint.y },
          endPoint
        ];
      }
    }
    
    // Create path with rounded corners for orthogonal paths
    if (pathPoints.length <= 2 || connection.style?.lineStyle === 'straight') {
      // Just a straight line, no corners to round
      path = `M ${pathPoints[0].x},${pathPoints[0].y}`;
      
      for (let i = 1; i < pathPoints.length; i++) {
        path += ` L ${pathPoints[i].x},${pathPoints[i].y}`;
      }
    } else {
      // Orthogonal path with rounded corners
      const cornerRadius = connection.style?.cornerRadius || 15; // Default corner radius
      
      // Start path
      path = `M ${pathPoints[0].x},${pathPoints[0].y}`;
      
      // For each point except first and last, create rounded corners
      for (let i = 1; i < pathPoints.length - 1; i++) {
        const prev = pathPoints[i-1];
        const current = pathPoints[i];
        const next = pathPoints[i+1];
        
        // Calculate directions
        const inDirection = {
          x: current.x - prev.x,
          y: current.y - prev.y
        };
        
        const outDirection = {
          x: next.x - current.x,
          y: next.y - current.y
        };
        
        // Normalize directions
        const inLength = Math.sqrt(inDirection.x * inDirection.x + inDirection.y * inDirection.y);
        const outLength = Math.sqrt(outDirection.x * outDirection.x + outDirection.y * outDirection.y);
        
        // Skip if segments are too short
        if (inLength < cornerRadius || outLength < cornerRadius) {
          path += ` L ${current.x},${current.y}`;
          continue;
        }
        
        // Calculate control points for rounded corner
        const inNorm = {
          x: inDirection.x / inLength,
          y: inDirection.y / inLength
        };
        
        const outNorm = {
          x: outDirection.x / outLength,
          y: outDirection.y / outLength
        };
        
        // Points before and after the corner
        const cornerStart = {
          x: current.x - inNorm.x * cornerRadius,
          y: current.y - inNorm.y * cornerRadius
        };
        
        const cornerEnd = {
          x: current.x + outNorm.x * cornerRadius,
          y: current.y + outNorm.y * cornerRadius
        };
        
        // Add line to the start of the curve
        path += ` L ${cornerStart.x},${cornerStart.y}`;
        
        // Add the quadratic curve for the corner
        path += ` Q ${current.x},${current.y} ${cornerEnd.x},${cornerEnd.y}`;
      }
      
      // Add final line to endpoint
      path += ` L ${pathPoints[pathPoints.length - 1].x},${pathPoints[pathPoints.length - 1].y}`;
    }
    
    // For label positioning, use midpoint of the path
    const midpointIndex = Math.floor(pathPoints.length / 2) - 1;
    const labelPosition = {
      x: (pathPoints[midpointIndex].x + pathPoints[midpointIndex + 1].x) / 2,
      y: (pathPoints[midpointIndex].y + pathPoints[midpointIndex + 1].y) / 2
    };
    
    // Arrow marker for the end of the connection
    const arrowId = `arrow-${connection.id}`;
    const arrowType = connection.style?.arrowType || 'arrow';
    const arrowSize = connection.style?.endArrowSize || 6;
    const strokeColor = connection.style?.strokeColor || (isDarkMode ? '#66b2ff' : '#0066cc');
    const strokeWidth = connection.style?.strokeWidth || 2;
    const strokeDasharray = connection.style?.strokeDasharray || '';
    
    // Label styling
    const labelBgColor = connection.style?.labelBackgroundColor || (isDarkMode ? 'rgba(30, 41, 59, 0.7)' : 'rgba(248, 250, 252, 0.7)');
    const labelTextColor = connection.style?.labelTextColor || (isDarkMode ? '#ffffff' : '#0f172a');
    const labelFontSize = connection.style?.labelFontSize || 12;
    const labelPadding = connection.style?.labelPadding || 4;
    const labelBorderRadius = connection.style?.labelBorderRadius || 4;
    
    let arrowPath = '';
    switch (arrowType) {
      case 'arrow':
        arrowPath = "M 0 0 L 10 5 L 0 10 z";
        break;
      case 'triangle':
        arrowPath = "M 0 0 L 10 5 L 0 10 z";
        break;
      case 'diamond':
        arrowPath = "M 0 5 L 5 0 L 10 5 L 5 10 z";
        break;
      case 'none':
      default:
        arrowPath = "";
        break;
    }
    
    return (
      <svg 
        key={connection.id} 
        className="absolute top-0 left-0 w-full h-full pointer-events-none"
        style={{ zIndex: 0 }}
      >
        <defs>
          {arrowType !== 'none' && (
            <marker
              id={arrowId}
              viewBox="0 0 10 10"
              refX="5"
              refY="5"
              markerWidth={arrowSize}
              markerHeight={arrowSize}
              orient="auto-start-reverse"
            >
              <path 
                d={arrowPath}
                fill={strokeColor} 
              />
            </marker>
          )}
        </defs>
        
        <path 
          d={path}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={strokeDasharray}
          markerEnd={arrowType !== 'none' ? `url(#${arrowId})` : ''}
        />
        
        {hasLabel && (
          <g transform={`translate(${labelPosition.x}, ${labelPosition.y})`}>
            {/* Label background */}
            <rect
              x={-50}
              y={-12}
              width={100}
              height={24}
              rx={labelBorderRadius}
              ry={labelBorderRadius}
              fill={labelBgColor}
            />
            
            {/* Label text */}
            <text
              x={0}
              y={0}
              fontSize={labelFontSize}
              fill={labelTextColor}
              textAnchor="middle"
              dominantBaseline="middle"
              style={{ 
                fontFamily: 'Arial, sans-serif',
                fontWeight: 500,
                filter: isDarkMode ? 'drop-shadow(0 1px 1px rgba(0,0,0,0.7))' : 'none'
              }}
            >
              {connection.label}
            </text>
          </g>
        )}
      </svg>
    );
  };

  // Render the temporary connection being drawn
  const renderDrawingConnection = () => {
    if (!isDrawingConnection || !currentConnection) return null;
    
    // Start and end points for the connection
    const startX = currentConnection.start.x;
    const startY = currentConnection.start.y;
    const endX = currentConnection.end.x;
    const endY = currentConnection.end.y;
    
    // Draw preview with vertical-first orthogonal path
    const midY = (startY + endY) / 2;
    
    // Path for the connection line
    const path = `M ${startX} ${startY} V ${midY} H ${endX} V ${endY}`;
    
    return (
      <svg 
        className="absolute top-0 left-0 w-full h-full pointer-events-none"
        style={{ zIndex: 5 }}
      >
        <defs>
          <marker
            id="preview-arrow"
            viewBox="0 0 10 10"
            refX="5"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path 
              d="M 0 0 L 10 5 L 0 10 z" 
              fill={isDarkMode ? '#94a3b8' : '#64748b'} 
            />
          </marker>
        </defs>
        
        <path 
          d={path}
          stroke={isDarkMode ? '#94a3b8' : '#64748b'}
          strokeWidth={2}
          strokeDasharray="5 3"
          fill="none"
          markerEnd="url(#preview-arrow)"
        />
      </svg>
    );
  };

  // Context menu for adding nodes
  const renderContextMenu = () => {
    if (!showContextMenu || !contextMenuPosition) return null;
    
    return (
      <div
        className={`absolute z-50 py-2 rounded-md shadow-lg ${
          isDarkMode ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-800'
        }`}
        style={{
          left: contextMenuPosition.x,
          top: contextMenuPosition.y
        }}
      >
        <button
          className="w-full px-4 py-2 text-left hover:bg-blue-500 hover:text-white"
          onClick={() => {
            const canvasRect = canvasRef.current?.getBoundingClientRect();
            if (canvasRect) {
              const x = (contextMenuPosition.x - canvasRect.left - viewPosition.x) / scale;
              const y = (contextMenuPosition.y - canvasRect.top - viewPosition.y) / scale;
              addNode(x, y);
            }
            setShowContextMenu(false);
            setContextMenuPosition(null);
          }}
        >
          Add Node
        </button>
        <button
          className="w-full px-4 py-2 text-left hover:bg-blue-500 hover:text-white"
          onClick={() => {
            setShowContextMenu(false);
            setContextMenuPosition(null);
          }}
        >
          Cancel
        </button>
      </div>
    );
  };

  // Handle click outside of context menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showContextMenu) {
        setShowContextMenu(false);
        setContextMenuPosition(null);
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showContextMenu]);

  return (
    <div 
      className={`w-full h-full overflow-hidden relative ${isDarkMode ? 'bg-gray-900' : 'bg-white'} ${isDraggingCanvas ? 'cursor-grabbing' : 'cursor-grab'}`}
      ref={canvasRef}
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleCanvasMouseMove}
      onMouseUp={handleCanvasMouseUp}
      onContextMenu={handleCanvasContextMenu}
      onWheel={handleCanvasWheel}
    >
      {/* Grid canvas */}
      <motion.div 
        className="absolute inset-0 pointer-events-none"
        initial={false}
        animate={{
          backgroundPosition: `${viewPosition.x % (20 * scale)}px ${viewPosition.y % (20 * scale)}px`,
          backgroundSize: `${20 * scale}px ${20 * scale}px`
        }}
        transition={{ 
          type: "tween", 
          ease: "linear", 
          duration: 0.15 
        }}
        style={{
          backgroundImage: `linear-gradient(${isDarkMode ? '#1a2436' : '#f0f0f0'} 1px, transparent 1px), linear-gradient(90deg, ${isDarkMode ? '#1a2436' : '#f0f0f0'} 1px, transparent 1px)`, 
          backgroundColor: isDarkMode ? '#0f1729' : '#ffffff'
        }}
      />
      
      {/* Main canvas for diagram elements */}
      <motion.div 
        className="absolute origin-center"
        initial={false}
        animate={{ 
          scale, 
          x: viewPosition.x, 
          y: viewPosition.y 
        }}
        transition={{ 
          type: "spring", 
          stiffness: 500, 
          damping: 30, 
          mass: 1
        }}
        style={{ 
          width: canvasState.canvasWidth || '100%',
          height: canvasState.canvasHeight || '100%',
          minWidth: 2000,
          minHeight: 2000
        }}
      >
        {renderDiagramElements()}
        {isDrawingConnection && currentConnection && renderDrawingConnection()}
      </motion.div>
      
      {/* Context menu */}
      {showContextMenu && contextMenuPosition && renderContextMenu()}
    </div>
  );
}); 