import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type RequestBody = {
  question?: string;
  decisions?: unknown;
  tripDetails?: unknown;
};

function getModelName() {
  return process.env.OPENAI_MODEL || "gpt-5-mini";
}

function getTripContext(body: RequestBody) {
  return JSON.stringify(
    {
      tripDetails: body.tripDetails ?? null,
      decisions: body.decisions ?? [],
    },
    null,
    2
  );
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "Trip Q&A API is running. Use POST to ask a question.",
  });
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error: "OPENAI_API_KEY is missing in the server environment.",
        },
        { status: 500 }
      );
    }

    const body = (await request.json()) as RequestBody;
    const question = body.question?.trim();

    if (!question) {
      return NextResponse.json(
        {
          error: "Missing question.",
        },
        { status: 400 }
      );
    }

    const tripContext = getTripContext(body);

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: getModelName(),
        input: [
          {
            role: "system",
            content:
              "You are answering questions about a small group Cali weekend trip planning board. Use only the provided trip data. Be practical, concise, and friendly. If something is missing or undecided, say so clearly. Do not invent reservations, confirmations, or facts that are not in the data.",
          },
          {
            role: "user",
            content: `Trip data:\n${tripContext}\n\nQuestion:\n${question}`,
          },
        ],
      }),
    });

    const rawText = await response.text();

    if (!response.ok) {
      let message = rawText;

      try {
        const parsed = JSON.parse(rawText) as { error?: { message?: string } };
        message = parsed.error?.message || rawText;
      } catch {
        // Keep raw text.
      }

      return NextResponse.json(
        {
          error: `OpenAI request failed: ${message}`,
        },
        { status: response.status }
      );
    }

    let parsedResponse: unknown;

    try {
      parsedResponse = JSON.parse(rawText);
    } catch {
      return NextResponse.json(
        {
          error: "OpenAI returned a non-JSON response.",
        },
        { status: 502 }
      );
    }

    const answer = extractResponseText(parsedResponse);

    return NextResponse.json({
      answer: answer || "I could not generate an answer from the current trip data.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Trip Q&A error.";

    return NextResponse.json(
      {
        error: message,
      },
      { status: 500 }
    );
  }
}

function extractResponseText(value: unknown) {
  if (!value || typeof value !== "object") return "";

  const response = value as {
    output_text?: string;
    output?: Array<{
      content?: Array<{
        type?: string;
        text?: string;
      }>;
    }>;
  };

  if (typeof response.output_text === "string" && response.output_text.trim()) {
    return response.output_text.trim();
  }

  const outputText =
    response.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text)
      .filter((text): text is string => typeof text === "string")
      .join("\n")
      .trim() || "";

  return outputText;
}