import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import User from '@/models/User';
import mongoose from 'mongoose';

// This is a simpler test endpoint that adds credits directly to the user
export async function POST(req: NextRequest) {
  try {
    console.log('[TEST-CREDITS] Starting test credits check');
    
    // Connect to database
    console.log('[TEST-CREDITS] Connecting to MongoDB...');
    await dbConnect();
    console.log('[TEST-CREDITS] Database connected successfully');
    
    // Parse the request body
    const { userId, clerkId, credits } = await req.json();
    
    if (!userId && !clerkId) {
      console.error('[TEST-CREDITS] No userId or clerkId provided');
      return NextResponse.json({ error: 'Either userId or clerkId is required' }, { status: 400 });
    }
    
    const creditsToAdd = parseInt(credits) || 5000;
    console.log(`[TEST-CREDITS] Credits to add: ${creditsToAdd}`);

    // Find the user
    let user = null;
    
    // Try to find by MongoDB ID
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      try {
        console.log(`[TEST-CREDITS] Looking up user by MongoDB ID: ${userId}`);
        user = await User.findById(userId);
        if (user) {
          console.log(`[TEST-CREDITS] Found user by MongoDB ID: ${user._id}`);
        }
      } catch (error) {
        console.error(`[TEST-CREDITS] Error finding user by MongoDB ID:`, error);
      }
    }
    
    // If not found, try by clerkId
    if (!user && clerkId) {
      try {
        console.log(`[TEST-CREDITS] Looking up user by clerkId: ${clerkId}`);
        user = await User.findOne({ clerkId });
        if (user) {
          console.log(`[TEST-CREDITS] Found user by clerkId: ${user._id}`);
        }
      } catch (error) {
        console.error(`[TEST-CREDITS] Error finding user by clerkId:`, error);
      }
    }
    
    if (!user) {
      console.error('[TEST-CREDITS] User not found');
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    // Add credits to the user's balance
    const oldBalance = user.wordCountBalance;
    user.wordCountBalance += creditsToAdd;
    
    try {
      await user.save();
      console.log(`[TEST-CREDITS] Credits updated for user ${user._id}: ${oldBalance} + ${creditsToAdd} = ${user.wordCountBalance}`);
      
      return NextResponse.json({
        success: true,
        user: {
          id: user._id.toString(),
          clerkId: user.clerkId,
          oldBalance,
          creditsAdded: creditsToAdd,
          newBalance: user.wordCountBalance
        }
      });
    } catch (saveError) {
      console.error('[TEST-CREDITS] Error saving user with updated credits:', saveError);
      return NextResponse.json({
        error: 'Failed to save user credits',
        details: saveError instanceof Error ? saveError.message : 'Unknown error'
      }, { status: 500 });
    }
  } catch (error) {
    console.error('[TEST-CREDITS] Unexpected error:', error);
    return NextResponse.json({
      error: 'Failed to process test credits',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 