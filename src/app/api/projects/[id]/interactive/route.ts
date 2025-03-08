import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import Project from '@/models/Project';

// Update the canvas state for an interactive diagram
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const user = await User.findOne({ clerkId: userId });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Properly await the params object
    const { id: projectId } = await params;

    const project = await Project.findOne({
      _id: projectId,
      userId: user._id,
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Verify this is an interactive diagram
    if (project.diagramType !== 'interactive') {
      return NextResponse.json({ 
        error: 'This operation is only valid for interactive diagrams' 
      }, { status: 400 });
    }

    const { canvasState } = await req.json();
    
    if (!canvasState) {
      return NextResponse.json({ 
        error: 'Canvas state is required' 
      }, { status: 400 });
    }

    // Update the canvas state
    const updatedProject = await Project.findByIdAndUpdate(
      projectId,
      { $set: { canvasState } },
      { new: true }
    );

    return NextResponse.json({
      success: true,
      message: 'Canvas state updated successfully',
      canvasState: updatedProject.canvasState
    });
  } catch (error) {
    console.error('Error updating interactive diagram:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Get the canvas state for an interactive diagram
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const user = await User.findOne({ clerkId: userId });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Properly await the params object
    const { id: projectId } = await params;

    const project = await Project.findOne({
      _id: projectId,
      userId: user._id,
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Verify this is an interactive diagram
    if (project.diagramType !== 'interactive') {
      return NextResponse.json({ 
        error: 'This operation is only valid for interactive diagrams' 
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      canvasState: project.canvasState || null
    });
  } catch (error) {
    console.error('Error retrieving interactive diagram:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 