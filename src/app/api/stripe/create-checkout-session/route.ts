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
  'price_1QzkchJrIw0vuTAiUnZCjpwM': 10000,  // Test product - 10,000 credits
};

export async function POST(req: NextRequest) {
  try {
    // Get user auth info using currentUser instead of auth
    const user = await currentUser();
    const userId = user?.id;
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse the request body
    const { priceId } = await req.json();
    
    if (!priceId) {
      return NextResponse.json({ error: 'Price ID is required' }, { status: 400 });
    }

    // Verify price ID exists in our pricing map
    if (!PRICE_CREDITS_MAP[priceId]) {
      return NextResponse.json({ 
        error: 'Invalid price ID. Please check your Stripe configuration.' 
      }, { status: 400 });
    }

    // Connect to the database
    await dbConnect();

    // Find the user
    const userModel = await User.findOne({ clerkId: userId });
    
    if (!userModel) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Create a Stripe customer if one doesn't exist
    if (!userModel.stripeCustomerId) {
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
    }

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
      metadata: {
        userId: userModel._id.toString(),
        clerkId: userModel.clerkId,
        credits: PRICE_CREDITS_MAP[priceId] || 0,
      },
    });

    return NextResponse.json({ sessionId: session.id });
  } catch (error) {
    console.error('Stripe checkout session error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
} 