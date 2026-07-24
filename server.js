require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const { checkAndCreateTables } = require("./config/mysql");
const { initSocket } = require("./socket");

// const path = require("path");


// --- Express Setup ---
const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(cors());

// --- Connect DBs ---
connectDB();
// checkAndCreateTables();

// --- API Routes ---
app.use("/auth", require("./routes/authRoutes"));
app.use("/admin", require("./routes/adminRoutes"));
app.use("/user", require("./routes/userRoutes"));
app.use("/api", require("./routes/labelRoutes"));
app.use("/qr", require("./routes/qrRoutes"));
app.use("/users", require("./routes/reportRoutes"));
app.use("/post", require("./routes/Postroutes"));
app.use("/connections", require("./routes/connectionRoutes"));





// ─────────────────────────────────────────────────────────────────────────────
// app.use("/uploads", express.static(path.join(__dirname, "uploads")));


app.use("/otp", require("./routes/otpRoutes"));
app.use("/user", require("./routes/qrRoutes"));
app.use("/transaction", require("./routes/transactionsRoutes"));
app.use("/razorpay", require("./routes/paymentRoutes"));
app.use("/firebase", require("./routes/firebaseRoutes"));
app.use("/hybridLogin", require("./routes/hybridLogin"));
app.use("/chat", require("./routes/chatRoutes"));
app.use("/verification", require("./routes/verificationRoutes"));
app.use("/group", require("./routes/groupRoutes"));
app.use("/security", require("./routes/securityRoutes"));
app.use("/upload", require("./routes/uploadRoutes"));
app.use("/ai", require("./routes/aiRoutes"));
app.use("/uploads", express.static("uploads"));

// --- Start HTTP Server ---
const server = app.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT}`)
);

// --- Attach WebSocket Server ---
const { wss } = initSocket(server);

module.exports = { server, wss };