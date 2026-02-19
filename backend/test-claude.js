require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function test() {
  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 50,
    messages: [{ role: 'user', content: 'Responde solo: funciona' }]
  });
  console.log('✅ Respuesta:', msg.content[0].text);
}

test().catch(err => console.error('❌ Error:', err.message));