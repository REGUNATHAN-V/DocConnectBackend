const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlleware/authmiddleware");

const { generate, lookup, matchcontacts} = require("../controllers/qrControllers");

router.get("/generate", authMiddleware, generate);
router.post("/lookup", authMiddleware, lookup);
router.post("/match-contacts", authMiddleware, matchcontacts);




module.exports = router;
