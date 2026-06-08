import { NextResponse } from "next/server";
import { Resend } from "resend";

type NotifyCommentBody = {
  author?: unknown;
  dayDate?: unknown;
  dayTitle?: unknown;
  activityTitle?: unknown;
  commentText?: unknown;
};

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    const notifyTo = process.env.COMMENT_NOTIFY_TO;
    const notifyFrom = process.env.COMMENT_NOTIFY_FROM;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing RESEND_API_KEY on the server." },
        { status: 500 }
      );
    }

    if (!notifyTo) {
      return NextResponse.json(
        { error: "Missing COMMENT_NOTIFY_TO on the server." },
        { status: 500 }
      );
    }

    if (!notifyFrom) {
      return NextResponse.json(
        { error: "Missing COMMENT_NOTIFY_FROM on the server." },
        { status: 500 }
      );
    }

    const body = (await request.json()) as NotifyCommentBody;
    const author = cleanText(body.author) || "Guest";
    const dayDate = cleanText(body.dayDate);
    const dayTitle = cleanText(body.dayTitle);
    const activityTitle = cleanText(body.activityTitle);
    const commentText = cleanText(body.commentText);

    if (!commentText) {
      return NextResponse.json({ error: "Comment text is required." }, { status: 400 });
    }

    const dayLabel = [dayDate, dayTitle].filter(Boolean).join(" - ") || "Portugal trip";
    const subjectActivity = activityTitle || "Trip comment";
    const subject = `New Portugal Planner comment: ${subjectActivity}`;

    const text = [
      "A new comment was added to the Portugal Family Planner.",
      "",
      `From: ${author}`,
      `Day: ${dayLabel}`,
      `Activity: ${activityTitle || "Not specified"}`,
      "",
      "Comment:",
      commentText,
    ].join("\n");

    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #333333;">
        <h2 style="margin: 0 0 12px;">New Portugal Planner comment</h2>
        <p style="margin: 0 0 16px;">A new comment was added to the Portugal Family Planner.</p>
        <table style="border-collapse: collapse; margin-bottom: 16px;">
          <tr>
            <td style="padding: 4px 12px 4px 0; font-weight: bold;">From</td>
            <td style="padding: 4px 0;">${escapeHtml(author)}</td>
          </tr>
          <tr>
            <td style="padding: 4px 12px 4px 0; font-weight: bold;">Day</td>
            <td style="padding: 4px 0;">${escapeHtml(dayLabel)}</td>
          </tr>
          <tr>
            <td style="padding: 4px 12px 4px 0; font-weight: bold;">Activity</td>
            <td style="padding: 4px 0;">${escapeHtml(activityTitle || "Not specified")}</td>
          </tr>
        </table>
        <div style="padding: 12px 14px; background: #f6f1e8; border-radius: 12px;">
          ${escapeHtml(commentText).replaceAll("\n", "<br />")}
        </div>
      </div>
    `.trim();

    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: notifyFrom,
      to: notifyTo,
      subject,
      text,
      html,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}