import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';

export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the user's information from Clerk
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json({ error: 'User not found in Clerk' }, { status: 404 });
    }

    await connectDB();

    // Check if user already exists in MongoDB
    const existingUser = await User.findOne({ clerkId: userId });
    if (existingUser) {
      return NextResponse.json({ user: existingUser });
    }

    // Create new user in MongoDB
    const newUser = await User.create({
      username: clerkUser.username || `${clerkUser.firstName}${clerkUser.lastName}`.toLowerCase(),
      clerkId: userId,
      firstName: clerkUser.firstName || '',
      lastName: clerkUser.lastName || '',
      email: clerkUser.emailAddresses[0]?.emailAddress || '',
      wordCountBalance: 5000, // Default word count balance
      hasStarterPlan: false, // Initialize as not having purchased the Starter plan yet
    });

    return NextResponse.json({ user: newUser });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 