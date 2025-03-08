import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import Project from '@/models/Project';
import DiagramEditor from './editor';
import { Types } from 'mongoose';
import Image from 'next/image';

interface SerializedHistoryItem {
  _id: string;
  prompt?: string;
  diagram: string;
  diagram_img?: string;
  updateType: 'chat' | 'code' | 'reversion';
  updatedAt: string;
}

interface SerializedProject {
  _id: string;
  title: string;
  diagramType: string;
  createdAt: string;
  history: SerializedHistoryItem[];
  currentDiagram: string;
}

interface LeanProject {
  _id: Types.ObjectId;
  title: string;
  diagramType: string;
  createdAt: Date;
  history?: {
    _id: Types.ObjectId;
    prompt?: string;
    diagram: string;
    diagram_img?: string;
    updateType: 'chat' | 'code' | 'reversion';
    updatedAt: Date;
  }[];
  currentDiagram?: string;
}

async function getProject(userId: string, projectId: string) {
  await connectDB();
  
  const user = await User.findOne({ clerkId: userId });
  if (!user) {
    throw new Error('User not found');
  }

  const rawProject = await Project.findOne({ _id: projectId, userId: user._id }).lean() as unknown as LeanProject;
  console.log(">> rawProject from DB:", rawProject);
  if (!rawProject) {
    throw new Error('Project not found');
  }

  // Fallback: if currentDiagram is missing and history is empty,
  // try to load the latest GPTResponse for this project.
  if (!rawProject.currentDiagram && (!rawProject.history || rawProject.history.length === 0)) {
    // IMPORTANT: Ensure your GptResponse model stores a projectId.
    // If not, update it accordingly.
    const GptResponse = (await import('@/models/GptResponse')).default;
    const latestGPT = await GptResponse.findOne({ projectId: projectId })
      .sort({ createdAt: -1 })
      .lean();
    if (latestGPT && latestGPT.extractedSyntax) {
      rawProject.currentDiagram = latestGPT.extractedSyntax;
      console.log(">> getProject fallback: Retrieved currentDiagram from GPTResponse:", rawProject.currentDiagram);
    }
  }

  if (!rawProject.currentDiagram && rawProject.history && rawProject.history.length > 0) {
    rawProject.currentDiagram = rawProject.history[0].diagram;
  }

  const serializedProject: SerializedProject = {
    _id: rawProject._id.toString(),
    title: rawProject.title,
    diagramType: rawProject.diagramType,
    createdAt: rawProject.createdAt.toISOString(),
    history: (rawProject.history || []).map((item) => ({
      _id: item._id.toString(),
      prompt: item.prompt || '',
      diagram: item.diagram,
      diagram_img: item.diagram_img,
      updateType: item.updateType,
      updatedAt: new Date(item.updatedAt).toISOString()
    })),
    currentDiagram: rawProject.currentDiagram || ''
  };
  console.log(">> serializedProject currentDiagram:", serializedProject.currentDiagram);
  
  return {
    project: serializedProject,
    user: {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      wordCountBalance: user.wordCountBalance
    }
  };
}

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) {
    redirect('/login');
  }

  // Properly await the params object
  const { id } = await params;
  const { project, user } = await getProject(userId, id);
  
  // Redirect to interactive editor for interactive diagram type
  if (project.diagramType === 'interactive') {
    redirect(`/projects/${id}/interactiveEditor`);
  }

  // Use currentDiagram if available; otherwise fall back to history[0]
  const currentDiagram = project.currentDiagram || (project.history[0]?.diagram || '');
  
  // Create user display data
  const userDisplayData = {
    credits: user.wordCountBalance,
    initials: `${user.firstName[0]}${user.lastName[0]}`
  };

  return (
    <main className="min-h-screen bg-background">
      <DiagramEditor
        projectId={project._id}
        projectTitle={project.title}
        diagramType={project.diagramType}
        initialDiagram={currentDiagram}
        user={userDisplayData}
        history={project.history}
      />
    </main>
  );
} 