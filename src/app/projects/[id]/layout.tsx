// Add support for interactive diagram type in any layout-level checks
// For example, if there's a condition to show/hide certain components based on diagram type:

// Look for conditional checks on diagramType and add 'interactive' as a valid type
// Example:
// if (project.diagramType === 'interactive') {
//   // Special handling for interactive diagrams
// }

// If there's navigation that depends on diagram types, ensure 'interactive' is included 

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { Metadata } from 'next';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import Project from '@/models/Project';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return {
        title: 'Project - Not Authorized',
      };
    }

    await connectDB();
    const user = await User.findOne({ clerkId: userId });

    if (!user) {
      return {
        title: 'Project - User Not Found',
      };
    }

    // Properly await the params object
    const { id } = await params;
    
    const project = await Project.findOne({
      _id: id,
      userId: user._id,
    });

    if (!project) {
      return {
        title: 'Project - Not Found',
      };
    }

    return {
      title: `${project.title} - Project`,
      description: `Diagram: ${project.diagramType}`,
    };
  } catch (error) {
    console.error('Error generating metadata:', error);
    return {
      title: 'Project - Error',
    };
  }
}

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  await connectDB();
  const user = await User.findOne({ clerkId: userId });
  if (!user) {
    redirect('/sign-in');
  }

  // Properly await the params object
  const { id } = await params;

  // Verify the project exists and belongs to the user
  const project = await Project.findOne({
    _id: id,
    userId: user._id,
  });

  if (!project) {
    redirect('/projects');
  }

  // The layout applies to all diagram types including 'interactive'
  return (
    <>
      {children}
    </>
  );
} 