import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { auth } from '@clerk/nextjs/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

export async function POST(req: NextRequest) {
  try {
    console.log('[MANUAL_CREDIT] Starting manual credit update process');
    
    // Authenticate the user
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      console.error('[MANUAL_CREDIT] No authenticated user found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log(`[MANUAL_CREDIT] Authenticated user: ${clerkId}`);
    
    // Parse the request
    const { sessionId, credits } = await req.json();
    
    if (!sessionId) {
      console.error('[MANUAL_CREDIT] No sessionId provided');
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    const creditsToAdd = parseInt(credits) || 5000;
    console.log(`[MANUAL_CREDIT] Processing session ${sessionId} for ${creditsToAdd} credits`);

    // Verify this is a valid Stripe session
    let session;
    try {
      session = await stripe.checkout.sessions.retrieve(sessionId);
      console.log(`[MANUAL_CREDIT] Retrieved Stripe session: ${session.id}`);
      console.log(`[MANUAL_CREDIT] Session payment status: ${session.payment_status}`);
      
      // Verify payment was successful
      if (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') {
        console.error(`[MANUAL_CREDIT] Payment not completed. Status: ${session.payment_status}`);
        return NextResponse.json(
          { error: 'Payment not completed' },
          { status: 400 }
        );
      }
    } catch (stripeError) {
      console.error('[MANUAL_CREDIT] Error retrieving Stripe session:', stripeError);
      return NextResponse.json(
        { error: 'Invalid session ID' },
        { status: 400 }
      );
    }

    // Connect to database
    await connectDB();
    console.log('[MANUAL_CREDIT] Database connected');

    // Find current user
    const user = await User.findOne({ clerkId });
    if (!user) {
      console.error(`[MANUAL_CREDIT] User not found with clerkId: ${clerkId}`);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    console.log(`[MANUAL_CREDIT] Found user: ${user._id.toString()}`);
    console.log(`[MANUAL_CREDIT] Current balance: ${user.wordCountBalance}`);

    // Record the current state for logging
    const oldBalance = user.wordCountBalance;

    // Update the user's credit balance
    user.wordCountBalance += creditsToAdd;
    
    // Add detailed console logs to help debug
    console.log(`[MANUAL_CREDIT] Updating balance: ${oldBalance} + ${creditsToAdd} = ${user.wordCountBalance}`);
    console.log(`[MANUAL_CREDIT] User schema before save:`, JSON.stringify(user.toObject(), null, 2));
    
    try {
      const result = await user.save();
      console.log(`[MANUAL_CREDIT] Save result:`, JSON.stringify(result, null, 2));
    } catch (saveError) {
      console.error('[MANUAL_CREDIT] Error saving user:', saveError);
      return NextResponse.json(
        { error: 'Failed to update credits' },
        { status: 500 }
      );
    }

    // Double-check the update was applied by fetching the user again
    const updatedUser = await User.findById(user._id);
    console.log(`[MANUAL_CREDIT] User after update:`, JSON.stringify({
      _id: updatedUser._id.toString(),
      wordCountBalance: updatedUser.wordCountBalance
    }));
    
    if (updatedUser.wordCountBalance !== user.wordCountBalance) {
      console.error(`[MANUAL_CREDIT] WARNING: Updated balance mismatch! Expected ${user.wordCountBalance} but got ${updatedUser.wordCountBalance}`);
    }

    return NextResponse.json({
      success: true,
      oldBalance,
      creditsAdded: creditsToAdd,
      newBalance: updatedUser.wordCountBalance
    });
  } catch (error) {
    console.error('[MANUAL_CREDIT] Unexpected error in manual credit update:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 