require('dotenv').config();

const express = require('express');
const path = require('path');
const Stripe = require('stripe');

const app = express();
const PORT = process.env.PORT || 10000;

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripePublishableKey = process.env.STRIPE_PUBLISHABLE_KEY;

if (!stripeSecretKey) {
  throw new Error('Missing STRIPE_SECRET_KEY environment variable.');
}

const stripe = new Stripe(stripeSecretKey);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/config', (req, res) => {
  res.json({ publishableKey: stripePublishableKey || '' });
});

app.post('/create-checkout-session', async (req, res) => {
  try {
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
  console.log(`Server running on port ${PORT}`);
});