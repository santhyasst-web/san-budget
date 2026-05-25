import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic()

export async function POST(req: NextRequest) {
  const { question, context } = await req.json()
  if (!question || !context) return NextResponse.json({ error: 'Missing question or context' }, { status: 400 })

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: `You are a personal finance assistant for a budget tracking app. Answer the user's question using ONLY the data provided below. Be concise and specific, using actual numbers from the data.

Formatting rules:
- Use plain bullet points with "•" character (not markdown stars or dashes)
- Use line breaks between points
- Do NOT use **bold** or any markdown formatting
- Keep the total response under 200 words
- If the question can't be answered from the data, say so briefly

--- FINANCIAL DATA ---
${context}
--- END DATA ---

User question: ${question}`,
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  return NextResponse.json({ answer: text })
}
