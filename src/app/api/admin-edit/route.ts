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

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function compactDecisions(decisions: TripDecision[]) {
  return decisions.map((decision) => ({
    id: decision.id,
    title: decision.title,
    description: decision.description,
    dateLabel: decision.dateLabel,
    timeLabel: decision.timeLabel,
    status: decision.status,
    options: decision.options.map((option) => ({
      id: option.id,
      title: option.title,
      description: option.description,
      category: option.category,
      url: option.url || "",
      mapsUrl: option.mapsUrl || "",
      suggestedBy: option.suggestedBy,
      votes: option.votes,
      voteCount: option.votes.length,
    })),
  }));
}

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "needsClarification", "clarificationQuestion", "operations"],
  properties: {
    summary: {
      type: "string",
      description: "A short human-readable summary of the proposed board edit.",
    },
    needsClarification: {
      type: "boolean",
      description: "True if the command is too unclear to safely edit the voting board.",
    },
    clarificationQuestion: {
      type: "string",
      description: "A clear question to ask if clarification is needed. Empty string otherwise.",
    },
    operations: {
      type: "array",
      description: "Safe edit operations to apply after preview confirmation.",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "type",
          "decisionId",
          "optionId",
          "title",
          "description",
          "category",
          "url",
          "mapsUrl",
          "suggestedBy",
        ],
        properties: {
          type: {
            type: "string",
            enum: ["add_option", "update_option", "delete_option", "lock_decision", "unlock_decision"],
          },
          decisionId: {
            type: ["string", "null"],
            description: "Existing decision id. Required unless clarification is needed.",
          },
          optionId: {
            type: ["string", "null"],
            description: "Existing option id for update or delete. Null for add, lock, or unlock.",
          },
          title: {
            type: ["string", "null"],
            description: "Option title for add or update. Null if unchanged or not applicable.",
          },
          description: {
            type: ["string", "null"],
            description: "Option description for add or update. Empty string is allowed.",
          },
          category: {
            type: ["string", "null"],
            enum: ["food", "bar", "club", "live music", "activity", "other", null],
            description: "Option category for add or update. Null if unchanged or not applicable.",
          },
          url: {
            type: ["string", "null"],
            description: "Website, event, Instagram, or ticket URL copied exactly from the command. Null if none.",
          },
          mapsUrl: {
            type: ["string", "null"],
            description: "Google Maps URL copied exactly from the command. Null if none.",
          },
          suggestedBy: {
            type: ["string", "null"],
            description: "Name of the suggester. Use currentUser when adding unless the command names someone else.",
          },
        },
      },
    },
  },
};

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY on the server." },
        { status: 500 }
      );
    }

    const body = await request.json();
    const command = String(body.command || "").trim();
    const currentUser = String(body.currentUser || "Friend").trim() || "Friend";
    const decisions = body.decisions as TripDecision[] | undefined;

    if (!command) {
      return NextResponse.json({ error: "Command is required." }, { status: 400 });
    }

    if (!Array.isArray(decisions)) {
      return NextResponse.json({ error: "Decision context is missing." }, { status: 400 });
    }

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5-mini",
      instructions: `
You are the edit planner for a shared Cali weekend voting board.

Return JSON only using the provided schema. You are not directly editing data. You are creating a preview plan that the app will validate and apply.

Current user: ${currentUser}
Super admin by name: Will

Trip dates:
- Thursday June 11, 2026: arrival, dinner, night.
- Friday June 12, 2026: dinner, night.
- Saturday June 13, 2026: daytime, dinner, night.
- Sunday June 14, 2026: brunch/recovery and flight home.

Decision mapping rules:
- "dinner" means a dinner decision, not the top of the day.
- "brunch" or "recovery" means Sunday brunch / recovery unless another day is explicit.
- "Friday night", "Friday evening", "go out Friday", and "club Friday" mean Friday night.
- "Saturday day", "Saturday afternoon", and "daytime Saturday" mean Saturday daytime.
- "Saturday night" means Saturday night.
- "arrival dinner", "Thursday dinner", or "first dinner" means Thursday arrival dinner.
- "Thursday night" or "first night" means Thursday night.
- Preserve the intended meal/time ordering by choosing the matching decisionId.
- Never put dinner into daytime or night unless the user explicitly says after dinner or nightlife.

Edit rules:
- Anyone can add options.
- Use add_option when the user says add, include, consider, put, or suggests a new place/event.
- Use update_option only when the user clearly refers to an existing option.
- Use delete_option only when the user clearly asks to remove/delete an existing option.
- Use lock_decision/unlock_decision only when clearly asked.
- Do not create new decisions. Use the existing decision ids only.
- If multiple existing options could match an update/delete, ask for clarification instead of guessing.
- If a URL is provided, copy it exactly. If it is a Google Maps URL, put it in mapsUrl. Other URLs go in url.
- Never invent URLs, addresses, ratings, hours, prices, ticket status, or event availability.
- Set suggestedBy to the named person in the command, otherwise use currentUser.
- If adding an option, choose the best category from food, bar, club, live music, activity, other.
- Keep descriptions short and useful. If the user gave no description, infer a simple one from the title and decision context without inventing factual details.
- The app will enforce permissions. Still, avoid proposing delete/update for another person's option unless the current user is Will or the command is clearly a request to edit their own option.
- If the target decision cannot be inferred, set needsClarification true and return no operations.
      `.trim(),
      input: JSON.stringify({
        command,
        currentUser,
        decisions: compactDecisions(decisions),
      }),
      text: {
        format: {
          type: "json_schema",
          name: "cali_voting_edit_plan",
          schema,
          strict: true,
        },
      },
    });

    const raw = response.output_text || "";
    const parsed = JSON.parse(raw);

    return NextResponse.json(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}