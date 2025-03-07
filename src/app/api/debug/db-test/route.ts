import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import mongoose from 'mongoose';
import User from '@/models/User';
import { auth } from '@clerk/nextjs/server';

export async function GET(req: NextRequest) {
  try {
    console.log('[DB_TEST] Starting database test');
    
    // Check environment
    console.log('[DB_TEST] Environment:');
    console.log(`  NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`  MONGODB_URI: ${process.env.MONGODB_URI?.substring(0, 20)}...`);
    
    // Authenticate user for security
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      console.log('[DB_TEST] Unauthorized - no clerkId found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Test database connection
    console.log('[DB_TEST] Testing database connection...');
    let db;
    try {
      db = await connectDB();
      console.log('[DB_TEST] Database connected successfully!');
      console.log(`[DB_TEST] Mongoose connection state: ${mongoose.connection.readyState}`);
      // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
    } catch (error) {
      console.error('[DB_TEST] Database connection failed:', error);
      return NextResponse.json({ error: 'Database connection failed', details: error }, { status: 500 });
    }
    
    // Check if user model can be accessed
    console.log('[DB_TEST] Testing user model access...');
    let user;
    try {
      user = await User.findOne({ clerkId });
      if (user) {
        console.log(`[DB_TEST] Found user: ${user._id.toString()}`);
        console.log(`[DB_TEST] User data:`, JSON.stringify({
          username: user.username,
          email: user.email,
          wordCountBalance: user.wordCountBalance
        }));
      } else {
        console.log(`[DB_TEST] No user found with clerkId: ${clerkId}`);
      }
    } catch (error) {
      console.error('[DB_TEST] Error accessing user model:', error);
      return NextResponse.json({ error: 'User model access failed', details: error }, { status: 500 });
    }
    
    // Test a small credit update if user found
    if (user) {
      console.log('[DB_TEST] Testing credit update (adding 1 credit)...');
      const oldBalance = user.wordCountBalance;
      
      try {
        // First try the save method
        user.wordCountBalance += 1;
        await user.save();
        console.log(`[DB_TEST] Save method: Updated credits from ${oldBalance} to ${user.wordCountBalance}`);
        
        // Verify the update
        const verifyUser = await User.findById(user._id);
        console.log(`[DB_TEST] Verification: User credits now ${verifyUser.wordCountBalance}`);
        
        // Test updateOne method
        const updateResult = await User.updateOne(
          { _id: user._id },
          { $inc: { wordCountBalance: -1 } }  // Subtract the credit we added to restore balance
        );
        
        console.log(`[DB_TEST] UpdateOne result:`, JSON.stringify(updateResult));
        
        // Final verification
        const finalUser = await User.findById(user._id);
        console.log(`[DB_TEST] Final check: User credits now ${finalUser.wordCountBalance}`);
      } catch (error) {
        console.error('[DB_TEST] Error testing credit update:', error);
        return NextResponse.json({ 
          error: 'Credit update failed', 
          details: error,
          phase: 'credit_update'
        }, { status: 500 });
      }
    }
    
    return NextResponse.json({
      success: true,
      databaseConnected: true,
      userFound: !!user,
      mongooseState: mongoose.connection.readyState
    });
  } catch (error) {
    console.error('[DB_TEST] Unexpected error in database test:', error);
    return NextResponse.json({ 
      error: 'Database test failed with unexpected error', 
      details: error 
    }, { status: 500 });
  }
} 