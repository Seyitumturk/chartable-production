import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import User from '@/models/User';
import { auth, currentUser } from '@clerk/nextjs/server';

// This is a test endpoint to simulate a Stripe webhook
// It will directly update a user's credits without going through Stripe
export async function POST(req: NextRequest) {
  try {
    // Get user auth info
    const user = await currentUser();
    const clerkId = user?.id;
    
    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Connect to database
    await dbConnect();
    console.log('Database connected for test webhook');

    // Parse request for credits amount
    const { credits } = await req.json();
    const creditsToAdd = parseInt(credits) || 5000; // Default to 5000 if not specified

    console.log(`Test webhook: Adding ${creditsToAdd} credits to user ${clerkId}`);

    // Find user by Clerk ID
    const userModel = await User.findOne({ clerkId });
    
    if (!userModel) {
      console.error(`User not found with clerkId: ${clerkId}`);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Add credits to the user's balance
    const oldBalance = userModel.wordCountBalance;
    userModel.wordCountBalance += creditsToAdd;
    
    await userModel.save();
    
    console.log(`Test webhook: Credits updated for user: ${oldBalance} + ${creditsToAdd} = ${userModel.wordCountBalance}`);

    return NextResponse.json({ 
      success: true, 
      user: {
        id: userModel._id.toString(),
        clerkId: userModel.clerkId,
        oldBalance,
        newBalance: userModel.wordCountBalance,
        added: creditsToAdd
      }
    });
  } catch (error) {
    console.error('Error in test webhook:', error);
    return NextResponse.json(
      { error: 'Test webhook failed' },
      { status: 500 }
    );
  }
} 