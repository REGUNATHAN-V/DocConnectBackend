// const express = require("express");
// const router = express.Router();
// const OpenAI = require("openai");

// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY,
// });



// router.post("/chat", async (req, res) => {
//   try {
//     const { message } = req.body;

//     if (!message) {
//       return res.status(400).json({ error: "Message is required" });
//     }

//     const completion = await openai.chat.completions.create({
//       model: "gpt-4o-mini",
//       messages: [
//         { role: "system", content: "You are a helpful AI assistant." },
//         { role: "user", content: message },
//       ],
//     });

//     res.json({
//       reply: completion.choices[0].message.content,
//     });
//   } catch (error) {
//     console.error("OpenAI Error:", error);
//     res.status(500).json({ error: "AI request failed" });
//   }
// });

// module.exports = router;


const express = require("express");
const router = express.Router();
const axios = require("axios");

router.post("/chat", async (req, res) => {
    console.log("hitting->>>>")
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const response = await axios.post(
      "http://localhost:11434/api/generate",
      {
        model: "llama3",
        prompt: message,
        stream: false
      }
    );

    res.json({
      reply: response.data.response
    });

  } catch (error) {
    console.error("Ollama Error:", error.message);
    res.status(500).json({ error: "AI request failed" });
  }
});

module.exports = router;


// Incoming call
// ⬇
// setRemoteDescription(offer)   ✅
// ⬇
// createAnswer()
// ⬇
// setLocalDescription(answer)
// ⬇
// Apply queued ICE candidates
// ⬇
// onTrack(AudioTrack) fires 🔊
