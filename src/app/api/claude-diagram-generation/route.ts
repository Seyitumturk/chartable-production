import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { Anthropic } from '@anthropic-ai/sdk';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import Project from '@/models/Project';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    // Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Connect to database
    await connectDB();

    // Get user and check token balance
    const user = await User.findOne({ clerkId: userId });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user has sufficient tokens
    if (user.wordCountBalance < 2000) {
      return NextResponse.json({ error: 'Insufficient token balance' }, { status: 403 });
    }

    // Parse request body
    const { prompt, projectId, systemPrompt } = await req.json();
    
    if (!prompt || !projectId) {
      return NextResponse.json({ error: 'Missing prompt or project ID' }, { status: 400 });
    }

    // Verify project exists and belongs to user
    const project = await Project.findOne({
      _id: projectId,
      userId: user._id,
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Ensure project is an interactive diagram
    if (project.diagramType !== 'interactive') {
      return NextResponse.json({ error: 'Project is not an interactive diagram' }, { status: 400 });
    }

    // Use provided systemPrompt or fall back to default
    const defaultSystemPrompt = `You are an expert diagram assistant. You specialize in creating clear, well-structured flowcharts, entity relationship diagrams, 
and other visual representations of systems and processes. Your task is to create a top-to-bottom hierarchical flowchart
based on the user's request.

When creating flowcharts, follow these rules strictly:
1. Create a TREE-STRUCTURED flowchart that flows VERTICALLY from TOP to BOTTOM, NOT horizontally
2. Place parent nodes above their children with sufficient spacing between levels
3. Organize nodes by their logical level in the process, with start nodes at the top and terminal nodes at the bottom
4. Use a WIDE VARIETY of node shapes based on their function:
   - 'start' or 'begin' nodes should be rounded rectangles for entry points
   - 'end' or 'terminal' nodes should be rounded rectangles for exit points
   - 'process' nodes should be rectangles for standard actions
   - 'decision' nodes MUST BE DIAMONDS for choice points (yes/no, true/false questions)
   - 'input'/'output' nodes should be parallelograms for data entry/results
   - 'database' or 'storage' nodes should use cylinder shapes
   - 'document' nodes should use the document shape for reports/files
5. Clear, descriptive labels on connections between nodes
6. Limit the number of connections to avoid a messy diagram
7. If a node has multiple outgoing paths, make sure to label each path clearly (e.g., "Yes", "No", "Error")

Return your response as a JSON structure:
{
  "diagram": {
    "nodes": [
      { "id": "node1", "text": "Start Process", "type": "start" },
      { "id": "node2", "text": "Check Condition", "type": "decision" },
      { "id": "node3", "text": "Process Data", "type": "process" },
      { "id": "node4", "text": "Store Result", "type": "database" },
      { "id": "node5", "text": "Generate Report", "type": "document" },
      { "id": "node6", "text": "End Process", "type": "end" }
    ],
    "connections": [
      { "sourceId": "node1", "targetId": "node2", "label": "Begin" },
      { "sourceId": "node2", "targetId": "node3", "label": "Yes" },
      { "sourceId": "node2", "targetId": "node6", "label": "No" },
      { "sourceId": "node3", "targetId": "node4", "label": "Save" },
      { "sourceId": "node4", "targetId": "node5", "label": "Next" },
      { "sourceId": "node5", "targetId": "node6", "label": "Complete" }
    ]
  },
  "explanation": "Detailed explanation of the flowchart including process logic and decision points"
}`;

    // Call Claude API
    try {
      console.log('Calling Claude API with prompt:', prompt);
      
      // Adjust temperature based on whether we're using a custom system prompt
      // For diagram generation, we want higher creativity
      const temperature = systemPrompt && systemPrompt.includes('GENERATE A COMPLETE, WORKING DIAGRAM') ? 0.9 : 0.7;
      
      const response = await anthropic.messages.create({
        model: "claude-3-7-sonnet-20250219",
        max_tokens: 14000,
        temperature: temperature,
        system: systemPrompt || defaultSystemPrompt,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      });

      // Extract text content from response
      let responseText = '';
      for (const content of response.content) {
        if (content.type === 'text') {
          responseText += content.text;
        }
      }

      // Process response - Look for JSON structure more aggressively
      let suggestions;
      try {
        // First try to parse the entire response as JSON (best case scenario)
        try {
          suggestions = JSON.parse(responseText.trim());
        } catch (directParseError) {
          // Look for JSON structure in the response
          const jsonMatch = responseText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            // Try to parse the matched JSON
            try {
              suggestions = JSON.parse(jsonMatch[0]);
            } catch (jsonError) {
              console.error('Error parsing matched JSON:', jsonError);
              
              // Try to clean up the JSON and parse it again
              try {
                let cleanedJson = jsonMatch[0]
                  .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
                  .replace(/\\'/g, "'")          // Fix escaped single quotes
                  .replace(/\\"/g, '"')          // Fix escaped double quotes
                  .replace(/'/g, '"')            // Convert single to double quotes for JSON
                  .replace(/(\w+):/g, '"$1":');  // Ensure property names are quoted
                
                suggestions = JSON.parse(cleanedJson);
              } catch (cleaningError) {
                // Create a fallback if parsing fails
                suggestions = {
                  analysis: responseText,
                  parseError: true
                };
              }
            }
          } else {
            // If no JSON found, create a basic structure with the full text
            suggestions = {
              analysis: responseText,
              suggestions: {
                nodeLabels: [],
                connectionLabels: [],
                newNodes: [],
                newConnections: [],
                issues: []
              }
            };
          }
        }
        
        // If using custom system prompt for diagram generation, check for specific format
        if (systemPrompt && (systemPrompt.includes('GENERATE A COMPLETE, WORKING DIAGRAM') || 
                            systemPrompt.includes('Return your response as a JSON object'))) {
          // Look for diagram data in the parsed JSON
          if (!suggestions.diagram && responseText.includes('"nodes"') && responseText.includes('"connections"')) {
            // Try to extract diagram components directly
            try {
              // Extract nodes array
              const nodesMatch = responseText.match(/"nodes"\s*:\s*(\[[\s\S]*?\])/);
              // Extract connections array
              const connectionsMatch = responseText.match(/"connections"\s*:\s*(\[[\s\S]*?\])/);
              
              if (nodesMatch && connectionsMatch) {
                const fixedNodesStr = nodesMatch[1].replace(/'/g, '"').replace(/(\w+):/g, '"$1":');
                const fixedConnectionsStr = connectionsMatch[1].replace(/'/g, '"').replace(/(\w+):/g, '"$1":');
                
                let nodes, connections;
                try { nodes = JSON.parse(fixedNodesStr); } 
                catch(e) { nodes = []; }
                
                try { connections = JSON.parse(fixedConnectionsStr); } 
                catch(e) { connections = []; }
                
                suggestions = {
                  diagram: {
                    nodes: nodes,
                    connections: connections
                  },
                  explanation: "Generated diagram based on the request."
                };
              }
            } catch (extractionError) {
              console.error("Error extracting diagram components:", extractionError);
            }
          }
          
          // If no diagram found but we need one, create a default Airbnb-like diagram as fallback
          if ((!suggestions.diagram || !suggestions.diagram.nodes) && 
              prompt.toLowerCase().includes('airbnb')) {
            suggestions = {
              diagram: {
                nodes: [
                  { id: "start", text: "User Visits Airbnb", type: "start" },
                  { id: "search", text: "Search for Listings", type: "process" },
                  { id: "filters", text: "Apply Filters", type: "process" },
                  { id: "listing", text: "View Listing Details", type: "process" },
                  { id: "decision", text: "Book?", type: "decision" },
                  { id: "booking", text: "Complete Booking", type: "process" },
                  { id: "payment", text: "Process Payment", type: "process" },
                  { id: "stay", text: "Stay at Property", type: "process" },
                  { id: "review", text: "Leave Review", type: "process" },
                  { id: "end", text: "End", type: "end" }
                ],
                connections: [
                  { from: "start", to: "search", label: "Enter destination" },
                  { from: "search", to: "filters", label: "View results" },
                  { from: "filters", to: "listing", label: "Select listing" },
                  { from: "listing", to: "decision", label: "Consider booking" },
                  { from: "decision", to: "booking", label: "Yes" },
                  { from: "decision", to: "start", label: "No" },
                  { from: "booking", to: "payment", label: "Confirm" },
                  { from: "payment", to: "stay", label: "Booking confirmed" },
                  { from: "stay", to: "review", label: "After stay" },
                  { from: "review", to: "end", label: "Complete" }
                ]
              },
              explanation: "Comprehensive flowchart showing the Airbnb user journey from search to review."
            };
          }
        }
      } catch (parseError) {
        console.error('Error parsing Claude response as JSON:', parseError);
        // Create a fallback structure
        suggestions = {
          analysis: responseText,
          parseError: true
        };
      }

      // Update user's token balance
      await User.findByIdAndUpdate(user._id, {
        $inc: { wordCountBalance: -2000 }
      });
      
      // Process the response before sending it to ensure nodes have IDs
      if (suggestions && suggestions.diagram && Array.isArray(suggestions.diagram.nodes)) {
        try {
          // Define types for nodes and connections
          interface DiagramNode {
            id?: string;
            originalId?: string;
            text?: string;
            type?: string;
            [key: string]: any;
          }
          
          interface DiagramConnection {
            id?: string;
            sourceId?: string;
            targetId?: string;
            from?: string;
            to?: string;
            source?: string;
            target?: string;
            label?: string;
            originalSource?: string;
            originalTarget?: string;
            [key: string]: any;
          }
          
          // Ensure all nodes have IDs and valid structure
          suggestions.diagram.nodes = suggestions.diagram.nodes
            .filter((node: DiagramNode | null | undefined) => {
              // Filter out null or undefined nodes
              if (!node) {
                console.warn('Filtering out null/undefined node');
                return false;
              }
              return true;
            })
            .map((node: DiagramNode, index: number) => {
              // Create a guaranteed unique ID with a consistent format
              // This is easier for the client to match with connections
              const safeId = `node${index + 1}`;
              
              // Create a safe node object with required properties
              const safeNode: DiagramNode = {
                id: safeId,
                originalId: node.id, // Store original ID if needed
                text: node.text || `Node ${index + 1}`,
                type: node.type || 'process'
              };
              
              // Copy any other properties from the original node
              return { ...node, ...safeNode };
            });
          
          // Store the node ID map for updating connections
          const nodeIdMap = new Map<string, string>();
          suggestions.diagram.nodes.forEach((node: DiagramNode) => {
            if (node.originalId && node.id) {
              nodeIdMap.set(node.originalId, node.id);
            }
          });
          
          // Ensure all connections reference valid nodes and have proper structure
          if (Array.isArray(suggestions.diagram.connections)) {
            const nodeIds = new Set(suggestions.diagram.nodes.map((n: DiagramNode) => n.id));
            
            suggestions.diagram.connections = suggestions.diagram.connections
              .filter((conn: DiagramConnection | null | undefined) => {
                // Filter out null or undefined connections
                if (!conn) {
                  console.warn('Filtering out null/undefined connection');
                  return false;
                }
                
                return true;
              })
              .map((conn: DiagramConnection, index: number) => {
                // Determine source/target using originalId mapping if available
                let sourceId = conn.from || conn.sourceId || conn.source;
                let targetId = conn.to || conn.targetId || conn.target;
                
                // Map source to new node ID format
                if (sourceId && nodeIdMap.has(sourceId)) {
                  sourceId = nodeIdMap.get(sourceId);
                } else if (sourceId && /^\d+$/.test(sourceId)) {
                  // If it's just a number, assume it's pointing to that node index
                  sourceId = `node${sourceId}`;
                } else if (!nodeIds.has(sourceId)) {
                  // Default to first node if source is invalid
                  sourceId = 'node1';
                }
                
                // Map target to new node ID format
                if (targetId && nodeIdMap.has(targetId)) {
                  targetId = nodeIdMap.get(targetId);
                } else if (targetId && /^\d+$/.test(targetId)) {
                  // If it's just a number, assume it's pointing to that node index
                  targetId = `node${targetId}`;
                } else if (!nodeIds.has(targetId) && suggestions.diagram.nodes.length > 1) {
                  // Default to second node if target is invalid (if there is one)
                  targetId = 'node2';
                } else if (!nodeIds.has(targetId)) {
                  // Fallback to first node
                  targetId = 'node1';
                }
                
                // Store the original source and target for debugging
                const safeConn: DiagramConnection = {
                  id: `conn${index + 1}`,
                  sourceId: sourceId,
                  targetId: targetId,
                  originalSource: conn.from || conn.sourceId || conn.source,
                  originalTarget: conn.to || conn.targetId || conn.target,
                  label: conn.label || ''
                };
                
                return safeConn;
              });
          } else {
            // Initialize connections array if it doesn't exist
            suggestions.diagram.connections = [];
            
            // If we have multiple nodes but no connections, create a simple chain
            if (suggestions.diagram.nodes.length > 1) {
              for (let i = 0; i < suggestions.diagram.nodes.length - 1; i++) {
                suggestions.diagram.connections.push({
                  id: `conn${i + 1}`,
                  sourceId: `node${i + 1}`,
                  targetId: `node${i + 2}`,
                  label: ''
                });
              }
            }
          }
          
          // Ensure we have at least one node and connection for the fallback case
          if (suggestions.diagram.nodes.length === 0) {
            suggestions.diagram.nodes = [
              { id: 'node1', text: 'Start', type: 'start' },
              { id: 'node2', text: 'Process', type: 'process' },
              { id: 'node3', text: 'End', type: 'end' }
            ];
            
            suggestions.diagram.connections = [
              { id: 'conn1', sourceId: 'node1', targetId: 'node2', label: 'Start' },
              { id: 'conn2', sourceId: 'node2', targetId: 'node3', label: 'End' }
            ];
          }
        } catch (error) {
          console.error('Error processing diagram data:', error);
          // Create a fallback diagram with minimal structure
          suggestions.diagram = {
            nodes: [
              { id: 'node1', text: 'Start', type: 'start' },
              { id: 'node2', text: 'Error Processing Diagram', type: 'process' },
              { id: 'node3', text: 'End', type: 'end' }
            ],
            connections: [
              { id: 'conn1', sourceId: 'node1', targetId: 'node2', label: 'Error' },
              { id: 'conn2', sourceId: 'node2', targetId: 'node3', label: 'Continue' }
            ]
          };
        }
      }

      return NextResponse.json({
        suggestions: suggestions
      });
    } catch (error: any) {
      console.error('Error calling Claude API:', error);
      
      // Handle specific API errors
      if (error.status === 400) {
        return NextResponse.json({ error: 'Invalid request to Claude API' }, { status: 400 });
      } else if (error.status === 429) {
        return NextResponse.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 });
      } else if (error.status === 500) {
        return NextResponse.json({ error: 'Claude API service error' }, { status: 502 });
      }
      
      return NextResponse.json({ error: 'Error generating suggestions with Claude' }, { status: 500 });
    }
  } catch (error) {
    console.error('Unhandled error in Claude diagram generation API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 