const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/config', (req, res) => {
  res.json({
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || ''
  });
});

app.post('/create-checkout-session', (req, res) => {
  res.status(500).json({
    error: 'Checkout is temporarily disabled until Stripe backend is restored.'
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
