import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import Stripe from 'stripe';
import dbConnect from '@/lib/dbConnect';
import User from '@/models/User';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

// Define price IDs and corresponding credits for the pricing table: prctbl_1QzLmxJrIw0vuTAiYguWSJwi
// These need to match your actual Stripe price IDs
const PRICE_CREDITS_MAP: Record<string, number> = {
  // Update these with your actual price IDs from Stripe Dashboard
  'price_starter': 5000,      // Free tier - 5,000 credits
  'price_plus': 50000,        // Plus tier - 50,000 credits ($4.99)
  'price_pro': 150000,        // Pro tier - 150,000 credits ($9.99)
  'price_1Qzo1PJrIw0vuTAiNebDjhul': 5000,  // Test product - Updated to 5,000 credits ($0.50 CAD)
  
  // Add any live price IDs that are being used
  // Example: 'price_1QzLmxJrIw0vuTAiYguWSJwi': 5000, 
};

export async function POST(req: NextRequest) {
  try {
    console.log('[CHECKOUT] Starting checkout session creation');
    
    // Get user auth info using currentUser instead of auth
    const user = await currentUser();
    const clerkId = user?.id;
    
    if (!clerkId) {
      console.error('[CHECKOUT] No clerkId found in session');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`[CHECKOUT] Creating session for user: ${clerkId}`);

    // Parse the request body
    const { priceId } = await req.json();
    
    if (!priceId) {
      console.error('[CHECKOUT] No priceId provided in request');
      return NextResponse.json({ error: 'Price ID is required' }, { status: 400 });
    }

    console.log(`[CHECKOUT] Price ID requested: ${priceId}`);

    // Verify price ID exists in our pricing map
    if (!PRICE_CREDITS_MAP[priceId]) {
      console.error(`[CHECKOUT] Invalid price ID requested: ${priceId}. Available price IDs: ${Object.keys(PRICE_CREDITS_MAP).join(', ')}`);
      return NextResponse.json({ 
        error: 'Invalid price ID. Please check your Stripe configuration.' 
      }, { status: 400 });
    }

    // Connect to the database
    await dbConnect();
    console.log('[CHECKOUT] Database connected');

    // Find the user
    const userModel = await User.findOne({ clerkId });
    
    if (!userModel) {
      console.error(`[CHECKOUT] User not found with clerkId: ${clerkId}`);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    console.log(`[CHECKOUT] Found user: ${userModel._id.toString()}`);
    console.log(`[CHECKOUT] Current credits: ${userModel.wordCountBalance}`);
    console.log(`[CHECKOUT] Credits to add: ${PRICE_CREDITS_MAP[priceId]}`);

    // Create a Stripe customer if one doesn't exist
    if (!userModel.stripeCustomerId) {
      console.log(`[CHECKOUT] Creating Stripe customer for user: ${userModel._id.toString()}`);
      const customer = await stripe.customers.create({
        email: userModel.email,
        name: `${userModel.firstName} ${userModel.lastName}`,
        metadata: {
          userId: userModel._id.toString(),
          clerkId: userModel.clerkId,
        },
      });

      userModel.stripeCustomerId = customer.id;
      await userModel.save();
      console.log(`[CHECKOUT] Saved Stripe customer ID: ${customer.id}`);
    } else {
      console.log(`[CHECKOUT] Using existing Stripe customer ID: ${userModel.stripeCustomerId}`);
    }

    // Prepare metadata for the webhook
    const metadata = {
      userId: userModel._id.toString(),
      clerkId: userModel.clerkId,
      credits: PRICE_CREDITS_MAP[priceId].toString(),
      userEmail: userModel.email,
      productName: Object.keys(PRICE_CREDITS_MAP).find(key => key === priceId) || priceId
    };

    console.log(`[CHECKOUT] Session metadata: ${JSON.stringify(metadata)}`);

    // Create a checkout session
    const session = await stripe.checkout.sessions.create({
      customer: userModel.stripeCustomerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/projects`,
      metadata,
    });

    console.log(`[CHECKOUT] Checkout session created: ${session.id}`);
    return NextResponse.json({ sessionId: session.id });
  } catch (error) {
    console.error('[CHECKOUT] Stripe checkout session error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
} 