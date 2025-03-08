import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';

export async function GET(_req: Request) {
  try {
    console.log('[USERS_API] GET request received');
    
    const { userId } = await auth();
    if (!userId) {
      console.log('[USERS_API] No userId found in auth');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log(`[USERS_API] Authorized request for clerkId: ${userId}`);

    await connectDB();
    console.log('[USERS_API] Database connected');

    const user = await User.findOne({ clerkId: userId });
    if (!user) {
      console.log(`[USERS_API] User not found with clerkId: ${userId}`);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    console.log(`[USERS_API] User found: ${user._id.toString()}`);
    console.log(`[USERS_API] Word count balance: ${user.wordCountBalance}`);
    console.log(`[USERS_API] User details: ${JSON.stringify({
      _id: user._id.toString(),
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      clerkId: user.clerkId,
      stripeCustomerId: user.stripeCustomerId,
      wordCountBalance: user.wordCountBalance,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    })}`);

    return NextResponse.json({
      user: {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        wordCountBalance: user.wordCountBalance,
        hasStarterPlan: user.hasStarterPlan || false,
        updatedAt: user.updatedAt
      }
    });

  } catch (error) {
    console.error('[USERS_API] Error in users API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
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

    const { firstName, lastName } = await req.json();

    user.firstName = firstName || user.firstName;
    user.lastName = lastName || user.lastName;

    await user.save();

    return NextResponse.json({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email
    });

  } catch (error) {
    console.error('Error in users API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 