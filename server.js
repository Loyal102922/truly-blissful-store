require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');
const Stripe = require('stripe');
const { MongoClient, ObjectId } = require('mongodb');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const app = express();
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});
const PORT = process.env.PORT || 10000;
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

app.use(express.static(path.join(__dirname, 'public')));
// ───── MULTER (UPLOADS) ─────
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'truly-blissful',
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp']
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }
});

// ───── STRIPE ─────
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripePublishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

// ───── FILES ─────
const REVIEWS_FILE = path.join(__dirname, 'reviews.json');

// ───── MONGO ─────
const mongoClient = new MongoClient(process.env.MONGO_URI);
let productsCollection;
let ordersCollection;
async function connectMongo() {
  await mongoClient.connect();
  const database = mongoClient.db('store');
  productsCollection = database.collection('products');
  ordersCollection = database.collection('orders');
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
app.get('/product/:id', async (req, res) => {
  try {
    const product = await productsCollection.findOne({
      _id: new ObjectId(req.params.id)
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(product);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load product' });
  }
});
app.delete('/products/:id', requireAdmin, async (req, res) => {
  try {
    await productsCollection.deleteOne({
      _id: new ObjectId(req.params.id)
    });

    res.json({ success: true, reviews });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});
// Home
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.get('/reviews', (req, res) => {
  try {
    const reviews = JSON.parse(fs.readFileSync(REVIEWS_FILE, 'utf8'));
    res.json(reviews);
  } catch (err) {
    res.json([]);
  }
});

app.post('/reviews', (req, res) => {
  try {
    const { name, rating, text } = req.body;

    if (!name || !rating || !text) {
      return res.status(400).json({ error: 'Missing review fields' });
    }

    let reviews = [];

    try {
      reviews = JSON.parse(fs.readFileSync(REVIEWS_FILE, 'utf8'));
    } catch (err) {
      reviews = [];
    }

    reviews.unshift({
      name,
      rating,
      text,
      date: new Date().toISOString()
    });

    fs.writeFileSync(REVIEWS_FILE, JSON.stringify(reviews, null, 2));

    res.json({ success: true });
  } catch (err) {
    console.error('Review error:', err);
    res.status(500).json({ error: 'Failed to submit review' });
  }
});
// Config
app.get('/config', (req, res) => {
  res.json({
    publishableKey: stripePublishableKey || ''
  });
});
app.post('/newsletter', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: 'Email is required'
      });
    }

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER,
      subject: 'New TRULY BLISSFUL Newsletter Signup',
      text: `
New newsletter signup:

Email: ${email}
      `
    });

    res.json({
      success: true,
      message: 'Successfully joined newsletter'
    });

  } catch (err) {
    console.error('Newsletter error:', err);

    res.status(500).json({
      error: 'Failed to join newsletter'
    });
  }
});
app.post('/contact', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({
        error: 'Missing required fields'
      });
    }

   await transporter.sendMail({
  from: process.env.EMAIL_USER,
  to: process.env.EMAIL_USER,
  subject: `TRULY BLISSFUL Contact: ${subject || 'New Message'}`,
  text: `
Name: ${name}

Email: ${email}

Subject: ${subject}

Message:
${message}
`
});

res.json({
  success: true,
  message: 'Message sent successfully'
});

  } catch (err) {
    console.error('Contact form error:', err);

    res.status(500).json({
      error: 'Failed to send message'
    });
  }
});
// ───── CHECKOUT ─────
app.post('/create-checkout-session', async (req, res) => {
  try {
    if (!stripe) return res.status(500).json({ error: 'Stripe not configured' });

    const { cart } = req.body;
    const order = {
  cart,
  status: 'pending',
  total: 0,
  createdAt: new Date()
};
const subtotal = cart.reduce((sum, item) => sum + (item.price * (item.qty || 1)), 0);
order.total = subtotal;
    const lineItems = cart.map(item => ({
      price_data: {
        currency: 'usd',
        product_data: { name: item.name },
        unit_amount: Math.round(item.price * 100)
      },
      quantity: item.qty || 1
    }));
    app.get('/order-details/:sessionId', async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.retrieve(req.params.sessionId, {
    
    });

    const orderId = session.metadata?.orderId;
const order = await ordersCollection.findOne({
  _id: new ObjectId(orderId)
});

if (
  order &&
  session.payment_status === 'paid' &&
  !order.stockUpdated
) {
  for (const item of order.cart) {
    await productsCollection.updateOne(
     { name: item.name },
      { $inc: { stock: -(item.qty || 1) } }
    );
  }

  await ordersCollection.updateOne(
    { _id: new ObjectId(orderId) },
    {
      $set: {
        stockUpdated: true
      }
    }
  );
}
    if (orderId) {
      await ordersCollection.updateOne(
        { _id: new ObjectId(orderId) },
        {
          $set: {
            status: session.payment_status === 'paid' ? 'paid' : 'pending',
            stripeSessionId: session.id,
            customerEmail: session.customer_details?.email || '',
            customerName: session.customer_details?.name || '',
            customerPhone: session.customer_details?.phone || '',
            shippingAddress: session.shipping_details?.address || session.customer_details?.address || {},
            updatedAt: new Date()
          }
        }
      );
    }

    res.json({
      success: true,
      status: session.payment_status,
     customer: {
  ...session.customer_details,
  address: session.shipping_details?.address || session.customer_details?.address || {}
}
    });
  } catch (err) {
    console.error('Order details error:', err);
    res.status(500).json({ error: 'Failed to load order details' });
  }
});
const orderResult = await ordersCollection.insertOne(order);

     const session = await stripe.checkout.sessions.create({
  mode: 'payment',
  payment_method_types: ['card'],

  customer_creation: 'always',
  billing_address_collection: 'required',
  phone_number_collection: {
    enabled: true
  },

  shipping_address_collection: {
    allowed_countries: ['US']
  },

  automatic_tax: { enabled: true },
  line_items: lineItems,

  metadata: {
    orderId: orderResult.insertedId.toString()
  },

  shipping_options: [
    {
      shipping_rate_data: {
        type: 'fixed_amount',
        fixed_amount: { amount: 500, currency: 'usd' },
        display_name: 'Standard Shipping',
        delivery_estimate: {
          minimum: { unit: 'business_day', value: 3 },
          maximum: { unit: 'business_day', value: 7 }
        }
      }
    }
  ],

 success_url: 'https://truly-blissful-store.onrender.com/success.html?session_id={CHECKOUT_SESSION_ID}',
  cancel_url: 'https://truly-blissful-store.onrender.com/cancel.html'
});


    res.json({ id: session.id });

  } catch (err) {
    res.status(500).json({ error: 'Checkout failed' });
  }
});
app.get('/orders', async (req, res) => {
  const orders = await ordersCollection
    .find({})
    .sort({ createdAt: -1 })
    .toArray();

  res.json(orders);
});
app.get('/admin/analytics', async (req, res) => {
  try {
    const orders = await ordersCollection.find({}).toArray();
    const products = await productsCollection.find({}).toArray();

    const totalOrders = orders.length;

    const paidOrders = orders.filter(o =>
      ['paid', 'processing', 'shipped', 'delivered'].includes(o.status)
    );

    const totalRevenue = paidOrders.reduce((sum, order) => {
      return sum + Number(order.total || 0);
    }, 0);

    const statusCounts = {
      paid: orders.filter(o => o.status === 'paid').length,
      processing: orders.filter(o => o.status === 'processing').length,
      shipped: orders.filter(o => o.status === 'shipped').length,
      delivered: orders.filter(o => o.status === 'delivered').length,
    };
   const dailySalesMap = {};

paidOrders.forEach(order => {
  if (!order.createdAt) return;

  const date = new Date(order.createdAt)
    .toISOString()
    .split('T')[0];

  if (!dailySalesMap[date]) {
    dailySalesMap[date] = 0;
  }

  dailySalesMap[date] += Number(order.total || 0);
});

const dailySales = Object.entries(dailySalesMap)
  .map(([date, revenue]) => ({
    date,
    revenue
  }))
  .sort((a, b) => new Date(a.date) - new Date(b.date));

    const productSales = {};

    paidOrders.forEach(order => {
      (order.cart || []).forEach(item => {
        const name = item.name || 'Unknown Product';
        const qty = Number(item.qty || 1);

        if (!productSales[name]) {
          productSales[name] = 0;
        }

        productSales[name] += qty;
      });
    });

    const bestSellingProducts = Object.entries(productSales)
      .map(([name, quantitySold]) => ({ name, quantitySold }))
      .sort((a, b) => b.quantitySold - a.quantitySold)
      .slice(0, 5);

    const lowStockProducts = products
      .filter(p => Number(p.stock || 0) <= 5)
      .map(p => ({
        name: p.name,
        stock: Number(p.stock || 0),
      }))
      .sort((a, b) => a.stock - b.stock);

    res.json({
      totalRevenue,
      totalOrders,
      statusCounts,
      dailySales,
      bestSellingProducts,
      lowStockProducts,
    });
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ error: 'Failed to load analytics' });
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
app.post('/add-product', requireAdmin, upload.array('images', 5), async (req, res) => {
  try {
const { name, price, category, sizes, colors, stock } = req.body;

  const imagePaths = req.files.map(file => file.path);

 await productsCollection.insertOne({
  name,
  price: Number(price),
  stock: Number(stock) || 0,
  category,
  sizes: sizes
    ? sizes.split(',').map(s => s.trim())
    : [],
  colors: colors
    ? colors.split(',').map(c => c.trim())
    : [],
  images: imagePaths
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
app.put('/edit-product/:id', upload.single('image'), async (req, res) => {
  try {
   const { name, price, category, sizes, colors, stock } = req.body;

const updateData = {
  name,
  price: Number(price),
  category,
  sizes,
  colors,
  stock: Number(stock) || 0,
};

  
    
   

    if (req.file) {
      updateData.image = '/uploads/' + req.file.filename;
    }

    await productsCollection.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: updateData }
    );

    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to edit product' });
  }
});
app.put('/admin/orders/:id', async (req, res) => {
  try {
    const { status, trackingNumber } = req.body;

    await ordersCollection.updateOne(
      { _id: new ObjectId(req.params.id) },
      {
        $set: {
          status,
          trackingNumber,
          updatedAt: new Date()
        }
      }
    );
const updatedOrder = await ordersCollection.findOne({
  _id: new ObjectId(req.params.id)
});

if (
  status.toLowerCase() === 'shipped' &&
  updatedOrder.customerEmail
) {
  const invoiceBuffers = [];

const invoiceDoc = new PDFDocument();

invoiceDoc.on('data', invoiceBuffers.push.bind(invoiceBuffers));

invoiceDoc.fontSize(22).text('TRULY BLISSFUL Invoice');

invoiceDoc.moveDown();

invoiceDoc.text(`Order ID: ${updatedOrder._id}`);
invoiceDoc.text(`Status: ${status}`);
invoiceDoc.text(`Tracking: ${trackingNumber || 'Not provided'}`);
invoiceDoc.text(`Total: $${updatedOrder.total || 0}`);

invoiceDoc.end();

await new Promise((resolve) => {
  invoiceDoc.on('end', resolve);
});

const invoicePDF = Buffer.concat(invoiceBuffers);
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: updatedOrder.customerEmail,
    subject: 'Your TRULY BLISSFUL order has shipped!',
   text: `
Your order is on the way!

Status: ${status}

Tracking Number:
${trackingNumber || 'Not provided yet'}

Thank you for shopping with TRULY BLISSFUL.
`,

attachments: [
  {
    filename: `invoice-${updatedOrder._id}.pdf`,
    content: invoicePDF,
    contentType: 'application/pdf'
  }
]
  });
}
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update order' });
  }
});
app.get('/track-order', async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({
        error: 'Email required'
      });
    }

    const order = await ordersCollection.findOne(
      { customerEmail: email },
      { sort: { createdAt: -1 } }
    );

    if (!order) {
      return res.status(404).json({
        error: 'Order not found'
      });
    }

    res.json({ order });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: 'Failed to track order'
    });
  }
});
app.get('/invoice/:id', async (req, res) => {
  try {
    const order = await ordersCollection.findOne({
      _id: new ObjectId(req.params.id)
    });

    if (!order) {
      return res.status(404).send('Order not found');
    }

    const doc = new PDFDocument({ margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename=invoice-${order._id}.pdf`
    );

    doc.pipe(res);

    // BRAND
    doc
      .fontSize(26)
      .fillColor('#f97316')
      .text('TRULY BLISSFUL', {
        align: 'center'
      });

    doc.moveDown();

    doc
      .fontSize(18)
      .fillColor('black')
      .text('Invoice', {
        align: 'center'
      });

    doc.moveDown(2);

    // ORDER INFO
    doc.fontSize(12);

    doc.text(`Order ID: ${order._id}`);
    doc.text(`Status: ${order.status || 'paid'}`);
    doc.text(`Customer: ${order.customerName || 'Customer'}`);
    doc.text(`Email: ${order.customerEmail || ''}`);

    if (order.trackingNumber) {
      doc.text(`Tracking Number: ${order.trackingNumber}`);
    }

    doc.moveDown();

    // ITEMS
    doc.fontSize(16).text('Items');

    doc.moveDown(0.5);

    if (order.items && order.items.length) {
      order.items.forEach((item) => {
        doc
          .fontSize(12)
          .text(
            `${item.name} x ${item.quantity} | Size: ${item.size || 'N/A'} | Color: ${item.color || 'N/A'}`
          );
      });
    }

    doc.moveDown(2);

    // TOTAL
    doc
      .fontSize(18)
      .fillColor('#f97316')
      .text(`Total: $${order.total || 0}`, {
        align: 'right'
      });

    doc.moveDown(2);

    doc
      .fontSize(12)
      .fillColor('gray')
      .text('Thank you for shopping with TRULY BLISSFUL.', {
        align: 'center'
      });

    doc.end();

  } catch (err) {
    console.error(err);
    res.status(500).send('Failed to generate invoice');
  }
});
// ───── START SERVER ─────
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
