"use client";

import { createClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
import type { OptionCategory, TripDecision, TripOption } from "./tripData";
import { initialDecisions, optionCategories, tripDetails } from "./tripData";

const TRIP_ID = "cali-weekend-voting-trip";
const STORAGE_KEY = "cali-weekend-voting-planner";
const NAME_STORAGE_KEY = "cali-weekend-display-name";
const SUPER_ADMIN_NAME = "Will";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

type WinnerResult =
  | { kind: "none" }
  | { kind: "winner"; option: TripOption; votes: number }
  | { kind: "tie"; options: TripOption[]; votes: number };

type AiEditOperation = {
  type: "add_option" | "update_option" | "delete_option" | "lock_decision" | "unlock_decision";
  decisionId: string | null;
  optionId: string | null;
  title: string | null;
  description: string | null;
  category: OptionCategory | null;
  url: string | null;
  mapsUrl: string | null;
  suggestedBy: string | null;
};

type AiEditProposal = {
  summary: string;
  needsClarification: boolean;
  clarificationQuestion: string;
  operations: AiEditOperation[];
};

type NewOptionDraft = {
  title: string;
  description: string;
  category: OptionCategory;
  url: string;
  mapsUrl: string;
};

type ApplyResult = {
  appliedCount: number;
  skippedCount: number;
};

type WeatherSlot = {
  hour: number;
  label: string;
  tempF: number | null;
  rainChance: number | null;
  precipitationIn: number | null;
  summary: string;
  icon: string;
};

type WeatherDay = {
  date: string;
  dateLabel: string;
  shortLabel: string;
  highF: number | null;
  lowF: number | null;
  rainChance: number | null;
  precipitationIn: number | null;
  summary: string;
  icon: string;
  slots: {
    morning: WeatherSlot | null;
    brunch: WeatherSlot | null;
    daytime: WeatherSlot | null;
    afternoon: WeatherSlot | null;
    dinner: WeatherSlot | null;
    night: WeatherSlot | null;
  };
};

type WeatherResponse = {
  location: string;
  source: string;
  generatedAt: string;
  days: WeatherDay[];
  error?: string;
};

const dayOrder = ["Thursday, June 11", "Friday, June 12", "Saturday, June 13", "Sunday, June 14"];

const dateLabelToIsoDate: Record<string, string> = {
  "Thursday, June 11": "2026-06-11",
  "Friday, June 12": "2026-06-12",
  "Saturday, June 13": "2026-06-13",
  "Sunday, June 14": "2026-06-14",
};

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function safeParseDecisions(value: string | null): TripDecision[] | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? (parsed as TripDecision[]) : null;
  } catch {
    return null;
  }
}

function cleanName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeName(value: string) {
  return cleanName(value).toLowerCase();
}

function isSuperAdmin(value: string) {
  return normalizeName(value) === normalizeName(SUPER_ADMIN_NAME);
}

function canManageOption(option: TripOption, currentUser: string) {
  return isSuperAdmin(currentUser) || normalizeName(option.suggestedBy) === normalizeName(currentUser);
}

function rankOptions(options: TripOption[]) {
  return [...options].sort((a, b) => {
    const voteDiff = b.votes.length - a.votes.length;
    if (voteDiff !== 0) return voteDiff;
    return a.title.localeCompare(b.title);
  });
}

function getWinner(options: TripOption[]): WinnerResult {
  const withVotes = options.filter((option) => option.votes.length > 0);
  if (withVotes.length === 0) return { kind: "none" };

  const topVotes = Math.max(...withVotes.map((option) => option.votes.length));
  const tied = withVotes.filter((option) => option.votes.length === topVotes);

  if (tied.length > 1) return { kind: "tie", options: tied, votes: topVotes };
  return { kind: "winner", option: tied[0], votes: topVotes };
}

function getSummaryLabel(decision: TripDecision) {
  const winner = getWinner(decision.options);

  if (winner.kind === "none") {
    const firstOption = decision.options[0];
    return firstOption ? firstOption.title : "pending";
  }

  if (winner.kind === "tie") {
    return `Tie: ${winner.options.map((option) => option.title).join(" / ")}`;
  }

  return `${winner.option.title} is winning`;
}

function getApartmentMapsUrl() {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    tripDetails.apartmentAddress
  )}`;
}

function emptyDraft(): NewOptionDraft {
  return {
    title: "",
    description: "",
    category: "other",
    url: "",
    mapsUrl: "",
  };
}

function findOption(decisions: TripDecision[], decisionId: string | null, optionId: string | null) {
  if (!decisionId || !optionId) return null;
  const decision = decisions.find((item) => item.id === decisionId);
  const option = decision?.options.find((item) => item.id === optionId);
  return option || null;
}

function getWeatherForDateLabel(dateLabel: string, weatherDays: WeatherDay[]) {
  const isoDate = dateLabelToIsoDate[dateLabel];
  if (!isoDate) return undefined;

  return weatherDays.find((day) => day.date === isoDate);
}

function getWeatherForDecision(decision: TripDecision, weatherDays: WeatherDay[]) {
  return getWeatherForDateLabel(decision.dateLabel, weatherDays);
}

function getWeatherSlotForDecision(decision: TripDecision, weatherDays: WeatherDay[]) {
  const day = getWeatherForDecision(decision, weatherDays);
  if (!day) return null;

  const label = decision.timeLabel.toLowerCase();
  const title = decision.title.toLowerCase();

  if (label.includes("brunch") || title.includes("brunch")) return day.slots.brunch;
  if (label.includes("morning") || title.includes("morning")) return day.slots.morning;
  if (label.includes("afternoon")) return day.slots.afternoon;
  if (label.includes("daytime")) return day.slots.daytime;
  if (label.includes("dinner") || label.includes("game") || title.includes("dinner")) return day.slots.dinner;
  if (label.includes("night") || title.includes("night")) return day.slots.night;

  return day.slots.daytime;
}

function formatWeatherTemp(day: WeatherDay) {
  const high = day.highF === null ? "?" : `${day.highF}°`;
  const low = day.lowF === null ? "?" : `${day.lowF}°`;
  return `${high} / ${low}`;
}

function formatRain(day: WeatherDay) {
  if (day.rainChance === null) return "Rain unknown";
  return `${day.rainChance}% rain`;
}

function formatSlotWeather(slot: WeatherSlot) {
  const temp = slot.tempF === null ? "?" : `${slot.tempF}°`;
  const rain = slot.rainChance === null ? "rain unknown" : `${slot.rainChance}% rain`;
  return `${slot.icon} ${slot.label}: ${temp} · ${rain}`;
}

function getDayIntro(dateLabel: string) {
  if (dateLabel.startsWith("Thursday")) return "Arrive, settle in, dinner, and classic Cali salsa.";
  if (dateLabel.startsWith("Friday")) return "Views, USA game, dinner, and a proper Friday night out.";
  if (dateLabel.startsWith("Saturday")) return "Brunch, city walking, snacks, reset, then the big party.";
  if (dateLabel.startsWith("Sunday")) return "Checkout, brunch, bags, and an easy final day.";
  return "Weekend plan.";
}

export default function Home() {
  const [decisions, setDecisions] = useState<TripDecision[]>(initialDecisions);
  const [name, setName] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [showNameModal, setShowNameModal] = useState(false);
  const [hasLoadedRemote, setHasLoadedRemote] = useState(false);
  const [syncMessage, setSyncMessage] = useState("Loading shared board...");
  const [openAddFormId, setOpenAddFormId] = useState<string | null>(null);
  const [draftByDecision, setDraftByDecision] = useState<Record<string, NewOptionDraft>>({});
  const [aiCommand, setAiCommand] = useState("");
  const [aiMessage, setAiMessage] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiProposal, setAiProposal] = useState<AiEditProposal | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [answerLoading, setAnswerLoading] = useState(false);
  const [weather, setWeather] = useState<WeatherResponse | null>(null);
  const [weatherMessage, setWeatherMessage] = useState("Loading Cali weather...");

  const totalVotes = useMemo(() => {
    return decisions.reduce(
      (total, decision) =>
        total + decision.options.reduce((optionTotal, option) => optionTotal + option.votes.length, 0),
      0
    );
  }, [decisions]);

  const groupedDecisions = useMemo(() => {
    return dayOrder.map((dateLabel) => ({
      dateLabel,
      decisions: decisions.filter((decision) => decision.dateLabel === dateLabel),
    }));
  }, [decisions]);

  const weekendSummary = useMemo(() => {
    return groupedDecisions.map((group) => ({
      dateLabel: group.dateLabel,
      items: group.decisions.map((decision) => ({
        id: decision.id,
        title: decision.title,
        label: getSummaryLabel(decision),
      })),
    }));
  }, [groupedDecisions]);

  useEffect(() => {
    const savedName = cleanName(localStorage.getItem(NAME_STORAGE_KEY) || "");

    if (savedName) {
      setName(savedName);
      setNameDraft(savedName);
    } else {
      setShowNameModal(true);
    }
  }, []);

  useEffect(() => {
    async function loadBoard() {
      const localBoard = safeParseDecisions(localStorage.getItem(STORAGE_KEY)) ?? initialDecisions;

      if (!supabase) {
        setDecisions(localBoard);
        setHasLoadedRemote(true);
        setSyncMessage("Using this browser only. Supabase is not connected.");
        return;
      }

      const { data, error } = await supabase
        .from("trips")
        .select("data")
        .eq("id", TRIP_ID)
        .maybeSingle();

      if (error) {
        setDecisions(localBoard);
        setHasLoadedRemote(true);
        setSyncMessage(`Could not load shared board: ${error.message}`);
        return;
      }

      if (data?.data && Array.isArray(data.data)) {
        const remoteBoard = data.data as TripDecision[];
        setDecisions(remoteBoard);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(remoteBoard));
        setHasLoadedRemote(true);
        setSyncMessage("Shared board loaded.");
        return;
      }

      const { error: createError } = await supabase.from("trips").upsert({
        id: TRIP_ID,
        data: localBoard,
        updated_at: new Date().toISOString(),
      });

      setDecisions(localBoard);
      setHasLoadedRemote(true);
      setSyncMessage(createError ? `Could not create shared board: ${createError.message}` : "Shared board created.");
    }

    loadBoard();
  }, []);

  useEffect(() => {
    async function loadWeather() {
      try {
        const response = await fetch("/api/trip-weather", { cache: "no-store" });
        const data = (await response.json()) as WeatherResponse;

        if (!response.ok || data.error) {
          setWeatherMessage(data.error || "Could not load weather.");
          return;
        }

        setWeather(data);
        setWeatherMessage(`Weather loaded from ${data.source}.`);
      } catch (error) {
        setWeatherMessage(error instanceof Error ? error.message : "Could not load weather.");
      }
    }

    loadWeather();
  }, []);

  useEffect(() => {
    if (!hasLoadedRemote) return;

    localStorage.setItem(STORAGE_KEY, JSON.stringify(decisions));

    if (!supabase) return;

    const saveTimer = window.setTimeout(async () => {
      setSyncMessage("Saving...");

      const { error } = await supabase.from("trips").upsert({
        id: TRIP_ID,
        data: decisions,
        updated_at: new Date().toISOString(),
      });

      setSyncMessage(error ? `Could not save shared changes: ${error.message}` : "Saved to shared board.");
    }, 500);

    return () => window.clearTimeout(saveTimer);
  }, [decisions, hasLoadedRemote]);

  function saveName() {
    const trimmedName = cleanName(nameDraft);
    if (!trimmedName) return;

    setName(trimmedName);
    localStorage.setItem(NAME_STORAGE_KEY, trimmedName);
    setShowNameModal(false);
  }

  function vote(decisionId: string, optionId: string) {
    const voter = cleanName(name);

    if (!voter) {
      setShowNameModal(true);
      return;
    }

    setDecisions((current) =>
      current.map((decision) => {
        if (decision.id !== decisionId || decision.status === "Locked") return decision;

        return {
          ...decision,
          options: decision.options.map((option) => ({
            ...option,
            votes:
              option.id === optionId
                ? Array.from(new Set([...option.votes.filter((voteName) => voteName !== voter), voter]))
                : option.votes.filter((voteName) => voteName !== voter),
          })),
        };
      })
    );
  }

  function removeMyVote(decisionId: string) {
    const voter = cleanName(name);
    if (!voter) return;

    setDecisions((current) =>
      current.map((decision) => {
        if (decision.id !== decisionId || decision.status === "Locked") return decision;

        return {
          ...decision,
          options: decision.options.map((option) => ({
            ...option,
            votes: option.votes.filter((voteName) => voteName !== voter),
          })),
        };
      })
    );
  }

  function updateDraft(decisionId: string, updates: Partial<NewOptionDraft>) {
    setDraftByDecision((current) => ({
      ...current,
      [decisionId]: {
        ...(current[decisionId] ?? emptyDraft()),
        ...updates,
      },
    }));
  }

  function addOption(decisionId: string) {
    const voter = cleanName(name);

    if (!voter) {
      setShowNameModal(true);
      return;
    }

    const draft = draftByDecision[decisionId] ?? emptyDraft();
    const title = draft.title.trim();

    if (!title) return;

    const newOption: TripOption = {
      id: makeId("option"),
      title,
      description: draft.description.trim(),
      category: draft.category,
      suggestedBy: voter,
      votes: [],
    };

    if (draft.url.trim()) newOption.url = draft.url.trim();
    if (draft.mapsUrl.trim()) newOption.mapsUrl = draft.mapsUrl.trim();

    setDecisions((current) =>
      current.map((decision) =>
        decision.id === decisionId
          ? {
              ...decision,
              options: [...decision.options, newOption],
            }
          : decision
      )
    );

    setDraftByDecision((current) => ({ ...current, [decisionId]: emptyDraft() }));
    setOpenAddFormId(null);
  }

  function deleteOption(decisionId: string, optionId: string) {
    const currentUser = cleanName(name);
    const option = findOption(decisions, decisionId, optionId);

    if (!currentUser) {
      setShowNameModal(true);
      return;
    }

    if (!option || !canManageOption(option, currentUser)) return;

    setDecisions((current) =>
      current.map((decision) =>
        decision.id === decisionId
          ? {
              ...decision,
              options: decision.options.filter((item) => item.id !== optionId),
            }
          : decision
      )
    );
  }

  function applyOperations(operations: AiEditOperation[]): ApplyResult {
    const fallbackName = cleanName(name) || "Friend";
    let appliedCount = 0;
    let skippedCount = 0;

    setDecisions((current) => {
      let next = [...current];

      for (const operation of operations) {
        if (!operation.decisionId) {
          skippedCount += 1;
          continue;
        }

        if (operation.type === "add_option") {
          const title = operation.title?.trim();
          const targetDecision = next.find((decision) => decision.id === operation.decisionId);

          if (!title || !targetDecision || targetDecision.status === "Locked") {
            skippedCount += 1;
            continue;
          }

          next = next.map((decision) => {
            if (decision.id !== operation.decisionId) return decision;

            const newOption: TripOption = {
              id: makeId("option"),
              title,
              description: operation.description?.trim() || "",
              category: operation.category || "other",
              suggestedBy: operation.suggestedBy?.trim() || fallbackName,
              votes: [],
            };

            if (operation.url?.trim()) newOption.url = operation.url.trim();
            if (operation.mapsUrl?.trim()) newOption.mapsUrl = operation.mapsUrl.trim();

            return { ...decision, options: [...decision.options, newOption] };
          });
          appliedCount += 1;
          continue;
        }

        if (operation.type === "update_option" && operation.optionId) {
          const option = findOption(next, operation.decisionId, operation.optionId);

          if (!option || !canManageOption(option, fallbackName)) {
            skippedCount += 1;
            continue;
          }

          next = next.map((decision) => {
            if (decision.id !== operation.decisionId) return decision;

            return {
              ...decision,
              options: decision.options.map((item) => {
                if (item.id !== operation.optionId) return item;

                return {
                  ...item,
                  title: operation.title?.trim() || item.title,
                  description: operation.description?.trim() ?? item.description,
                  category: operation.category || item.category,
                  url: operation.url?.trim() || item.url,
                  mapsUrl: operation.mapsUrl?.trim() || item.mapsUrl,
                };
              }),
            };
          });
          appliedCount += 1;
          continue;
        }

        if (operation.type === "delete_option" && operation.optionId) {
          const option = findOption(next, operation.decisionId, operation.optionId);

          if (!option || !canManageOption(option, fallbackName)) {
            skippedCount += 1;
            continue;
          }

          next = next.map((decision) =>
            decision.id === operation.decisionId
              ? {
                  ...decision,
                  options: decision.options.filter((item) => item.id !== operation.optionId),
                }
              : decision
          );
          appliedCount += 1;
          continue;
        }

        if (operation.type === "lock_decision") {
          if (!isSuperAdmin(fallbackName)) {
            skippedCount += 1;
            continue;
          }

          next = next.map((decision) =>
            decision.id === operation.decisionId ? { ...decision, status: "Locked" } : decision
          );
          appliedCount += 1;
          continue;
        }

        if (operation.type === "unlock_decision") {
          if (!isSuperAdmin(fallbackName)) {
            skippedCount += 1;
            continue;
          }

          next = next.map((decision) =>
            decision.id === operation.decisionId ? { ...decision, status: "Open" } : decision
          );
          appliedCount += 1;
          continue;
        }

        skippedCount += 1;
      }

      return next;
    });

    return { appliedCount, skippedCount };
  }

  async function requestAiEdit() {
    const command = aiCommand.trim();
    const currentUser = cleanName(name);

    if (!currentUser) {
      setShowNameModal(true);
      return;
    }

    if (!command) return;

    setAiLoading(true);
    setAiMessage("");
    setAiProposal(null);

    try {
      const response = await fetch("/api/admin-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command,
          decisions,
          currentUser,
        }),
      });

      const data = (await response.json()) as AiEditProposal | { error?: string };

      if (!response.ok) {
        setAiMessage("error" in data && data.error ? data.error : "AI edit failed.");
        return;
      }

      const proposal = data as AiEditProposal;
      setAiProposal(proposal);
      setAiMessage(proposal.needsClarification ? proposal.clarificationQuestion : proposal.summary);
    } catch (error) {
      setAiMessage(error instanceof Error ? error.message : "AI edit failed.");
    } finally {
      setAiLoading(false);
    }
  }

  function applyAiProposal() {
    if (!aiProposal || aiProposal.needsClarification) return;

    const result = applyOperations(aiProposal.operations);
    setAiCommand("");
    setAiProposal(null);

    if (result.skippedCount > 0 && result.appliedCount > 0) {
      setAiMessage(`Applied ${result.appliedCount} edit${result.appliedCount === 1 ? "" : "s"}. Skipped ${result.skippedCount} because only the person who added an option, or Will, can edit/delete it.`);
      return;
    }

    if (result.skippedCount > 0) {
      setAiMessage(`Skipped ${result.skippedCount} edit${result.skippedCount === 1 ? "" : "s"}. Only the person who added an option, or Will, can edit/delete it.`);
      return;
    }

    setAiMessage(`Applied ${result.appliedCount} edit${result.appliedCount === 1 ? "" : "s"}.`);
  }

  async function askTripQuestion() {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) return;

    setAnswerLoading(true);
    setAnswer("");

    try {
      const response = await fetch("/api/ask-trip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: trimmedQuestion,
          decisions,
          tripDetails,
        }),
      });

      const data = (await response.json()) as { answer?: string; error?: string };

      setAnswer(response.ok ? data.answer || "No answer returned." : data.error || "Question failed.");
    } catch (error) {
      setAnswer(error instanceof Error ? error.message : "Question failed.");
    } finally {
      setAnswerLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#fff7ed] text-stone-950">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <header className="overflow-hidden rounded-[2rem] border border-orange-100 bg-white shadow-xl shadow-orange-100/70">
          <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="bg-gradient-to-br from-rose-700 via-orange-600 to-sky-700 px-6 py-8 text-white sm:px-9 lg:py-12">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-black uppercase tracking-[0.25em] backdrop-blur">{tripDetails.dates}</span>
                <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-black uppercase tracking-[0.25em] backdrop-blur">Cali, Colombia</span>
              </div>

              <div className="mt-16 max-w-3xl lg:mt-24">
                <h1 className="text-5xl font-black tracking-tight sm:text-7xl">Cali Trip 2026</h1>
                <p className="mt-4 max-w-2xl text-xl font-semibold text-white/90">
                  This is just a guide to help us decide what to do when we&apos;re in Cali. Actual plans will be at the whims of drunk us.
                </p>
              </div>

              <div className="mt-8 rounded-2xl bg-white/15 p-4 text-sm backdrop-blur">
                <p className="font-bold">Signed in as</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white px-3 py-1 font-bold text-rose-600">{name || "No name yet"}</span>
                  <button className="rounded-full border border-white/50 px-3 py-1 font-semibold text-white" onClick={() => setShowNameModal(true)}>
                    Change
                  </button>
                </div>
                <p className="mt-2 text-xs text-white/80">Will can manage all options. Everyone else can manage their own.</p>
              </div>
            </div>

            <div className="flex min-h-[280px] items-center justify-center bg-stone-950 p-4">
              <img
                src={tripDetails.heroImagePath}
                alt="Cali trip"
                className="max-h-[360px] w-full rounded-[1.5rem] object-contain shadow-2xl"
              />
            </div>
          </div>

          <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4 lg:p-8">
            <div className="rounded-2xl bg-orange-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-orange-600">Apartment</p>
              <p className="mt-2 text-sm font-semibold text-stone-800">{tripDetails.apartmentAddress}</p>
              <a className="mt-3 inline-flex text-sm font-bold text-rose-600 underline" href={getApartmentMapsUrl()} target="_blank" rel="noreferrer">
                Open map
              </a>
            </div>
            <div className="rounded-2xl bg-sky-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-sky-700">People</p>
              <p className="mt-2 text-sm font-semibold text-stone-800">{tripDetails.attendees.join(", ")}</p>
            </div>
            <div className="rounded-2xl bg-rose-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-rose-700">Group photos</p>
              <p className="mt-2 text-sm font-semibold text-stone-800">Drop the weekend photos here.</p>
              <a className="mt-3 inline-flex text-sm font-bold text-rose-600 underline" href={tripDetails.photosUrl} target="_blank" rel="noreferrer">
                Open Google Photos
              </a>
            </div>
            <div className="rounded-2xl bg-lime-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-lime-700">Board</p>
              <p className="mt-2 text-sm font-semibold text-stone-800">{decisions.length} decisions, {totalVotes} votes</p>
              <p className="mt-1 text-xs text-stone-500">{syncMessage}</p>
            </div>
          </div>
        </header>

        <section className="rounded-[2rem] border border-orange-100 bg-white p-5 shadow-lg shadow-orange-100/60 sm:p-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-wider text-orange-600">Weather</p>
              <h2 className="text-3xl font-black">Cali forecast</h2>
              <p className="mt-2 text-sm text-stone-600">{weatherMessage}</p>
            </div>
            <a className="text-sm font-bold text-rose-600 underline" href="https://open-meteo.com/" target="_blank" rel="noreferrer">
              Open-Meteo
            </a>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {dayOrder.map((dateLabel) => {
              const matchingDay = weather ? getWeatherForDateLabel(dateLabel, weather.days) : undefined;

              return (
                <div key={dateLabel} className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                  <p className="text-xs font-black uppercase tracking-wider text-stone-500">{dateLabel}</p>
                  {matchingDay ? (
                    <>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <p className="text-3xl">{matchingDay.icon}</p>
                        <p className="text-2xl font-black">{formatWeatherTemp(matchingDay)}</p>
                      </div>
                      <p className="mt-2 text-sm font-bold text-stone-800">{matchingDay.summary}</p>
                      <p className="mt-1 text-xs font-semibold text-stone-500">{formatRain(matchingDay)}</p>
                    </>
                  ) : (
                    <p className="mt-3 text-sm font-semibold text-stone-500">Forecast not available yet.</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-[2rem] border border-orange-100 bg-white p-5 shadow-lg shadow-orange-100/60 sm:p-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-wider text-rose-500">Weekend at a glance</p>
              <h2 className="text-3xl font-black">The plan so far</h2>
            </div>
            <a className="text-sm font-bold text-rose-600 underline" href="#days">Jump to days</a>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-4">
            {weekendSummary.map((group) => (
              <div key={group.dateLabel} className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                <p className="text-sm font-black text-stone-950">{group.dateLabel}</p>
                <p className="mt-1 text-xs font-semibold text-stone-500">{getDayIntro(group.dateLabel)}</p>
                <div className="mt-4 grid gap-2">
                  {group.items.map((item) => (
                    <a key={item.id} href={`#${item.id}`} className="rounded-xl bg-white p-3 text-sm hover:shadow-sm">
                      <p className="font-black text-stone-900">{item.title}</p>
                      <p className="mt-1 text-xs font-semibold text-stone-600">{item.label}</p>
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-[2rem] border border-orange-100 bg-white p-5 shadow-lg shadow-orange-100/60 sm:p-7">
            <p className="text-sm font-bold uppercase tracking-wider text-sky-600">Flights</p>
            <div className="mt-4 grid gap-3">
              {tripDetails.flights.map((flight) => (
                <div key={flight.id} className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black">{flight.title}</p>
                      <p className="text-sm text-stone-500">{flight.date} · {flight.airline} {flight.flightNumber}</p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-sky-700">{flight.departAirport} to {flight.arriveAirport}</span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="font-black text-stone-900">{flight.departTime}</p>
                      <p className="text-stone-600">{flight.departCity}</p>
                    </div>
                    <div>
                      <p className="font-black text-stone-900">{flight.arriveTime}</p>
                      <p className="text-stone-600">{flight.arriveCity}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-orange-100 bg-white p-5 shadow-lg shadow-orange-100/60 sm:p-7">
            <p className="text-sm font-bold uppercase tracking-wider text-purple-600">AI board editor</p>
            <h2 className="mt-1 text-2xl font-black">Edit the board with plain English</h2>
            <p className="mt-2 text-sm text-stone-600">Try: “Add a rooftop option for Friday afternoon” or “remove the option I added.” It previews before applying.</p>
            <textarea
              className="mt-4 min-h-24 w-full rounded-2xl border border-stone-200 bg-white p-3 text-sm outline-none focus:border-purple-400"
              value={aiCommand}
              onChange={(event) => setAiCommand(event.target.value)}
              placeholder="Add a rooftop option for Friday afternoon..."
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="rounded-full bg-purple-600 px-5 py-2 text-sm font-black text-white disabled:opacity-50" onClick={requestAiEdit} disabled={aiLoading}>
                {aiLoading ? "Thinking..." : "Preview AI edit"}
              </button>
              {aiProposal && !aiProposal.needsClarification ? (
                <button className="rounded-full bg-stone-950 px-5 py-2 text-sm font-black text-white" onClick={applyAiProposal}>
                  Apply preview
                </button>
              ) : null}
            </div>
            {aiMessage ? <p className="mt-3 rounded-2xl bg-purple-50 p-3 text-sm font-semibold text-purple-950">{aiMessage}</p> : null}
          </div>
        </section>

        <section className="rounded-[2rem] border border-orange-100 bg-white p-5 shadow-lg shadow-orange-100/60 sm:p-7">
          <p className="text-sm font-bold uppercase tracking-wider text-orange-600">Ask the board</p>
          <h2 className="mt-1 text-2xl font-black">Trip Q&A</h2>
          <p className="mt-2 text-sm text-stone-600">Use this for questions about the trip, flights, apartment, weather, or what is currently winning.</p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              className="min-h-11 flex-1 rounded-full border border-stone-200 bg-white px-4 text-sm outline-none focus:border-orange-400"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="What is the plan for Saturday?"
            />
            <button className="rounded-full bg-orange-500 px-5 py-2 text-sm font-black text-white disabled:opacity-50" onClick={askTripQuestion} disabled={answerLoading}>
              {answerLoading ? "Answering..." : "Ask"}
            </button>
          </div>
          {answer ? <p className="mt-4 whitespace-pre-line rounded-2xl bg-orange-50 p-4 text-sm font-medium text-stone-800">{answer}</p> : null}
        </section>

        <section id="days" className="grid gap-6">
          {groupedDecisions.map((group) => (
            <div key={group.dateLabel} className="rounded-[2rem] border border-orange-100 bg-white p-4 shadow-lg shadow-orange-100/60 sm:p-6">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-bold uppercase tracking-wider text-rose-500">Day plan</p>
                  <h2 className="text-3xl font-black">{group.dateLabel}</h2>
                  <p className="mt-1 text-sm text-stone-600">{getDayIntro(group.dateLabel)}</p>
                </div>
                {weather && getWeatherForDateLabel(group.dateLabel, weather.days) ? (
                  <div className="rounded-2xl bg-stone-950 px-4 py-3 text-sm font-bold text-white">
                    {(() => {
                      const day = getWeatherForDateLabel(group.dateLabel, weather.days);
                      return day ? `${day.icon} ${formatWeatherTemp(day)} · ${formatRain(day)}` : "";
                    })()}
                  </div>
                ) : null}
              </div>

              <div className="grid gap-4">
                {group.decisions.map((decision) => {
                  const winner = getWinner(decision.options);
                  const rankedOptions = rankOptions(decision.options);
                  const userVote = decision.options.find((option) => option.votes.includes(name));
                  const draft = draftByDecision[decision.id] ?? emptyDraft();
                  const decisionWeather = weather ? getWeatherForDecision(decision, weather.days) : undefined;
                  const decisionWeatherSlot = weather ? getWeatherSlotForDecision(decision, weather.days) : null;

                  return (
                    <article key={decision.id} id={decision.id} className="scroll-mt-6 rounded-[1.5rem] border border-stone-200 bg-white p-4 sm:p-5">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-black uppercase tracking-wider text-sky-700">{decision.timeLabel}</span>
                            <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider ${decision.status === "Locked" ? "bg-stone-200 text-stone-700" : "bg-lime-100 text-lime-700"}`}>{decision.status}</span>
                            {decisionWeatherSlot ? (
                              <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-black uppercase tracking-wider text-orange-700">
                                {formatSlotWeather(decisionWeatherSlot)}
                              </span>
                            ) : decisionWeather ? (
                              <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-black uppercase tracking-wider text-orange-700">
                                {decisionWeather.icon} {formatWeatherTemp(decisionWeather)} · {formatRain(decisionWeather)}
                              </span>
                            ) : null}
                          </div>
                          <h3 className="mt-3 text-2xl font-black">{decision.title}</h3>
                          <p className="mt-2 max-w-2xl text-sm text-stone-600">{decision.description}</p>
                        </div>

                        <div className="rounded-2xl bg-stone-950 p-4 text-white lg:min-w-72">
                          <p className="text-xs font-bold uppercase tracking-wider text-white/60">Current winner</p>
                          {winner.kind === "none" ? (
                            <p className="mt-2 text-xl font-black">No votes yet</p>
                          ) : null}
                          {winner.kind === "winner" ? (
                            <>
                              <p className="mt-2 text-xl font-black">{winner.option.title}</p>
                              <p className="text-sm text-white/70">{winner.votes} vote{winner.votes === 1 ? "" : "s"}</p>
                            </>
                          ) : null}
                          {winner.kind === "tie" ? (
                            <>
                              <p className="mt-2 text-xl font-black">Tie</p>
                              <p className="text-sm text-white/70">{winner.options.map((option) => option.title).join(" / ")} · {winner.votes} vote{winner.votes === 1 ? "" : "s"} each</p>
                            </>
                          ) : null}
                          {userVote ? <p className="mt-3 text-xs font-bold text-lime-300">Your vote: {userVote.title}</p> : null}
                        </div>
                      </div>

                      <div className="mt-5 grid gap-3">
                        {rankedOptions.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-5 text-center text-sm font-semibold text-stone-500">No options yet. Add the first idea.</div>
                        ) : null}

                        {rankedOptions.map((option, index) => {
                          const hasMyVote = option.votes.includes(name);
                          const canManage = canManageOption(option, name);
                          const isActionItem = option.description.toLowerCase().includes("action item");

                          return (
                            <div key={option.id} className={`rounded-2xl border p-4 ${hasMyVote ? "border-rose-300 bg-rose-50" : "border-stone-200 bg-stone-50"}`}>
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-stone-600">#{index + 1}</span>
                                    <span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-black text-orange-700">{option.category}</span>
                                    {isActionItem ? <span className="rounded-full bg-rose-600 px-2.5 py-1 text-xs font-black text-white">Action needed</span> : null}
                                    <span className="text-xs font-semibold text-stone-500">Suggested by {option.suggestedBy}</span>
                                  </div>
                                  <h4 className="mt-2 text-xl font-black">{option.title}</h4>
                                  {option.description ? <p className="mt-1 text-sm text-stone-600">{option.description}</p> : null}
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {option.url ? <a className="rounded-full bg-white px-3 py-1 text-xs font-black text-stone-700 underline" href={option.url} target="_blank" rel="noreferrer">Open link</a> : null}
                                    {option.mapsUrl ? <a className="rounded-full bg-white px-3 py-1 text-xs font-black text-stone-700 underline" href={option.mapsUrl} target="_blank" rel="noreferrer">Google Maps</a> : null}
                                  </div>
                                </div>
                                <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                                  <p className="text-sm font-black text-stone-900">{option.votes.length} vote{option.votes.length === 1 ? "" : "s"}</p>
                                  <button
                                    className={`rounded-full px-5 py-2 text-sm font-black ${hasMyVote ? "bg-rose-600 text-white" : "bg-stone-950 text-white"} disabled:cursor-not-allowed disabled:opacity-50`}
                                    onClick={() => vote(decision.id, option.id)}
                                    disabled={decision.status === "Locked"}
                                  >
                                    {hasMyVote ? "Voted" : "Vote"}
                                  </button>
                                  {canManage ? (
                                    <button
                                      className="rounded-full border border-stone-300 bg-white px-4 py-1.5 text-xs font-black text-stone-600"
                                      onClick={() => deleteOption(decision.id, option.id)}
                                      disabled={decision.status === "Locked"}
                                    >
                                      Delete
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                              <p className="mt-3 text-xs font-semibold text-stone-500">{option.votes.length > 0 ? `Voted: ${option.votes.join(", ")}` : "No votes yet"}</p>
                            </div>
                          );
                        })}
                      </div>

                      <div className="mt-5 flex flex-wrap gap-2">
                        <button className="rounded-full bg-rose-600 px-5 py-2 text-sm font-black text-white" onClick={() => setOpenAddFormId(openAddFormId === decision.id ? null : decision.id)}>
                          {openAddFormId === decision.id ? "Close add form" : "Add an option"}
                        </button>
                        {userVote ? (
                          <button className="rounded-full border border-stone-300 bg-white px-5 py-2 text-sm font-black text-stone-700 disabled:opacity-50" onClick={() => removeMyVote(decision.id)} disabled={decision.status === "Locked"}>
                            Remove my vote
                          </button>
                        ) : null}
                      </div>

                      {openAddFormId === decision.id ? (
                        <div className="mt-4 rounded-2xl border border-stone-200 bg-stone-50 p-4">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <input className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm outline-none focus:border-rose-400" value={draft.title} onChange={(event) => updateDraft(decision.id, { title: event.target.value })} placeholder="Option title" />
                            <select className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm outline-none focus:border-rose-400" value={draft.category} onChange={(event) => updateDraft(decision.id, { category: event.target.value as OptionCategory })}>
                              {optionCategories.map((category) => <option key={category} value={category}>{category}</option>)}
                            </select>
                            <input className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm outline-none focus:border-rose-400" value={draft.url} onChange={(event) => updateDraft(decision.id, { url: event.target.value })} placeholder="Optional website or event URL" />
                            <input className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm outline-none focus:border-rose-400" value={draft.mapsUrl} onChange={(event) => updateDraft(decision.id, { mapsUrl: event.target.value })} placeholder="Optional Google Maps URL" />
                          </div>
                          <textarea className="mt-3 min-h-20 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm outline-none focus:border-rose-400" value={draft.description} onChange={(event) => updateDraft(decision.id, { description: event.target.value })} placeholder="Quick description" />
                          <button className="mt-3 rounded-full bg-stone-950 px-5 py-2 text-sm font-black text-white" onClick={() => addOption(decision.id)}>
                            Save option
                          </button>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      </section>

      {showNameModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[2rem] bg-white p-6 shadow-2xl">
            <p className="text-sm font-bold uppercase tracking-wider text-rose-600">Before you vote</p>
            <h2 className="mt-2 text-3xl font-black">What name should we show?</h2>
            <p className="mt-2 text-sm text-stone-600">This lets everyone see who voted for what. Use Will, Paula, Vane, Josh, or whatever name you want displayed.</p>
            <input
              className="mt-5 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-lg font-bold outline-none focus:border-rose-400"
              value={nameDraft}
              onChange={(event) => setNameDraft(event.target.value)}
              placeholder="Your name"
              onKeyDown={(event) => {
                if (event.key === "Enter") saveName();
              }}
              autoFocus
            />
            <button className="mt-4 w-full rounded-full bg-rose-600 px-5 py-3 font-black text-white disabled:opacity-50" onClick={saveName} disabled={!cleanName(nameDraft)}>
              Save name
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}