import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { headers } from 'next/headers';
import dbConnect from '@/lib/dbConnect';
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
    console.log(`Processing webhook event: ${event.type}`);
    
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      
      console.log(`Checkout session completed: ${session.id}`);
      console.log(`Payment status: ${session.payment_status}`);
      console.log(`Metadata: ${JSON.stringify(session.metadata)}`);
      
      // Make sure payment status is paid or doesn't require payment
      if (session.payment_status === 'paid' || session.payment_status === 'no_payment_required') {
        await handleSuccessfulPayment(session);
      } else {
        console.log(`Payment not yet completed. Status: ${session.payment_status}`);
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500 }
    );
  }
}

async function handleSuccessfulPayment(session: Stripe.Checkout.Session) {
  console.log('Beginning handleSuccessfulPayment process');
  
  // Connect to database
  await dbConnect();
  console.log('Database connected');

  // Extract user ID and credits from metadata
  const { userId, clerkId, credits } = session.metadata || {};

  if (!userId || !credits) {
    console.error('Missing userId or credits in session metadata');
    return;
  }

  console.log(`Processing payment for userId: ${userId}, credits: ${credits}`);

  // Find user and update credits
  const user = await User.findById(userId);
  
  if (!user) {
    console.error(`User not found with ID: ${userId}`);
    
    // Try looking up by clerkId as a fallback
    if (clerkId) {
      console.log(`Trying to find user by clerkId: ${clerkId}`);
      const userByClerkId = await User.findOne({ clerkId });
      
      if (userByClerkId) {
        console.log(`Found user by clerkId: ${userByClerkId._id}`);
        // Update the user's credits
        const oldBalance = userByClerkId.wordCountBalance;
        const purchasedCredits = parseInt(credits);
        userByClerkId.wordCountBalance += purchasedCredits;
        
        await userByClerkId.save();
        
        console.log(`Credits updated for user ${userByClerkId._id}: ${oldBalance} + ${purchasedCredits} = ${userByClerkId.wordCountBalance}`);
        return;
      }
    }
    
    console.error(`User not found by any ID method. Cannot update credits.`);
    return;
  }

  // Add the purchased credits to the user's balance
  const oldBalance = user.wordCountBalance;
  const purchasedCredits = parseInt(credits);
  user.wordCountBalance += purchasedCredits;
  
  await user.save();
  
  console.log(`Credits updated for user ${userId}: ${oldBalance} + ${purchasedCredits} = ${user.wordCountBalance}`);
} 