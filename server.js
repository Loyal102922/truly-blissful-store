require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const Stripe = require('stripe');
const { MongoClient, ObjectId } = require('mongodb');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 10000;
app.use(express.static(path.join(__dirname, 'public')));
// ───── MULTER (UPLOADS) ─────
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage });

// ───── STRIPE ─────
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripePublishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

// ───── FILES ─────
const REVIEWS_FILE = path.join(__dirname, 'reviews.json');

// ───── MONGO ─────
const mongoClient = new MongoClient(process.env.MONGO_URI);
let productsCollection;

async function connectMongo() {
  await mongoClient.connect();
  const database = mongoClient.db('store');
  productsCollection = database.collection('products');
  console.log('MongoDB connected');
}
connectMongo();

// ───── MIDDLEWARE ─────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ───── ROUTES ─────

// Products
app.get('/products', async (req, res) => {
  try {
    const products = await productsCollection.find().toArray();
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load products' });
  }
});

// Home
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Config
app.get('/config', (req, res) => {
  res.json({
    publishableKey: stripePublishableKey || ''
  });
});

// ───── CHECKOUT ─────
app.post('/create-checkout-session', async (req, res) => {
  try {
    if (!stripe) return res.status(500).json({ error: 'Stripe not configured' });

    const { cart } = req.body;

    const lineItems = cart.map(item => ({
      price_data: {
        currency: 'usd',
        product_data: { name: item.name },
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

  } catch (err) {
    res.status(500).json({ error: 'Checkout failed' });
  }
});

// ───── ADMIN AUTH ─────
function requireAdmin(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).send('Login required');

  const [user, pass] = Buffer.from(auth.split(' ')[1], 'base64')
    .toString()
    .split(':');

  if (user === 'admin' && pass === process.env.ADMIN_PASSWORD) return next();

  return res.status(401).send('Access denied');
}

// ───── ADD PRODUCT (FIXED) ─────
app.post('/add-product', requireAdmin, upload.single('image'), async (req, res) => {
  try {
    const { name, price } = req.body;

    const imagePath = '/uploads/' + req.file.filename;

    await productsCollection.insertOne({
      name,
      price: Number(price),
      image: imagePath
    });

    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add product' });
  }
});

// ───── DELETE PRODUCT ─────
app.delete('/delete-product/:id', requireAdmin, async (req, res) => {
  try {
    await productsCollection.deleteOne({
      _id: new ObjectId(req.params.id)
    });

    res.json({ success: true });

  } catch (err) {
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// ───── START SERVER ─────
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});