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
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

const DATA_DIR = __dirname;
const REVIEWS_FILE = path.join(DATA_DIR, 'reviews.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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

app.post('/reviews', (req, res) => {
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
      return res.status(400).json({ error: 'Name, email, and message are required.' });
    }

    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      return res.status(500).json({ error: 'Email service is not configured yet.' });
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    });

    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: 'trulyblissful7@gmail.com',
      replyTo: email,
      subject: subject || 'TRULY BLISSFUL Contact Form',
      text:
`New contact form submission

Name: ${name}
Email: ${email}
Subject: ${subject || 'No subject'}

Message:
${message}`
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
      cancel_url: `${baseUrl}/cancel.html`
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
