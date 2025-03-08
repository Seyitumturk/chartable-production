import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import connectDB from '@/lib/mongodb';
import Project from '@/models/Project';
import User from '@/models/User';

export async function GET(_req: Request) {
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

    const projects = await Project.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .select('_id title diagramType createdAt history');

    const formattedProjects = projects.map(project => ({
      _id: project._id,
      title: project.title,
      diagramType: project.diagramType,
      createdAt: project.createdAt,
      latestDiagramImg: project.history[0]?.diagram_img || null
    }));

    return NextResponse.json(formattedProjects);

  } catch (error) {
    console.error('Error in projects API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
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

    const { title, diagramType } = await req.json();

    // Define the valid diagram types (must match the enum in the Project model)
    const validDiagramTypes = [
      'erd',
      'flowchart',
      'sequence',
      'class',
      'state',
      'user_journey',
      'gantt',
      'quadrant',
      'requirement',
      'c4_diagram',
      'mindmap',
      'timeline',
      'sankey',
      'git',
      'architecture',
      'architecture-beta',
      'interactive'
    ];

    // Check if the diagram type is valid
    const normalizedDiagramType = diagramType.toLowerCase();
    if (!validDiagramTypes.includes(normalizedDiagramType)) {
      return NextResponse.json(
        { error: `Invalid diagram type: ${diagramType}. Valid types are: ${validDiagramTypes.join(', ')}` },
        { status: 400 }
      );
    }

    const project = new Project({
      title,
      diagramType: normalizedDiagramType,
      userId: user._id,
    });

    await project.save();

    return NextResponse.json(project);
  } catch (error) {
    console.error('Error in projects API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
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

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('id');

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    const project = await Project.findOne({ _id: projectId, userId: user._id });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    await Project.deleteOne({ _id: projectId });

    return NextResponse.json({ message: 'Project deleted successfully' });

  } catch (error) {
    console.error('Error in projects API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 