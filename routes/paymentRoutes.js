// routes/paymentRoutes.js
const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const razorpay = require("../config/razorpay");

router.post("/createOrder", async (req, res) => {
  try {
    const { amount, currency = "INR", receipt } = req.body;

    console.log("📝 Create Order Request Body:", req.body);

    if (!amount || !receipt) {
      return res.status(400).json({
        success: false,
        message: "Amount and receipt are required.",
      });
    }

    const options = {
      amount: amount * 100, // in paise
      currency,
      receipt,
    };

    const order = await razorpay.orders.create(options);

    console.log("✅ Order Created:", order);

    if (order) {
      // Ensure the order object is properly sent in the response
      return res.status(200).json({ success: true, data: { order } });
    } else {
      return res.status(500).json({ success: false, message: "Order creation failed" });
    }

  } catch (error) {
    console.error("❌ Error Creating Order:", error);
    res.status(500).json({
      success: false,
      message: "Order creation failed",
      error: error.message || error,
    });
  }
});


router.post("/verifyPayment", (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  console.log("razorpay_signature",razorpay_signature);
  console.log("🔐 Verifying Payment...");
  console.log("Order ID:", razorpay_order_id);
  console.log("Payment ID:", razorpay_payment_id);
  console.log("Signature:", razorpay_signature);

  const generatedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");
    console.log("generatedSignature",generatedSignature);

  if (generatedSignature === razorpay_signature) {
    res.status(200).json({ success: true, message: "Payment verified successfully" });
  } else {
    res.status(400).json({ success: false, message: "Invalid signature" });
  }
});

module.exports = router;
