const express = require("express");
const router = express.Router();
const otpGenerator = require("otp-generator");
const { v4: uuidv4 } = require("uuid");  
const twilio = require("twilio");
require("dotenv").config();
const { Otp, VerifiedUser } = require("../models/Otp");
const User = require("../models/User");


const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

router.post('/send-alert', async (req, res) => {
    const { message, location, timestamp } = req.body; // Destructure the message and location
  
    if (!location || !location.latitude || !location.longitude) {
      return res.status(400).json({ error: 'Location data is missing' });
    }
  
    const { latitude, longitude } = location; // Extract latitude and longitude
    console.log('📍 Location:', { latitude, longitude });
  
    const messageToSend = `🚨 Fall Detected!\nLocation: https://maps.google.com/?q=${latitude},${longitude}`;
    console.log('📡 Sending message:', messageToSend);
  
    try {
      const twilioRes = await client.messages.create({
        body: messageToSend,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: '+91 9342046071',
      });
  
      console.log('✅ SMS sent:', twilioRes.sid);
      res.status(200).json({ success: true });
    } catch (err) {
      console.error('❌ SMS send error:', err);
      res.status(500).json({ error: 'Failed to send SMS' });
    }
  });
  
router.post("/generate", async (req, res) => {
    const { mobile, type } = req.body;
    console.log("Received request:", mobile, type);

    if (!mobile) {
        return res.status(400).json({ error: "Mobile number is required!" });
    }

    if (!["sms", "voice"].includes(type)) {
        return res.status(400).json({ error: "Invalid type! Use 'sms' or 'voice'." });
    }

    try {
        // ✅ Check if user is already registered
        const existingUser = await VerifiedUser.findOne({ mobile });

        if (existingUser) {
            return res.status(200).json({ 
                message: "User already registered!", 
                isRegistered: true 
            });
        }

        // ✅ Generate OTP if not registered
        const otp = otpGenerator.generate(6, {
            digits: true,
            upperCaseAlphabets: false,
            lowerCaseAlphabets: false,
            specialChars: false
        });

        await Otp.findOneAndUpdate(
            { mobile },
            { otp, createdAt: new Date() },
            { upsert: true, new: true }
        );

        console.log(`Generated OTP: ${otp}`);

        // ✅ Return the OTP (for testing)
        res.status(200).json({ 
            message: `OTP generated successfully via ${type}!`, 
            otp,  
            isRegistered: false
        });

        if (type === "sms") {
            client.messages.create({
                body: `Your OTP code is: ${otp}`,
                from: process.env.TWILIO_PHONE_NUMBER,
                to: mobile
            }).then(() => console.log(`OTP SMS sent to ${mobile}`))
              .catch(err => console.error("Error sending SMS OTP:", err));
        } else if (type === "voice") {
            client.calls.create({
                twiml: `<Response><Say voice="alice">Your OTP code is ${otp}. Please enter it to verify.</Say></Response>`,
                from: process.env.TWILIO_PHONE_NUMBER,
                to: mobile
            }).then(() => console.log(`OTP Voice Call sent to ${mobile}`))
              .catch(err => console.error("Error sending voice OTP:", err));
        }

    } catch (error) {
        console.error("Error in OTP generation:", error);
        res.status(500).json({ error: "Error generating OTP", details: error.message });
    }
});






//  Verify OTP
//  Verify OTP
router.post("/verify", async (req, res) => {
    console.log("Received request body:", req.body);  //  Log the entire request body

    const { mobile, otp } = req.body;

    if (!mobile || !otp) {
        console.log("Missing Fields:", { mobile, otp });  // Log missing fields
        return res.status(400).json({ error: "Mobile and OTP are required!" });
    }

    try {
        const validOtp = await Otp.findOneAndDelete({
            mobile, 
            otp, 
            createdAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) }
        });

        if (!validOtp) {
            return res.status(400).json({ error: "Invalid or expired OTP!" });
        }

        const uvid = uuidv4();
        const verifiedUser = new VerifiedUser({ mobile, uvid });
        await verifiedUser.save();

        res.status(200).json({ message: "OTP verified successfully!", uvid });

    } catch (error) {
        console.error("Error in OTP verification:", error);
        res.status(500).json({ error: "Verification failed", details: error.message });
    }
});



router.post("/check-user", async (req, res) => {
    let { mobile } = req.body;
console.log("Received request with mobile:", mobile);

if (!mobile) {
    console.log("No mobile number provided in the request body.");
    return res.status(400).json({ error: "Mobile number is required!" });
}

try {
    console.log("Checking if user exists with mobile:", mobile);
    const user = await VerifiedUser.findOne({ mobile });

    if (user) {
        console.log("User found:", user);
    } else {
        console.log("No user found with mobile:", mobile);
    }

    res.json({ isRegistered: !!user });
} catch (error) {
    console.error("Error checking user:", error);
    res.status(500).json({ error: "Internal Server Error" });
}

});


module.exports = router;
