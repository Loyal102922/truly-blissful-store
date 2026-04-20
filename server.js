const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());

// ✅ Serve all files from public folder
app.use(express.static(path.join(__dirname, 'public')));

// Homepage
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Stripe config (keep your real key if you had one)
app.get('/config', (req, res) => {
  res.json({ publishableKey: 'pk_test_replace_this' });
});

// Checkout (temporary simple response)
app.post('/create-checkout-session', (req, res) => {
  res.json({ id: 'test_session' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
