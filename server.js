 require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const Stripe = require('stripe');
const { MongoClient, ObjectId } = require('mongodb');
const app = express();
const PORT = process.env.PORT || 10000;

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripePublishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

const REVIEWS_FILE = path.join(__dirname, 'reviews.json');
const PRODUCTS_FILE = path.join(__dirname, 'products.json');
const mongoClient = new MongoClient(process.env.MONGO_URI);
let productsCollection;

async function connectMongo() {
  await mongoClient.connect();
  const database = mongoClient.db('store');
  productsCollection = database.collection('products');
  console.log('MongoDB connected');
}

connectMongo();
function getEmailTransporter() {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    return null;
  }
app.get('/products', async (req, res) => {
  try {
    const products = await productsCollection.find().toArray();
    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load products' });
  }
});

/* ---------------- REVIEWS ---------------- */

function ensureReviewsFile() {
  if (!fs.existsSync(REVIEWS_FILE)) {
    const defaultReviews = [
      {
        name: 'Verified Customer',
        rating: 5,
        text: 'Quality is crazy. Shirt fits perfect.'
      }
    ];

    fs.writeFileSync(REVIEWS_FILE, JSON.stringify(defaultReviews, null, 2));
  }
}

function readReviews() {
  ensureReviewsFile();
  return JSON.parse(fs.readFileSync(REVIEWS_FILE, 'utf8'));
}

function writeReviews(reviews) {
  fs.writeFileSync(REVIEWS_FILE, JSON.stringify(reviews, null, 2));
}

app.get('/reviews', (req, res) => {
  try {
    const reviews = readReviews();
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load reviews.' });
  }
});

/* ---------------- BASIC ROUTES ---------------- */

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

/* ---------------- STRIPE ---------------- */

app.post('/create-checkout-session', async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ error: 'Stripe not configured' });
    }

    const { cart } = req.body;

    const lineItems = cart.map(item => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: item.name
        },
        unit_amount: Math.round(item.price * 100)
      },
      quantity: item.qty || 1
    }));

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: lineItems,
      success_url: `${req.protocol}://${req.get('host')}/success.html`,
      cancel_url: `${req.protocol}://${req.get('host')}/cancel.html`
    });

    res.json({ id: session.id });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Checkout failed' });
  }
});
function requireAdmin(req, res, next) {
  const auth = req.headers.authorization;

  if (!auth) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin Area"');
    return res.status(401).send('Login required');
  }

  const encoded = auth.split(' ')[1];
  const decoded = Buffer.from(encoded, 'base64').toString();
  const [username, password] = decoded.split(':');

  if (username === 'admin' && password === process.env.ADMIN_PASSWORD) {
    return next();
  }

  res.setHeader('WWW-Authenticate', 'Basic realm="Admin Area"');
  return res.status(401).send('Access denied');
}
/* ---------------- START SERVER ---------------- */
app.post('/add-product', requireAdmin, async (req, res) => {
  try {
    const { name, price, image } = req.body;

    await productsCollection.insertOne({
      name,
      price: Number(price),
      image
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add product' });
  }
  });
app.delete('/delete-product/:id', requireAdmin, async (req, res) => {
  try {
    await productsCollection.deleteOne({
      _id: new ObjectId(req.params.id)
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});
app.listen(PORT, () => {
  ensureReviewsFile();
  console.log(`Server running on port ${PORT}`);
});