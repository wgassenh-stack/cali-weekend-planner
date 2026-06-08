import OpenAI from "openai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type DecisionStatus = "Open" | "Locked";

type OptionCategory =
  | "food"
  | "bar"
  | "club"
  | "live music"
  | "activity"
  | "other";

type TripOption = {
  id: string;
  title: string;
  description: string;
  category: OptionCategory;
  url?: string;
  mapsUrl?: string;
  suggestedBy: string;
  votes: string[];
};

type TripDecision = {
  id: string;
  title: string;
  description: string;
  dateLabel: string;
  timeLabel: string;
  status: DecisionStatus;
  options: TripOption[];
};

type TripDetails = {
  title: string;
  subtitle: string;
  dates: string;
  apartmentAddress: string;
  photosUrl: string;
  attendees: string[];
  flights: {
    title: string;
    date: string;
    airline: string;
    flightNumber: string;
    departTime: string;
    departCity: string;
    departAirport: string;
    arriveTime: string;
    arriveCity: string;
    arriveAirport: string;
  }[];
};

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function compactDecisions(decisions: TripDecision[]) {
  return decisions.map((decision) => ({
    title: decision.title,
    dateLabel: decision.dateLabel,
    timeLabel: decision.timeLabel,
    status: decision.status,
    options: decision.options
      .map((option) => ({
        title: option.title,
        description: option.description,
        category: option.category,
        suggestedBy: option.suggestedBy,
        votes: option.votes,
        voteCount: option.votes.length,
        url: option.url || "",
        mapsUrl: option.mapsUrl || "",
      }))
      .sort((a, b) => b.voteCount - a.voteCount || a.title.localeCompare(b.title)),
  }));
}

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY on the server." },
        { status: 500 }
      );
    }

    const body = await request.json();
    const question = String(body.question || "").trim();
    const decisions = body.decisions as TripDecision[] | undefined;
    const tripDetails = body.tripDetails as TripDetails | undefined;

    if (!question) {
      return NextResponse.json({ error: "Question is required." }, { status: 400 });
    }

    if (!Array.isArray(decisions) || !tripDetails) {
      return NextResponse.json({ error: "Trip context is missing." }, { status: 400 });
    }

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5-mini",
      instructions: `
You answer questions for a small shared Cali weekend voting planner.

Rules:
- Answer from the provided trip details, flights, apartment address, attendees, decisions, options, and votes.
- Be casual, useful, and concise.
- If asked what is winning, calculate from vote counts and mention ties clearly.
- If no one has voted on something, say it is still pending.
- Do not claim live restaurant hours, current event availability, traffic, pricing, flight status, or Google Maps data.
- Do not edit the board from this endpoint. If the user wants to add or change options, tell them to use the AI edit box or the Add an option button.
- Keep answers under 160 words unless the user asks for more detail.
      `.trim(),
      input: JSON.stringify({
        question,
        tripDetails,
        decisions: compactDecisions(decisions),
      }),
    });

    return NextResponse.json({
      answer: response.output_text || "I could not generate an answer.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}