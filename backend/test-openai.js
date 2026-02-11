require("dotenv").config();
const OpenAI = require("openai");

async function test() {
  try {
    console.log("API Key cargada:", process.env.OPENAI_API_KEY ? "Sí" : "No");

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "user", content: "Di solo: funciona correctamente" }
      ],
    });

    console.log("Respuesta:");
    console.log(response.choices[0].message.content);

  } catch (error) {
    console.error("Error:", error.message);
  }
}

test();
