'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { InteractiveCanvas, CanvasState, InteractiveCanvasRef } from './components/InteractiveCanvas';
import { InteractiveEditorToolbar } from './components/InteractiveEditorToolbar';
import { PromptPanel } from './components/PromptPanel';
import Link from 'next/link';
import Image from 'next/image';

interface InteractiveEditorPageProps {
  params: Promise<{ id: string }>;
}

interface DiagramNode {
  id: string;
  type: 'node';
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  style?: {
    backgroundColor?: string;
    borderColor?: string;
    textColor?: string;
    borderWidth?: number;
    borderRadius?: number;
  };
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function InteractiveEditorPage({ params }: InteractiveEditorPageProps) {
  // Use React.use to unwrap the params promise in client components
  const { id: projectId } = React.use(params);
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';
  const router = useRouter();
  const [project, setProject] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canvasState, setCanvasState] = useState<string | null>(null);
  const canvasRef = useRef<InteractiveCanvasRef>(null);
  const [scale, setScale] = useState(1);
  const [viewPosition, setViewPosition] = useState({ x: 0, y: 0 });
  const [showPromptPanel, setShowPromptPanel] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessingPrompt, setIsProcessingPrompt] = useState(false);

  // Fetch project data
  useEffect(() => {
    const fetchProject = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/projects/${projectId}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch project data');
        }
        
        const projectData = await response.json();
        setProject(projectData);
        setCanvasState(projectData.canvasState || null);
      } catch (error) {
        console.error('Error fetching project:', error);
        setError('Failed to load project data');
      } finally {
        setIsLoading(false);
      }
    };
    
    if (projectId) {
      fetchProject();
    }
  }, [projectId]);

  // Save canvas state
  const saveCanvasState = async () => {
    if (!canvasRef.current) return;
    
    try {
      setIsSaving(true);
      const currentState = JSON.stringify(canvasRef.current.getCanvasState());
      
      // Use the specialized interactive endpoint
      const response = await fetch(`/api/projects/${projectId}/interactive`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          canvasState: currentState,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save canvas state');
      }
      
      // Update local state
      setCanvasState(currentState);
    } catch (error) {
      console.error('Error saving canvas state:', error);
      setError('Failed to save diagram');
    } finally {
      setIsSaving(false);
    }
  };

  // Clear canvas
  const clearCanvas = () => {
    if (!canvasRef.current) return;
    
    const emptyState: CanvasState = {
      elements: [],
      version: 1,
    };
    
    canvasRef.current.setCanvasState(emptyState);
  };

  // Add a node at the center of the viewport
  const addNodeAtCenter = () => {
    if (!canvasRef.current) return;
    
    const canvasRect = canvasRef.current.getCanvasRect();
    if (!canvasRect) return;
    
    const centerX = (canvasRect.width / 2 - viewPosition.x) / scale;
    const centerY = (canvasRect.height / 2 - viewPosition.y) / scale;
    
    canvasRef.current.addNode(centerX, centerY);
  };

  // Generate diagram using Claude 3.7 Sonnet
  const generateDiagramWithClaude = async () => {
    if (!canvasRef.current) return;
    
    try {
      setIsGenerating(true);
      setError(null);
      
      // Get the current canvas state
      const currentState = canvasRef.current.getCanvasState();
      
      // If the canvas is empty, ask Claude to create a flowchart from scratch
      if (currentState.elements.length === 0) {
        // Ask the user what kind of flowchart they want
        const flowchartType = window.prompt('What kind of flowchart would you like to create?', 'User authentication process');
        
        if (!flowchartType) {
          setIsGenerating(false);
          return; // User cancelled
        }
        
        // Call API endpoint to generate a new diagram with Claude
        const newDiagramPrompt = `Please create a comprehensive flowchart for the following process: "${flowchartType}"

The flowchart should be:
1. Organized as a proper tree structure with clear hierarchical levels
2. Using a vertical top-to-bottom flow (NOT horizontal)
3. Utilizing appropriate node shapes:
   - Decision points as diamonds
   - Start/end points as rounded rectangles
   - Database/storage as cylinders
   - Input/output as parallelograms
   - Documents as document shapes
   - Standard processes as rectangles

The flowchart should include:
1. Clear, descriptive node labels
2. Meaningful connection labels between nodes
3. A logical flow with proper start/end nodes
4. Decision points with different paths clearly labeled (e.g., Yes/No)
5. Any relevant details needed to understand the process

Return your response as a detailed JSON structure for the diagram.`;

        try {
          const response = await fetch('/api/claude-diagram-generation', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              prompt: newDiagramPrompt,
              projectId,
              systemPrompt: "GENERATE A COMPLETE, WORKING DIAGRAM"
            }),
          });
          
          if (!response.ok) {
            throw new Error('Failed to generate diagram with Claude');
          }
          
          const data = await response.json();
          
          // Add messages to chat
          setMessages(prev => [
            ...prev,
            { role: 'user', content: `Create a flowchart for: ${flowchartType}`, timestamp: new Date() },
            { role: 'assistant', content: data.explanation || 'I\'ve created a flowchart based on your request.', timestamp: new Date() }
          ]);
          
          // Show prompt panel to display the generated response
          setShowPromptPanel(true);
          
          // Process the response and create the diagram
          await createDiagramFromResponse(data.suggestions || data);
          setIsGenerating(false);
          return;
        } catch (error) {
          console.error('Error generating new diagram:', error);
          setError('Failed to generate a new diagram.');
          setIsGenerating(false);
          return;
        }
      }
      
      // Extract diagram data to send to Claude
      const nodeData = currentState.elements
        .filter(el => el.type === 'node')
        .map((node: DiagramNode) => ({
          id: node.id,
          text: node.text,
          position: { x: node.x, y: node.y }
        }));
      
      const connectionData = currentState.elements
        .filter(el => el.type === 'connection')
        .map(conn => ({
          sourceId: conn.sourceId,
          targetId: conn.targetId,
          label: conn.label || ''
        }));
      
      // Call API endpoint to generate diagram with Claude
      const promptForClaude = `I have a diagram with the following nodes and connections:

Nodes:
${nodeData.map(node => `- ${node.text} (ID: ${node.id})`).join('\n')}

Connections:
${connectionData.map(conn => {
  const sourceNode = nodeData.find(n => n.id === conn.sourceId);
  const targetNode = nodeData.find(n => n.id === conn.targetId);
  return `- ${sourceNode?.text || conn.sourceId} → ${targetNode?.text || conn.targetId}${conn.label ? ` (${conn.label})` : ''}`;
}).join('\n')}

Please analyze this structure and create a significantly improved version of this flowchart that is:
1. Organized as a proper tree structure with clear hierarchical levels
2. Using a vertical top-to-bottom flow (NOT horizontal)
3. Utilizing a variety of appropriate node shapes:
   - Decision points as diamonds
   - Start/end points as rounded rectangles
   - Database/storage as cylinders
   - Input/output as parallelograms
   - Documents as document shapes
   - Standard processes as rectangles

Specifically:
1. Create better, more descriptive node labels
2. Add clear, meaningful connection labels between nodes
3. Add any missing nodes or connections to make the flowchart more comprehensive
4. Ensure the logical flow makes sense (proper start/end nodes, decision paths, etc.)
5. Organize the nodes in a clean hierarchical tree structure

Return your response as a detailed JSON structure with your improved diagram design.`;

      // Call the API to get Claude's suggestions
      const response = await fetch('/api/claude-diagram-generation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: promptForClaude,
          projectId
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate diagram with Claude');
      }
      
      const data = await response.json();
      
      // Add the message to the chat
      setMessages(prev => [
        ...prev,
        { role: 'user', content: promptForClaude, timestamp: new Date() },
        { role: 'assistant', content: JSON.stringify(data.suggestions, null, 2), timestamp: new Date() }
      ]);
      
      // Show the prompt panel
      setShowPromptPanel(true);
      
      // Apply Claude's suggestions to the canvas
      if (data.suggestions) {
        // TODO: Apply suggestions from Claude to the canvas
        // This would involve updating node text, adding new nodes, etc.
        
        // For now, we'll just show a success message
        console.log('Received suggestions from Claude:', data.suggestions);
      }
    } catch (error) {
      console.error('Error generating diagram with Claude:', error);
      setError('Failed to generate diagram with Claude');
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle text prompts to Claude
  const handlePromptSubmit = async (prompt: string) => {
    try {
      setIsProcessingPrompt(true);
      
      // Add user message to chat
      setMessages(prev => [...prev, { role: 'user', content: prompt, timestamp: new Date() }]);
      
      // MUCH more lenient flowchart detection - basically any mention of diagram, flowchart, or chart
      // Also detect profanity or urgency which might indicate user frustration with previous attempts
      const containsDiagramTerms = /(flowchart|diagram|chart)/i.test(prompt);
      const containsFrustrationIndicators = /(generate|create|make|just|fucking|please|give me)/i.test(prompt);
      
      // Consider almost everything a flowchart request unless it's clearly a question
      const isFlowchartRequest = 
        // Not a question about diagrams
        !(/^(what|how|why|when|is|are|can|could|would|explain).*\?$/i.test(prompt)) &&
        // Either contains diagram terms or shows frustration indicating previous failures
        (containsDiagramTerms || containsFrustrationIndicators);
      
      // Get current canvas state if there are elements
      let canvasInfo = "";
      if (canvasRef.current) {
        const currentState = canvasRef.current.getCanvasState();
        if (currentState.elements.length > 0) {
          const nodeData = currentState.elements
            .filter(el => el.type === 'node')
            .map((node: DiagramNode) => ({
              id: node.id,
              text: node.text,
              position: { x: node.x, y: node.y }
            }));
          
          const connectionData = currentState.elements
            .filter(el => el.type === 'connection')
            .map(conn => ({
              sourceId: conn.sourceId,
              targetId: conn.targetId,
              label: conn.label || ''
            }));
          
          canvasInfo = `
Current diagram state:
Nodes:
${nodeData.map(node => `- ${node.text} (ID: ${node.id})`).join('\n')}

Connections:
${connectionData.map(conn => {
  const sourceNode = nodeData.find(n => n.id === conn.sourceId);
  const targetNode = nodeData.find(n => n.id === conn.targetId);
  return `- ${sourceNode?.text || conn.sourceId} → ${targetNode?.text || conn.targetId}${conn.label ? ` (${conn.label})` : ''}`;
}).join('\n')}
`;
        }
      }
      
      // Customize the system prompt based on whether this is a flowchart request
      let apiPrompt = prompt;
      let systemPrompt = "";
      
      if (isFlowchartRequest) {
        systemPrompt = `You are a diagram generation assistant that ONLY creates diagrams.

YOUR ONLY JOB IS TO GENERATE A COMPLETE, WORKING DIAGRAM based on the user's request.
DO NOT analyze, critique, or comment on existing diagrams unless explicitly asked.
DO NOT say you need more information - create a reasonable diagram with what you have.
DO NOT apologize or explain limitations.
ALWAYS assume the user wants you to create a new diagram if they mention diagrams, flowcharts, or charts.

For ANY request, including vague ones like "generate a flowchart for Airbnb":
1. Create a sensible, complete diagram with at least 5-8 nodes
2. Include a clear start and end point
3. Use logical flow between nodes
4. NEVER mention limitations in your response

Return ONLY a JSON object with this structure:
{
  "diagram": {
    "nodes": [
      {
        "id": "start",
        "text": "Start",
        "type": "start"
      },
      {
        "id": "node1", 
        "text": "Process Step",
        "type": "process"
      },
      {
        "id": "end",
        "text": "End",
        "type": "end"
      }
    ],
    "connections": [
      {
        "from": "start",
        "to": "node1",
        "label": "Connection"
      },
      {
        "from": "node1",
        "to": "end",
        "label": "Complete"
      }
    ]
  },
  "explanation": "Brief explanation of the diagram"
}

DO NOT include any other text or explanation outside of this JSON structure.`;

        // If the prompt is very simple, expand it for better results
        if (prompt.length < 20) {
          const topic = prompt.replace(/(generate|create|make|draw|design|produce|flowchart|diagram|chart|for|of|about|a|please|just|fucking|\s)+/gi, '').trim();
          if (topic) {
            apiPrompt = `Create a comprehensive flowchart showing the main processes and user interactions for ${topic}`;
          }
        } else {
          apiPrompt = `${prompt}${canvasInfo ? '\n\n' + canvasInfo : ''}`;
        }
      }
      
      // Send to the API
      const response = await fetch('/api/claude-diagram-generation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: apiPrompt,
          projectId,
          systemPrompt: systemPrompt || undefined
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to get a response from Claude');
      }
      
      const data = await response.json();
      
      // If this was a flowchart request, try to automatically create the diagram
      if (isFlowchartRequest && data.suggestions) {
        await createDiagramFromResponse(data.suggestions);
      } else {
        // Add Claude's response to the chat
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: data.suggestions?.analysis || JSON.stringify(data.suggestions, null, 2), 
          timestamp: new Date() 
        }]);
      }
      
    } catch (error) {
      console.error('Error processing prompt:', error);
      setError('Failed to get a response from Claude');
      // Add error message to chat
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error while processing your request.', 
        timestamp: new Date() 
      }]);
    } finally {
      setIsProcessingPrompt(false);
    }
  };
  
  // Helper function to create a diagram from Claude's response
  const createDiagramFromResponse = async (response: any) => {
    try {
      if (!canvasRef.current) return;
      
      // Try to find the diagram data in the response
      let diagramData;
      let explanationText = "";
      
      // First attempt: Check if response has a diagram property (ideal structured format)
      if (response.diagram) {
        diagramData = response.diagram;
        explanationText = response.explanation || "";
      } 
      // Second attempt: Try to parse JSON from the content if it's a string
      else if (typeof response === 'string') {
        try {
          // Look for a JSON structure in the response
          const jsonRegex = /\{[\s\S]*\}/;
          const match = response.match(jsonRegex);
          if (match) {
            const parsedContent = JSON.parse(match[0]);
            diagramData = parsedContent.diagram;
            explanationText = parsedContent.explanation || "";
          }
        } catch (e) {
          console.error('Could not parse JSON from Claude response');
        }
      }
      // Third attempt: Check for potential diagram data in suggestions
      else if (response.suggestions && response.suggestions.diagram) {
        diagramData = response.suggestions.diagram;
        explanationText = response.suggestions.explanation || "";
      } 
      // Fourth attempt: Check if the structure is already in the format we need
      else if (response.nodes && response.connections) {
        diagramData = {
          nodes: response.nodes,
          connections: response.connections
        };
      }
      // Fifth attempt: Search for structures resembling diagram data
      else if (typeof response === 'object') {
        // Try to find analysis or content fields
        const responseText = 
          response.analysis || 
          (response.content ? 
            (typeof response.content === 'string' ? 
              response.content : 
              JSON.stringify(response.content)
            ) : 
            JSON.stringify(response)
          );
        
        // Add this response to chat
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: responseText, 
          timestamp: new Date() 
        }]);
        
        // Look for a JSON structure in the response text
        try {
          const jsonRegex = /\{[\s\S]*\}/;
          const match = responseText.match(jsonRegex);
          if (match) {
            const parsedContent = JSON.parse(match[0]);
            if (parsedContent.diagram) {
              diagramData = parsedContent.diagram;
              explanationText = parsedContent.explanation || "";
            }
          }
        } catch (e) {
          console.error('Could not find diagram data in response text');
        }
      }
      
      if (!diagramData || !diagramData.nodes || !diagramData.nodes.length) {
        // No structured diagram data found, inform the user
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: 'I understood your request for a diagram, but I couldn\'t generate the structured data needed to create it automatically. You can try asking me again with more details about what you want in the diagram.', 
          timestamp: new Date() 
        }]);
        return;
      }
      
      console.log("Creating diagram with data:", JSON.stringify(diagramData, null, 2));
      
      // Clear the canvas if it's not empty
      if (canvasRef.current) {
        const currentState = canvasRef.current.getCanvasState();
        if (currentState.elements.length > 0) {
          const emptyState: CanvasState = {
            elements: [],
            version: 1,
          };
          canvasRef.current.setCanvasState(emptyState);
        }
      }
      
      // Get canvas dimensions for layout
      const canvasRect = canvasRef.current.getCanvasRect();
      if (!canvasRect) return;
      
      const canvasWidth = canvasRect.width;
      const canvasHeight = canvasRect.height;
      
      // Organize nodes in a grid layout
      const nodes = diagramData.nodes || [];
      const connections = diagramData.connections || [];
      
      // Using a tree-based layout for better flowchart visualization
      const nodeCount = nodes.length;
      
      // First, analyze connections to determine node levels and hierarchical structure
      const nodeOutgoing = new Map(); // Map to store outgoing connections for each node
      const nodeIncoming = new Map(); // Map to store incoming connections for each node
      
      // Initialize maps
      nodes.forEach(node => {
        if (node && node.id) {
          nodeOutgoing.set(node.id, []);
          nodeIncoming.set(node.id, []);
        }
      });
      
      // Populate connection maps
      connections.forEach(conn => {
        if (conn && conn.sourceId && conn.targetId) {
          const sourceOutgoing = nodeOutgoing.get(conn.sourceId) || [];
          sourceOutgoing.push({
            targetId: conn.targetId,
            label: conn.label || ''
          });
          nodeOutgoing.set(conn.sourceId, sourceOutgoing);
          
          const targetIncoming = nodeIncoming.get(conn.targetId) || [];
          targetIncoming.push({
            sourceId: conn.sourceId,
            label: conn.label || ''
          });
          nodeIncoming.set(conn.targetId, targetIncoming);
        }
      });
      
      // Identify root nodes (nodes with no incoming connections)
      const rootNodes = nodes
        .filter(node => node && node.id && (!nodeIncoming.get(node.id) || nodeIncoming.get(node.id).length === 0))
        .map(node => node.id);
      
      // If no root nodes found, use the first node as root
      if (rootNodes.length === 0 && nodes.length > 0 && nodes[0]) {
        rootNodes.push(nodes[0].id);
      }
      
      // Assign levels to nodes using breadth-first traversal
      const nodeLevels = new Map(); // Maps node ID to its level
      const nodePositionInLevel = new Map(); // Maps node ID to its horizontal position in level
      const levelNodes = new Map(); // Maps level to array of node IDs in that level
      
      // Initialize with root nodes at level 0
      const queue = rootNodes.map(id => ({ id, level: 0 }));
      const visited = new Set();
      
      while (queue.length > 0) {
        const { id, level } = queue.shift();
        
        if (visited.has(id)) continue;
        visited.add(id);
        
        // Update node's level
        nodeLevels.set(id, level);
        
        // Add node to level's node list
        if (!levelNodes.has(level)) {
          levelNodes.set(level, []);
        }
        levelNodes.get(level).push(id);
        
        // Enqueue child nodes
        const outgoing = nodeOutgoing.get(id) || [];
        outgoing.forEach(child => {
          // Ensure child is placed at a deeper level
          queue.push({ id: child.targetId, level: level + 1 });
        });
      }
      
      // For any unvisited nodes, place them in a new bottom level
      const maxLevel = Math.max(...Array.from(nodeLevels.values()), 0);
      const bottomLevel = maxLevel + 1;
      
      nodes.forEach(node => {
        if (node && node.id && !visited.has(node.id)) {
          nodeLevels.set(node.id, bottomLevel);
          if (!levelNodes.has(bottomLevel)) {
            levelNodes.set(bottomLevel, []);
          }
          levelNodes.get(bottomLevel).push(node.id);
        }
      });
      
      // Assign horizontal positions with consideration for parent-child relationships
      // We need to group children under their parents for proper branching
      
      // First, calculate the number of "leaf" descendants for each node
      // This helps in determining how much horizontal space each branch needs
      const leafDescendants = new Map();
      
      // Helper function to count leaf descendants
      const countLeafDescendants = (nodeId, visited = new Set()) => {
        // Check for cycles - if we've already visited this node in this traversal path, skip it
        if (visited.has(nodeId)) {
          return 0;
        }
        
        // Add this node to the current path
        visited.add(nodeId);
        
        const outgoing = nodeOutgoing.get(nodeId) || [];
        
        // If no outgoing connections, this is a leaf node
        if (outgoing.length === 0) {
          leafDescendants.set(nodeId, 1);
          return 1;
        }
        
        // Sum the leaf descendants of all children
        let sum = 0;
        for (const conn of outgoing) {
          // Create a new copy of the visited set for each branch to avoid cross-contamination
          const childLeaves = countLeafDescendants(conn.targetId, new Set(visited));
          sum += childLeaves;
        }
        
        // If no leaves (could happen in cycles), count as 1
        if (sum === 0) sum = 1;
        
        leafDescendants.set(nodeId, sum);
        return sum;
      };
      
      // Count leaves starting from root nodes
      for (const rootId of rootNodes) {
        countLeafDescendants(rootId);
      }
      
      // For any nodes not counted (not reachable from roots), count them as 1
      nodes.forEach(node => {
        if (node && node.id && !leafDescendants.has(node.id)) {
          leafDescendants.set(node.id, 1);
        }
      });
      
      // Track node's horizontal position within the canvas (not just relative to level)
      const nodeHorizontalPositions = new Map();
      
      // Assign positions level by level, considering parent positions
      // Calculate the max level from levelNodes (might be different than the earlier maxLevel)
      const maxLevelForPositioning = Math.max(...Array.from(levelNodes.keys()));
      
      // Initialize positions for root nodes first
      const totalRootWidth = rootNodes.reduce((sum, id) => sum + leafDescendants.get(id), 0);
      const rootUnitWidth = (canvasWidth - 200) / totalRootWidth;
      
      let currentX = 100; // Starting position
      for (const rootId of rootNodes) {
        const width = leafDescendants.get(rootId) * rootUnitWidth;
        nodeHorizontalPositions.set(rootId, currentX + width / 2);
        currentX += width;
      }
      
      // Process each level, starting from the top
      for (let level = 1; level <= maxLevelForPositioning; level++) {
        const nodesInLevel = levelNodes.get(level) || [];
        
        // Group nodes by their parents
        const nodesByParent = new Map();
        
        // Initialize to handle nodes with no detected parents
        nodesByParent.set(null, []);
        
        for (const nodeId of nodesInLevel) {
          const parents = nodeIncoming.get(nodeId) || [];
          if (parents.length === 0) {
            // No parent detected, use null group
            nodesByParent.get(null).push(nodeId);
          } else {
            // Find parents at higher levels (avoid loops)
            const higherLevelParents = parents.filter(p => 
              nodeLevels.has(p.sourceId) && nodeLevels.get(p.sourceId) < level
            );
            
            if (higherLevelParents.length === 0) {
              // No proper parent, use null group
              nodesByParent.get(null).push(nodeId);
            } else {
              // Group by each parent
              for (const parent of higherLevelParents) {
                if (!nodesByParent.has(parent.sourceId)) {
                  nodesByParent.set(parent.sourceId, []);
                }
                nodesByParent.get(parent.sourceId).push(nodeId);
              }
            }
          }
        }
        
        // Now position nodes under their respective parents
        for (const [parentId, childNodeIds] of nodesByParent.entries()) {
          if (childNodeIds.length === 0) continue;
          
          if (parentId === null) {
            // Nodes with no detected parent - spread them evenly
            const levelWidth = canvasWidth - 200;
            const spacing = levelWidth / (childNodeIds.length + 1);
            childNodeIds.forEach((nodeId, index) => {
              nodeHorizontalPositions.set(nodeId, 100 + spacing * (index + 1));
            });
          } else {
            // Position children under their parent
            const parentX = nodeHorizontalPositions.get(parentId);
            
            // Special case for decision nodes - position yes/no branches appropriately
            const parentNode = nodes.find(n => n.id === parentId);
            const isDecision = parentNode && parentNode.type === 'decision';
            
            if (isDecision && childNodeIds.length === 2) {
              // For decision nodes with exactly 2 children, assume yes/no branches
              const connections = nodeOutgoing.get(parentId) || [];
              
              // Try to identify which is "yes" and which is "no" based on labels
              let leftChild, rightChild;
              
              // Find the connections to the children
              const leftConn = connections.find(c => c.targetId === childNodeIds[0]);
              const rightConn = connections.find(c => c.targetId === childNodeIds[1]);
              
              const leftLabel = leftConn ? leftConn.label.toLowerCase() : '';
              const rightLabel = rightConn ? rightConn.label.toLowerCase() : '';
              
              // Position based on common yes/no patterns
              if ((leftLabel.includes('yes') || leftLabel.includes('true')) && 
                  (rightLabel.includes('no') || rightLabel.includes('false'))) {
                // Yes on left, No on right
                leftChild = childNodeIds[0];
                rightChild = childNodeIds[1];
              } else if ((rightLabel.includes('yes') || rightLabel.includes('true')) && 
                         (leftLabel.includes('no') || leftLabel.includes('false'))) {
                // No on left, Yes on right
                leftChild = childNodeIds[1];
                rightChild = childNodeIds[0];
              } else {
                // Default: first child on left, second on right
                leftChild = childNodeIds[0];
                rightChild = childNodeIds[1];
              }
              
              // Position them with offset - use wider spacing for better tree structure
              const branchSpacing = Math.max(250, leafDescendants.get(leftChild) * 100 + leafDescendants.get(rightChild) * 100);
              nodeHorizontalPositions.set(leftChild, parentX - branchSpacing/2);
              nodeHorizontalPositions.set(rightChild, parentX + branchSpacing/2);
            } else if (isDecision && childNodeIds.length > 2) {
              // For decision nodes with multiple branches (more than 2), spread them out more aggressively horizontally
              // Calculate total width based on leaf descendants of each child
              const totalLeaves = childNodeIds.reduce((sum, id) => sum + leafDescendants.get(id), 0);
              
              // Use more generous spacing for decision branches
              const leafWidth = 250; // Wider width per leaf node for decision branches
              const totalWidth = Math.max(350 * childNodeIds.length, totalLeaves * leafWidth);
              
              // Start position for first child
              const startX = parentX - totalWidth / 2;
              
              // Keep track of current position
              let currentX = startX;
              
              // Position each child with more space between branches
              childNodeIds.forEach((nodeId, index) => {
                // Calculate width allocation for this child and its tree
                const childLeaves = Math.max(1, leafDescendants.get(nodeId));
                const childWidth = (childLeaves / totalLeaves) * totalWidth;
                
                // Position at center of its allocated space
                nodeHorizontalPositions.set(nodeId, currentX + childWidth / 2);
                
                // Move currentX for next child with additional spacing
                currentX += childWidth + 50; // Add extra spacing between decision branches
              });
            } else {
              // For other nodes, distribute children evenly under parent
              // Calculate total width based on leaf descendants of each child
              const totalLeaves = childNodeIds.reduce((sum, id) => sum + leafDescendants.get(id), 0);
              const leafWidth = 200; // Width per leaf node
              
              // Wider spacing for nodes with few children to create a more balanced diagram
              const minWidthPerChild = childNodeIds.length <= 2 ? 300 : 220;
              
              // Calculate the total width needed for all children and their descendants
              const totalWidth = Math.max(minWidthPerChild * childNodeIds.length, totalLeaves * leafWidth);
              
              // Start position for first child
              const startX = parentX - totalWidth / 2;
              
              // Keep track of current position
              let currentX = startX;
              
              // Position each child with space proportional to its descendants
              childNodeIds.forEach((nodeId, index) => {
                // Calculate width allocation for this child and its tree
                const childLeaves = Math.max(1, leafDescendants.get(nodeId));
                const childWidth = (childLeaves / totalLeaves) * totalWidth;
                
                // Position at center of its allocated space
                nodeHorizontalPositions.set(nodeId, currentX + childWidth / 2);
                
                // Move currentX for next child
                currentX += childWidth;
              });
            }
          }
        }
      }
      
      // Calculate final positions based on horizontal positions and levels
      const nodePositions = new Map(); // Maps node ID to {x, y} position
      const levelHeight = 160; // Reduced vertical distance between levels (was 180)
      
      // Track canvas bounds to ensure we have enough space for all elements
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      
      for (const [nodeId, level] of nodeLevels.entries()) {
        const x = nodeHorizontalPositions.get(nodeId) || 100;
        const y = 100 + (level * levelHeight);
        
        // Adjust for node size and store position
        const adjustedX = x - 75;
        const adjustedY = y - 40;
        nodePositions.set(nodeId, { x: adjustedX, y: adjustedY });
        
        // Update canvas bounds
        minX = Math.min(minX, adjustedX);
        maxX = Math.max(maxX, adjustedX + 150); // node width = 150
        minY = Math.min(minY, adjustedY);
        maxY = Math.max(maxY, adjustedY + 80);  // node height = 80
      }
      
      // Add padding to ensure connections are visible
      const padding = 200;
      const diagramWidth = Math.max(2000, maxX - minX + padding * 2);
      const diagramHeight = Math.max(2000, maxY - minY + padding * 2);
      
      // Simple and direct approach - create all elements first, then set the canvas state all at once
      const diagramElements = [];
      const nodeIdMap = new Map(); // Map original node IDs to canvas element IDs
      
      // Create nodes with calculated positions
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (!node || !node.id) continue;
        
        const position = nodePositions.get(node.id) || { x: 100, y: 100 };
        
        // Determine node style based on type
        const nodeType = node.type?.toLowerCase() || 'process';
        let style: any = {};
        let nodeShape = 'rectangle'; // Default shape
        
        // Define modern color palette
        const colors = {
          primary: isDarkMode ? '#4f46e5' : '#6366f1', // Indigo
          secondary: isDarkMode ? '#0ea5e9' : '#38bdf8', // Sky blue
          success: isDarkMode ? '#16a34a' : '#22c55e', // Green
          warning: isDarkMode ? '#ea580c' : '#f97316', // Orange
          danger: isDarkMode ? '#dc2626' : '#ef4444', // Red
          info: isDarkMode ? '#0284c7' : '#0ea5e9', // Light blue
          light: isDarkMode ? '#475569' : '#f1f5f9', // Slate
          dark: isDarkMode ? '#1e293b' : '#334155', // Dark slate
          text: isDarkMode ? '#f8fafc' : '#0f172a', // Text color
        };
        
        // Box shadow for all nodes
        const boxShadow = isDarkMode ? '0 4px 6px rgba(0, 0, 0, 0.3)' : '0 4px 6px rgba(0, 0, 0, 0.1)';
        
        if (nodeType === 'start' || nodeType === 'begin') {
          nodeShape = 'rounded-rectangle';
          style = {
            backgroundColor: colors.success,
            borderColor: isDarkMode ? '#15803d' : '#16a34a',
            textColor: '#ffffff',
            borderRadius: 16,
            borderWidth: 2,
            boxShadow
          };
        } else if (nodeType === 'end' || nodeType === 'terminal') {
          nodeShape = 'rounded-rectangle';
          style = {
            backgroundColor: colors.danger,
            borderColor: isDarkMode ? '#b91c1c' : '#dc2626',
            textColor: '#ffffff',
            borderRadius: 16,
            borderWidth: 2,
            boxShadow
          };
        } else if (nodeType === 'decision') {
          nodeShape = 'diamond';
          style = {
            backgroundColor: colors.warning,
            borderColor: isDarkMode ? '#c2410c' : '#ea580c',
            textColor: isDarkMode ? '#ffffff' : '#000000',
            borderRadius: 2,
            borderWidth: 2,
            boxShadow
          };
        } else if (nodeType === 'process') {
          nodeShape = 'rectangle';
          style = {
            backgroundColor: colors.light,
            borderColor: isDarkMode ? '#334155' : '#cbd5e1',
            textColor: isDarkMode ? '#ffffff' : '#0f172a',
            borderRadius: 8,
            borderWidth: 2,
            boxShadow
          };
        } else if (nodeType === 'input' || nodeType === 'output') {
          nodeShape = 'parallelogram';
          style = {
            backgroundColor: colors.info,
            borderColor: isDarkMode ? '#0369a1' : '#0284c7',
            textColor: '#ffffff',
            borderRadius: 0,
            borderWidth: 2,
            boxShadow,
            skewX: nodeType === 'input' ? -15 : 15
          };
        } else if (nodeType === 'database' || nodeType === 'storage') {
          nodeShape = 'cylinder';
          style = {
            backgroundColor: colors.secondary,
            borderColor: isDarkMode ? '#0284c7' : '#38bdf8',
            textColor: '#ffffff',
            borderRadius: 8,
            borderWidth: 2,
            boxShadow
          };
        } else if (nodeType === 'document') {
          nodeShape = 'document';
          style = {
            backgroundColor: colors.light,
            borderColor: isDarkMode ? '#475569' : '#cbd5e1',
            textColor: isDarkMode ? '#ffffff' : '#0f172a',
            borderRadius: 4,
            borderWidth: 2,
            boxShadow
          };
        } else {
          // Default style for any other node type
          nodeShape = 'rectangle';
          style = {
            backgroundColor: colors.primary,
            borderColor: isDarkMode ? '#4338ca' : '#4f46e5',
            textColor: '#ffffff',
            borderRadius: 8,
            borderWidth: 2,
            boxShadow
          };
        }
        
        // Create a unique ID for this element
        const elementId = `element-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 5)}`;
        
        // Map the original node ID to this new element ID
        nodeIdMap.set(node.id, elementId);
        
        // Create the node element
        diagramElements.push({
          id: elementId,
          type: 'node',
          x: position.x,
          y: position.y,
          width: 150, // Standard node width
          height: 80, // Standard node height
          text: node.text || `Node ${i + 1}`,
          style: style,
          shape: nodeShape
        });
      }
      
      console.log("Created nodes with ID mapping:", Array.from(nodeIdMap.entries()));
      
      // Then, create all connections
      for (const conn of connections) {
        if (!conn) continue;
        
        const sourceId = nodeIdMap.get(conn.sourceId || conn.from);
        const targetId = nodeIdMap.get(conn.targetId || conn.to);
        
        if (sourceId && targetId) {
          diagramElements.push({
            id: `connection-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`,
            type: 'connection',
            sourceId,
            targetId,
            label: conn.label || '',
            style: {
              strokeColor: isDarkMode ? '#94a3b8' : '#64748b', // Slate
              strokeWidth: 2,
              arrowType: 'triangle',
              lineStyle: 'orthogonal', // Use orthogonal lines with rounded corners
              cornerRadius: 15, // Rounded corners for a more modern look
              endArrowSize: 10,
              labelBackgroundColor: isDarkMode ? '#1e293b80' : '#f8fafc80', // Semi-transparent background
              labelTextColor: isDarkMode ? '#ffffff' : '#0f172a',
              labelFontSize: 12,
              labelPadding: 4,
              labelBorderRadius: 4
            }
          });
        } else {
          console.warn('Could not create connection - missing node:', 
            { connection: conn, sourceFound: !!sourceId, targetFound: !!targetId });
        }
      }
      
      // Update the canvas with all elements at once
      if (canvasRef.current && diagramElements.length > 0) {
        canvasRef.current.setCanvasState({
          elements: diagramElements,
          version: 1,
          canvasWidth: diagramWidth,
          canvasHeight: diagramHeight
        });
        
        // Save the canvas state
        saveCanvasState();
        
        // Add success message to chat
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: `I've created a diagram with ${nodes.length} nodes and ${connections.length} connections. You can now interact with it.${explanationText ? '\n\n' + explanationText : ''}`, 
          timestamp: new Date() 
        }]);
      } else {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: 'Unable to create diagram elements.', 
          timestamp: new Date() 
        }]);
      }
      
    } catch (error) {
      console.error('Error creating diagram from Claude response:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'I encountered an error while trying to create the diagram. Please try again with a different prompt.', 
        timestamp: new Date() 
      }]);
    }
  };

  // Apply Claude's suggestions to the canvas
  const applyClaudeSuggestionsToCanvas = async () => {
    try {
      if (!canvasRef.current) return;
      
      // Get the last assistant message
      const lastAssistantMessage = [...messages].reverse().find(m => m.role === 'assistant');
      if (!lastAssistantMessage) {
        setError('No suggestions from Claude to apply');
        return;
      }
      
      // Try to parse JSON from the message
      try {
        // This is a simplistic approach - in a real implementation, you'd want to
        // parse the structured suggestions and apply them to the canvas
        alert('This feature would apply the latest Claude suggestions to your canvas. Implementation coming soon.');
      } catch (parseError) {
        setError('Could not parse Claude suggestions');
      }
    } catch (error) {
      console.error('Error applying suggestions:', error);
      setError('Failed to apply suggestions to canvas');
    }
  };

  // Clear chat history
  const clearChat = () => {
    setMessages([]);
  };

  return (
    <div className={`h-screen flex flex-col ${isDarkMode 
      ? "bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900" 
      : "bg-gradient-to-br from-[#f0eee6] via-white to-[#f0eee6]"}`}
    >
      {/* Header */}
      <header className={`h-16 backdrop-blur-md border-b ${
        isDarkMode 
          ? "bg-[#201c1c]/80 border-[#282424]/50" 
          : "bg-[#e8dccc]/80 border-[#b8a990]/50"
      } sticky top-0 z-50`}>
        <div className="h-full px-6 flex items-center justify-between">
          {/* Desktop view: show project title and diagram type */}
          <div className="hidden md:flex items-center space-x-4">
            <Link
              href="/projects"
              className="flex items-center space-x-2 hover:opacity-80 transition-opacity"
            >
              <Image src="/logo-green.svg" alt="Chartable Logo" width={24} height={24} className="h-6 w-6" />
              <span className={`font-semibold truncate max-w-[150px] md:max-w-none ${
                isDarkMode ? "text-white" : "text-gray-900"
              }`}>
                {project?.title || "Interactive Flowchart"}
              </span>
            </Link>
            <div className={`h-4 w-px ${isDarkMode ? "bg-gray-700" : "bg-[#d8cbb8]"}`} />
            <span className={`text-sm ${isDarkMode ? "text-gray-400" : "text-[#8a7a66]"}`}>
              Interactive Flowchart Editor
            </span>
          </div>
          
          {/* Mobile view: show logo and diagram type */}
          <div className="flex md:hidden items-center space-x-2">
            <Link href="/projects" className="flex items-center hover:opacity-80 transition-opacity">
              <Image src="/logo-green.svg" alt="Chartable Logo" width={24} height={24} className="h-6 w-6" />
            </Link>
            <span className={`text-sm ${isDarkMode ? "text-gray-400" : "text-[#8a7a66]"}`}>
              Interactive Flowchart
            </span>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowPromptPanel(!showPromptPanel)}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                showPromptPanel
                  ? isDarkMode 
                    ? 'bg-[#282424] text-teal-400' 
                    : 'bg-[#e8dccc]/40 text-teal-700'
                  : isDarkMode 
                    ? 'hover:bg-[#282424] text-gray-300' 
                    : 'hover:bg-[#e8dccc]/20 text-gray-600'
              }`}
            >
              {showPromptPanel ? 'Hide Assistant' : 'Show Assistant'}
            </button>
            
            <button
              onClick={saveCanvasState}
              disabled={isSaving}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                isDarkMode
                  ? 'bg-teal-700 hover:bg-teal-600 text-white disabled:bg-gray-700 disabled:text-gray-400'
                  : 'bg-teal-600 hover:bg-teal-500 text-white disabled:bg-gray-300 disabled:text-gray-500'
              }`}
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Diagram Canvas */}
        <div className="relative flex-1 overflow-hidden">
          {isLoading ? (
            <div className={`absolute inset-0 flex items-center justify-center ${
              isDarkMode ? 'text-gray-400' : 'text-gray-600'
            }`}>
              Loading diagram...
            </div>
          ) : (
            <>
              {/* Toolbar */}
              <InteractiveEditorToolbar
                isDarkMode={isDarkMode}
                clearCanvas={clearCanvas}
                addNodeAtCenter={addNodeAtCenter}
                generateWithClaude={generateDiagramWithClaude}
                isGenerating={isGenerating}
                applyClaudeSuggestions={applyClaudeSuggestionsToCanvas}
              />
              
              {/* Canvas */}
              <InteractiveCanvas
                ref={canvasRef}
                projectId={projectId}
                initialState={canvasState}
                isDarkMode={isDarkMode}
                onSave={async (state) => {
                  setCanvasState(JSON.stringify(state));
                  await saveCanvasState();
                }}
              />
            </>
          )}
        </div>

        {/* Prompt Panel */}
        <AnimatePresence>
          {showPromptPanel && (
            <motion.div
              initial={{ x: 384, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 384, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className={`w-96 h-full border-l overflow-hidden ${
                isDarkMode 
                  ? 'bg-[#201c1c]/80 backdrop-blur-md border-[#282424]' 
                  : 'bg-white/80 backdrop-blur-md border-[#e8dccc]'
              }`}
            >
              <PromptPanel
                isDarkMode={isDarkMode}
                messages={messages}
                isGenerating={isProcessingPrompt}
                onPromptSubmit={handlePromptSubmit}
                onClearChat={clearChat}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Error Display */}
      {error && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 bg-red-500 text-white rounded-md shadow-lg">
          {error}
        </div>
      )}
    </div>
  );
} 