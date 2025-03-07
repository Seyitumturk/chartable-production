import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import User from '@/models/User';
import { auth, currentUser } from '@clerk/nextjs/server';

// This is a test endpoint to simulate a Stripe webhook
// It will directly update a user's credits without going through Stripe
export async function POST(req: NextRequest) {
  try {
    console.log('[TEST_WEBHOOK] Starting test webhook process');
    
    // Get user auth info
    const user = await currentUser();
    const clerkId = user?.id;
    
    if (!clerkId) {
      console.log('[TEST_WEBHOOK] No clerkId found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`[TEST_WEBHOOK] Authorized for clerkId: ${clerkId}`);

    // Connect to database
    await dbConnect();
    console.log('[TEST_WEBHOOK] Database connected for test webhook');
    
    console.log(`[TEST_WEBHOOK] Environment check:`);
    console.log(`  NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`  MONGODB_URI: ${process.env.MONGODB_URI?.substring(0, 20)}...`);

    // Parse request for credits amount
    const { credits } = await req.json();
    const creditsToAdd = parseInt(credits) || 5000; // Default to 5000 if not specified

    console.log(`[TEST_WEBHOOK] Adding ${creditsToAdd} credits to user ${clerkId}`);

    // Find user by Clerk ID
    const userModel = await User.findOne({ clerkId });
    
    if (!userModel) {
      console.error(`[TEST_WEBHOOK] User not found with clerkId: ${clerkId}`);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    console.log(`[TEST_WEBHOOK] Found user: ${userModel._id.toString()}`);
    console.log(`[TEST_WEBHOOK] Current user data:`, JSON.stringify({
      _id: userModel._id.toString(),
      username: userModel.username,
      email: userModel.email,
      clerkId: userModel.clerkId,
      wordCountBalance: userModel.wordCountBalance
    }));

    // Add credits to the user's balance
    const oldBalance = userModel.wordCountBalance;
    userModel.wordCountBalance += creditsToAdd;
    
    console.log(`[TEST_WEBHOOK] About to save with new balance: ${userModel.wordCountBalance}`);
    
    try {
      const result = await userModel.save();
      console.log(`[TEST_WEBHOOK] Save operation result:`, JSON.stringify(result));
    } catch (saveError) {
      console.error(`[TEST_WEBHOOK] Error saving user:`, saveError);
      return NextResponse.json({ error: 'Failed to save user' }, { status: 500 });
    }
    
    // Verify the update was applied by fetching the user again
    const updatedUser = await User.findById(userModel._id);
    console.log(`[TEST_WEBHOOK] User after update:`, JSON.stringify({
      _id: updatedUser._id.toString(),
      wordCountBalance: updatedUser.wordCountBalance
    }));
    
    console.log(`[TEST_WEBHOOK] Credits updated for user: ${oldBalance} + ${creditsToAdd} = ${updatedUser.wordCountBalance}`);

    if (updatedUser.wordCountBalance !== userModel.wordCountBalance) {
      console.error(`[TEST_WEBHOOK] WARNING: Updated balance mismatch! Expected ${userModel.wordCountBalance} but got ${updatedUser.wordCountBalance}`);
    }

    return NextResponse.json({ 
      success: true, 
      user: {
        id: userModel._id.toString(),
        clerkId: userModel.clerkId,
        oldBalance,
        newBalance: updatedUser.wordCountBalance,
        added: creditsToAdd
      }
    });
  } catch (error) {
    console.error('[TEST_WEBHOOK] Error in test webhook:', error);
    return NextResponse.json(
      { error: 'Test webhook failed' },
      { status: 500 }
    );
  }
} 