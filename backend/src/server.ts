import express from "express";
import type { Request, Response } from "express";
import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";
import OpenAI from "openai";

dotenv.config();
const app = express();
app.use(cors());
app.use(bodyParser.json());

// ---------------------
// TypeScript interface
// ---------------------
interface GenerateRequestBody {
  code: string;
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// ---------------------
// Helper: Call FastAPI PolyCoder+ service
// ---------------------
async function callPolyCoder(code: string): Promise<string> {
  try {
    console.log("➡️ Sending code to FastAPI PolyCoder service...");
    const response = await axios.post("http://127.0.0.1:8001/generate", { code });
    console.log("✅ Received response from FastAPI:", response.data);
    return response.data.technical ?? "";
  } catch (err: any) {
    console.error("❌ Error calling PolyCoder FastAPI:", err.message);
    return "";
  }
}

// ---------------------
// Helper: OpenAI plain English draft
// ---------------------
async function openAIPlainExplain(code: string): Promise<string> {
  const prompt = `Explain the following code in plain English for a non-technical person:\n\n${code}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You are a helpful assistant that explains code in simple English." },
      { role: "user", content: prompt },
    ],
    temperature: 0.2,
    max_tokens: 600,
  });

  return completion.choices?.[0]?.message?.content?.trim() ?? "";
}

// ---------------------
// Helper: Compare drafts and rewrite professional
// ---------------------
async function openAICompareAndRewrite(polycoder: string, openAIDoc: string) {
  console.log("Comparing drafts:\nPolyCoder:", polycoder);
  const prompt = `
Compare two documentation drafts:

[Draft A - PolyCoder+]
${polycoder}

[Draft B - OpenAI]
${openAIDoc}

Decide which one is clearer, more correct, and more detailed.
Then rewrite the best one in professional English. Also add the brief concept of the technology to give some background knowledge to a non-technical person.
Don't write anything about Draft A or Draft B in the final output. Write technical summary in technical key.
Return JSON with keys: "technical", "professional". 
`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.0,
    max_tokens: 800,
  });

  const text = response.choices?.[0]?.message?.content?.trim() || "";

  let parsed: any = {};
  try {
    // Strip code fences if present
    const cleaned = text.replace(/^```json/, "").replace(/```$/, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    parsed = {};
  }
console.log("Parsed comparison output:", parsed.technical);
  return {
    technical: parsed.technical || "",
    professional: parsed.professional ?? parsed.proof ?? "",
  };
}

// ---------------------
// Route: Generate documentation
// ---------------------
app.post(
  "/api/generate",
  async (req: Request<{}, {}, GenerateRequestBody>, res: Response) => {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: "No code provided" });

    try {
      // Step 1: Call FastAPI Polycoder technical draft
      const polycoder = await callPolyCoder(code);

      // Step 2: OpenAI plain English draft
      const openAIDoc = await openAIPlainExplain(code);

      // Step 3: Compare drafts and rewrite professional
      const finalDoc = await openAICompareAndRewrite(polycoder, openAIDoc);
        console.log("Final documentation generated.", finalDoc.technical);
      return res.json({
        technical: finalDoc.technical,
        professional: finalDoc.professional,
      });
    } catch (err: any) {
      console.error("Error generating documentation:", err);
      return res.status(500).json({ error: err.message });
    }
  }
);

// ---------------------
// Start server
// ---------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Backend running on port ${PORT}`);
});
