require("dotenv").config();

const express = require("express");
const path = require("path");
const Stripe = require("stripe");

const app = express();
const PORT = process.env.PORT || 4242;

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripePublishableKey = process.env.STRIPE_PUBLISHABLE_KEY;

if (!stripeSecretKey) {
  throw new Error("Missing STRIPE_SECRET_KEY environment variable.");
}

const stripe = new Stripe(stripeSecretKey);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/config", (req, res) => {
  res.json({ publishableKey: stripePublishableKey || "" });
});

app.post("/create-checkout-session", async (req, res) => {
  try {
    const { cart } = req.body;

    if (!Array.isArray(cart) || cart.length === 0) {
      return res.status(400).json({ error: "Cart is empty." });
    }

    const lineItems = cart.map((item) => {
      const unitAmount = Math.round(Number(item.price) * 100);

      if (!item.name || !Number.isFinite(unitAmount) || unitAmount <= 0) {
        throw new Error("Invalid cart item.");
      }

      const details = [item.size, item.color].filter(Boolean).join(" • ");

      return {
        price_data: {
          currency: "usd",
          product_data: {
            name: item.name,
            description: details || undefined,
          },
          unit_amount: unitAmount,
        },
        quantity: 1,
      };
    });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: lineItems,
      success_url: `http://localhost:${PORT}/success.html`,
      cancel_url: `http://localhost:${PORT}/cancel.html`,
      shipping_address_collection: {
        allowed_countries: ["US", "CA"],
      },
      billing_address_collection: "required",
      phone_number_collection: {
        enabled: true,
      },
    });

    res.json({ id: session.id, url: session.url });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    res.status(500).json({ error: error.message || "Unable to create checkout session." });
  }
});

app.listen(PORT, () => {
  console.log(`TRULY BLISSFUL backend running at http://localhost:${PORT}`);
});
