import dotenv from "dotenv";
import Groq from "groq-sdk";

dotenv.config({ path: ".env.example" });

console.log("API KEY:", process.env.GROQ_API_KEY); // ✅ correct place

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

async function listModels() {
  try {
    const models = await groq.models.list();
    console.log(models);
  } catch (err) {
    console.error(err);
  }
}

listModels();