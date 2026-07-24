import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const response = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [
    { role: "system", content: "You are a helpful AI assistant." },
    { role: "user", content: "Explain AI in simple words" }
  ],
});

console.log(response.choices[0].message.content);
