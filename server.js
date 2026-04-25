require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const Stripe = require('stripe');

const app = express();
const PORT = process.env.PORT || 10000;

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripePublishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

const REVIEWS_FILE = path.join(__dirname, 'reviews.json');

function getEmailTransporter() {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    return null;
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD
    }
  });
}

async function sendOrderNotification(session) {
  const transporter = getEmailTransporter();

  if (!transporter) {
    console.log('Email transporter not configured.');
    return;
  }

  const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
    limit: 100
  });

  const itemsText = lineItems.data.map((item) => {
    return `- ${item.description} x ${item.quantity} — $${(item.amount_total / 100).toFixed(2)}`;
  }).join('\n');

  const customerEmail =
    session.customer_details?.email ||
    session.customer_email ||
    'No customer email found';

  const customerName =
    session.customer_details?.name ||
    'No customer name found';

  const shipping = session.customer_details?.address;
  const addressText = shipping
    ? `${shipping.line1 || ''} ${shipping.line2 || ''}
${shipping.city || ''}, ${shipping.state || ''} ${shipping.postal_code || ''}
${shipping.country || ''}`
    : 'No address collected';

  await transporter.sendMail({
    from: process.env.GMAIL_USER,
    to: 'trulyblissful7@gmail.com',
    subject: 'NEW TRULY BLISSFUL ORDER',
    text:
`NEW ORDER RECEIVED

Order ID:
${session.id}

Customer:
${customerName}

Customer Email:
${customerEmail}

Order Total:
$${(session.amount_total / 100).toFixed(2)}

Items:
${itemsText}

Customer Address:
${addressText}

Stripe Payment Status:
${session.payment_status}

Open Stripe Dashboard to view full order details.`
  });
}

function ensureReviewsFile() {
  if (!fs.existsSync(REVIEWS_FILE)) {
    const defaultReviews = [
      {
        name: 'Verified Customer',
        rating: 5,
        text: 'Quality is crazy. Shirt fits perfect and message hits different.'
      },
      {
        name: 'Verified Customer',
        rating: 5,
        text: 'Fast shipping and premium feel. Definitely ordering again.'
      },
      {
        name: 'Verified Customer',
        rating: 5,
        text: 'This brand stands for something real. Respect.'
      }
    ];

    fs.writeFileSync(REVIEWS_FILE, JSON.stringify(defaultReviews, null, 2));
  }
}

function readReviews() {
  ensureReviewsFile();
  const raw = fs.readFileSync(REVIEWS_FILE, 'utf8');
  return JSON.parse(raw);
}

function writeReviews(reviews) {
  fs.writeFileSync(REVIEWS_FILE, JSON.stringify(reviews, null, 2));
}

/*
  IMPORTANT:
  Stripe webhook must use express.raw BEFORE express.json.
*/
app.post('/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe || !stripeWebhookSecret) {
    return res.status(500).send('Stripe webhook is not configured.');
  }

  const signature = req.headers['stripe-signature'];

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, signature, stripeWebhookSecret);
  } catch (error) {
    console.error('Webhook signature verification failed:', error.message);
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;

      if (session.payment_status === 'paid') {
        await sendOrderNotification(session);
        console.log(`Order notification sent for session ${session.id}`);
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook handling error:', error);
    res.status(500).send('Webhook handler failed.');
  }
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/config', (req, res) => {
  res.json({
    publishableKey: stripePublishableKey || ''
  });
});

app.get('/reviews', (req, res) => {
  try {
    const reviews = readReviews();
    res.json(reviews);
  } catch (error) {
    console.error('Read reviews error:', error);
    res.status(500).json({ error: 'Failed to load reviews.' });
  }
});

app.post('/reviews', async (req, res) => {
  try {
    const { name, rating, text } = req.body;

    if (!name || !text) {
      return res.status(400).json({ error: 'Name and review are required.' });
    }

    const parsedRating = Number(rating);

    if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5.' });
    }

    const reviews = readReviews();

    const newReview = {
      name: String(name).trim(),
      rating: parsedRating,
      text: String(text).trim()
    };

    reviews.unshift(newReview);
    writeReviews(reviews);

// 🔥 SEND EMAIL NOTIFICATION
const transporter = getEmailTransporter();

if (transporter) {
  try {
    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: 'trulyblissful7@gmail.com',
      subject: 'NEW REVIEW RECEIVED',
      text: `
NEW REVIEW RECEIVED

Name: ${newReview.name}
Rating: ${newReview.rating}
Review: ${newReview.text}
      `
    });
  } catch (emailError) {
    console.error('Review email error:', emailError);
  }
}

    res.json({ success: true, reviews });

  } catch (error) {
    console.error('Save review error:', error);
    res.status(500).json({ error: 'Failed to save review.' });
  }
});

app.post('/contact', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({
        error: 'Name, email, and message are required.'
      });
    }

    const transporter = getEmailTransporter();

    if (!transporter) {
      return res.status(500).json({
        error: 'Email service is not configured yet.'
      });
    }

   await transporter.sendMail({
  from: process.env.GMAIL_USER,
  to: 'trulyblissful7@gmail.com',
  subject: 'NEW REVIEW RECEIVED',
  text: `
NEW REVIEW RECEIVED

Name: ${newReview.name}
Rating: ${newReview.rating}
Review: ${newReview.text}
  `
});

    res.json({ success: true });
  } catch (error) {
    console.error('Contact form error:', error);
    res.status(500).json({ error: 'Failed to send message.' });
  }
});

app.post('/create-checkout-session', async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ error: 'Stripe is not configured.' });
    }

    const { cart } = req.body;

    if (!Array.isArray(cart) || cart.length === 0) {
      return res.status(400).json({ error: 'Cart is empty.' });
    }

    const lineItems = cart.map((item) => {
      const unitAmount = Math.round(Number(item.price) * 100);
      const qty = Math.max(1, Number(item.qty) || 1);

      return {
        price_data: {
          currency: 'usd',
          product_data: {
            name: item.name,
            description: `${item.size || 'Standard'} / ${item.color || 'Standard'}`
          },
          unit_amount: unitAmount
        },
        quantity: qty
      };
    });

    const baseUrl = `${req.protocol}://${req.get('host')}`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: lineItems,
      success_url: `${baseUrl}/success.html`,
      cancel_url: `${baseUrl}/cancel.html`,
      billing_address_collection: 'auto',
      shipping_address_collection: {
        allowed_countries: ['US']
      }
    });

    res.json({ id: session.id });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    res.status(500).json({ error: error.message || 'Checkout failed.' });
  }
});

app.listen(PORT, () => {
  ensureReviewsFile();
  console.log(`Server running on port ${PORT}`);
});
