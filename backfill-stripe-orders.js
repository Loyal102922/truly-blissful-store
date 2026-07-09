// ============================================================
// backfill-stripe-orders.js
//
// ONE-TIME SCRIPT -- run manually, not part of the running server.
//
// Pulls past Stripe Checkout Sessions (default: last 35 days) and
// inserts any that are missing from MongoDB's ordersCollection --
// this covers Payment Link sales made before the webhook fix, which
// never made it into the database at the time since the webhook was
// silently failing on every single event.
//
// Safe to run more than once: any session that already has a matching
// order (checked by stripeSessionId) is skipped, never duplicated.
//
// Usage:
//   node backfill-stripe-orders.js
// ============================================================

require('dotenv').config();

const Stripe = require('stripe');
const { MongoClient } = require('mongodb');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const mongoClient = new MongoClient(process.env.MONGO_URI);

// How far back to look. 35 days gives a small buffer past "one month"
// so nothing right on the boundary gets missed.
const DAYS_BACK = 35;

async function reconstructCart(session) {
  // Prefer the full cart if it was attached as metadata (this is what
  // your normal site checkout does since the metadata fix). Falls
  // back to Stripe's own line items for sessions that have none --
  // e.g. a manually created Payment Link.
  if (session.metadata?.cart) {
    try {
      return JSON.parse(session.metadata.cart);
    } catch {
      // fall through to line items below
    }
  }

  try {
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
      limit: 100
    });

    if (lineItems.data.length > 0) {
      return lineItems.data.map(li => ({
        name: li.description || session.metadata?.product || 'Custom Order',
        price: li.quantity ? (li.amount_total / 100) / li.quantity : li.amount_total / 100,
        qty: li.quantity || 1
      }));
    }
  } catch (err) {
    console.error(`Could not fetch line items for ${session.id}:`, err.message);
  }

  // Last resort -- no metadata, no retrievable line items.
  return [{
    name: session.metadata?.product || 'Custom Order',
    price: session.amount_total / 100,
    qty: 1
  }];
}

async function run() {
  await mongoClient.connect();
  const db = mongoClient.db('store');
  const ordersCollection = db.collection('orders');

  const sinceTimestamp = Math.floor(Date.now() / 1000) - (DAYS_BACK * 24 * 60 * 60);

  console.log(`Pulling Stripe Checkout Sessions from the last ${DAYS_BACK} days...`);

  let inserted = 0;
  let skipped = 0;
  let notPaid = 0;
  let startingAfter = undefined;
  let hasMore = true;

  while (hasMore) {
    const page = await stripe.checkout.sessions.list({
      created: { gte: sinceTimestamp },
      limit: 100,
      starting_after: startingAfter
    });

    for (const session of page.data) {
      if (session.payment_status !== 'paid') {
        notPaid++;
        continue;
      }

      const existing = await ordersCollection.findOne({ stripeSessionId: session.id });

      if (existing) {
        skipped++;
        continue;
      }

      const cart = await reconstructCart(session);

      await ordersCollection.insertOne({
        customerName: session.customer_details?.name || 'Custom Order',
        customerEmail: session.customer_details?.email || '',
        customerPhone: session.customer_details?.phone || '',
        shippingAddress: session.customer_details?.address || {},
        stripeSessionId: session.id,
        status: 'paid',
        cart,
        total: session.amount_total / 100,
        orderType: session.metadata?.cart ? 'standard' : 'custom',
        createdAt: new Date(session.created * 1000),
        updatedAt: new Date(),
        backfilled: true
      });

      inserted++;
      console.log(`Inserted order for session ${session.id} -- $${(session.amount_total / 100).toFixed(2)}`);
    }

    hasMore = page.has_more;
    if (hasMore) {
      startingAfter = page.data[page.data.length - 1].id;
    }
  }

  console.log('\n--- Backfill complete ---');
  console.log(`Inserted: ${inserted}`);
  console.log(`Already existed (skipped): ${skipped}`);
  console.log(`Not paid (skipped): ${notPaid}`);

  await mongoClient.close();
  process.exit(0);
}

run().catch(err => {
  console.error('Backfill failed:', err);
  process.exit(1);
});