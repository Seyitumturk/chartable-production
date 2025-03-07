import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { headers } from 'next/headers';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb'; // Use direct mongodb connection
import User from '@/models/User';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = headers().get('stripe-signature') || '';

  let event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret!);
  } catch (err: any) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  // Handle the event
  try {
    console.log(`[WEBHOOK] Processing webhook event: ${event.type}`);
    
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      
      console.log(`[WEBHOOK] Checkout session completed: ${session.id}`);
      console.log(`[WEBHOOK] Payment status: ${session.payment_status}`);
      console.log(`[WEBHOOK] Metadata: ${JSON.stringify(session.metadata || {})}`);
      
      // Make sure payment status is paid or doesn't require payment
      if (session.payment_status === 'paid' || session.payment_status === 'no_payment_required') {
        try {
          await handleSuccessfulPayment(session);
        } catch (paymentError) {
          console.error('[WEBHOOK] Error handling payment:', paymentError);
          // We don't return an error response here to acknowledge receipt to Stripe
          // Stripe will retry the webhook if we return an error
        }
      } else {
        console.log(`[WEBHOOK] Payment not yet completed. Status: ${session.payment_status}`);
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[WEBHOOK] Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500 }
    );
  }
}

async function handleSuccessfulPayment(session: Stripe.Checkout.Session) {
  console.log('[WEBHOOK] Beginning handleSuccessfulPayment process');
  
  // Connect to database - use direct connection
  try {
    await connectDB();
    console.log('[WEBHOOK] Database connected successfully');
  } catch (dbError) {
    console.error('[WEBHOOK] Database connection error:', dbError);
    throw dbError;
  }

  // Extract user ID and credits from metadata
  const { userId, clerkId, credits } = session.metadata || {};

  console.log(`[WEBHOOK] Session metadata: userId=${userId}, clerkId=${clerkId}, credits=${credits}`);

  if (!credits) {
    console.error('[WEBHOOK] Missing credits in session metadata');
    throw new Error('Missing credits in session metadata');
  }

  // Parse credits as a number
  const purchasedCredits = parseInt(credits);
  if (isNaN(purchasedCredits)) {
    console.error(`[WEBHOOK] Invalid credits value: ${credits}`);
    throw new Error(`Invalid credits value: ${credits}`);
  }

  console.log(`[WEBHOOK] Credits to add: ${purchasedCredits}`);

  // Try to find user using multiple methods
  let user = null;

  // 1. Try to find by MongoDB ID from metadata
  if (userId && mongoose.Types.ObjectId.isValid(userId)) {
    try {
      console.log(`[WEBHOOK] Looking up user by MongoDB ID: ${userId}`);
      user = await User.findById(userId);
      if (user) {
        console.log(`[WEBHOOK] Found user by MongoDB ID: ${user._id}`);
      }
    } catch (error) {
      console.error(`[WEBHOOK] Error finding user by MongoDB ID:`, error);
    }
  }

  // 2. If not found and clerkId is provided, try by clerkId
  if (!user && clerkId) {
    try {
      console.log(`[WEBHOOK] Looking up user by clerkId: ${clerkId}`);
      user = await User.findOne({ clerkId });
      if (user) {
        console.log(`[WEBHOOK] Found user by clerkId: ${user._id}`);
      }
    } catch (error) {
      console.error(`[WEBHOOK] Error finding user by clerkId:`, error);
    }
  }

  // 3. If still not found, try using customer ID from Stripe
  if (!user && session.customer) {
    try {
      console.log(`[WEBHOOK] Looking up user by Stripe customer ID: ${session.customer}`);
      user = await User.findOne({ stripeCustomerId: session.customer });
      if (user) {
        console.log(`[WEBHOOK] Found user by Stripe customer ID: ${user._id}`);
      }
    } catch (error) {
      console.error(`[WEBHOOK] Error finding user by Stripe customer ID:`, error);
    }
  }

  // If user is still not found, we cannot proceed
  if (!user) {
    console.error('[WEBHOOK] User not found by any ID method. Cannot update credits.');
    throw new Error('User not found by any ID method');
  }

  // Add the purchased credits to the user's balance
  const oldBalance = user.wordCountBalance;
  user.wordCountBalance += purchasedCredits;
  
  try {
    await user.save();
    console.log(`[WEBHOOK] Credits updated for user ${user._id}: ${oldBalance} + ${purchasedCredits} = ${user.wordCountBalance}`);
  } catch (saveError) {
    console.error('[WEBHOOK] Error saving user with updated credits:', saveError);
    throw saveError;
  }
} 