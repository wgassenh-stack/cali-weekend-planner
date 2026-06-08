"use client";

import { useEffect, useState } from "react";

type PeriodWeather = {
  name: "Morning" | "Afternoon" | "Evening";
  timeRange: string;
  temperature: number | null;
  rainChance: number | null;
  wind: number | null;
  condition: string;
  emoji: string;
  note: string;
};

type TripWeather = {
  available: boolean;
  date: string;
  locationName: string;
  condition?: string;
  emoji?: string;
  high?: number | null;
  low?: number | null;
  rainChance?: number | null;
  rainTotal?: number | null;
  wind?: number | null;
  uvIndex?: number | null;
  periods?: PeriodWeather[];
  summary?: string;
  wearSuggestion?: string;
  message?: string;
  source?: string;
};

type TripWeatherCardProps = {
  dayId: string;
};

function formatValue(value: number | null | undefined, suffix: string) {
  if (typeof value !== "number" || Number.isNaN(value)) return "Pending";
  return `${value}${suffix}`;
}

function formatRange(
  high: number | null | undefined,
  low: number | null | undefined,
  suffix: string
) {
  if (
    typeof high !== "number" ||
    Number.isNaN(high) ||
    typeof low !== "number" ||
    Number.isNaN(low)
  ) {
    return "Pending";
  }

  return `${high}${suffix} / ${low}${suffix}`;
}

export default function TripWeatherCard({ dayId }: TripWeatherCardProps) {
  const [weather, setWeather] = useState<TripWeather | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;

    async function loadWeather() {
      setLoading(true);
      setError("");
      setWeather(null);

      try {
        const response = await fetch(
          `/api/trip-weather?dayId=${encodeURIComponent(dayId)}`
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Could not load weather.");
        }

        if (!ignore) {
          setWeather(data as TripWeather);
        }
      } catch (loadError) {
        if (!ignore) {
          const message =
            loadError instanceof Error ? loadError.message : "Could not load weather.";
          setError(message);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadWeather();

    return () => {
      ignore = true;
    };
  }, [dayId]);

  return (
    <section className="mt-6 rounded-[2rem] bg-[#fbf7ef] p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#c95f3f]">
            Weather
          </p>
          <h3 className="mt-2 font-serif text-3xl font-semibold">
            What to expect
          </h3>
        </div>

        <span className="rounded-full border border-[#d8cdbc] bg-white px-4 py-2 text-xs font-semibold text-[#746b62]">
          Open-Meteo
        </span>
      </div>

      {loading && (
        <p className="mt-4 rounded-2xl bg-[#f3eee5] p-4 text-sm leading-6 text-[#746b62]">
          Loading weather...
        </p>
      )}

      {error && !loading && (
        <p className="mt-4 rounded-2xl bg-red-50 p-4 text-sm leading-6 text-red-700">
          {error}
        </p>
      )}

      {weather && !loading && !error && !weather.available && (
        <div className="mt-4 rounded-2xl bg-[#f3eee5] p-4 text-sm leading-6 text-[#746b62]">
          <p className="font-semibold text-[#241f1a]">
            {weather.locationName} · {weather.date}
          </p>
          <p className="mt-2">
            {weather.message || "Forecast will appear closer to the date."}
          </p>
        </div>
      )}

      {weather && !loading && !error && weather.available && (
        <div className="mt-4 space-y-4">
          <div className="rounded-2xl bg-[#f3eee5] p-4">
            <div className="flex items-start gap-3">
              <span className="text-3xl">{weather.emoji || "🌤️"}</span>

              <div>
                <p className="text-sm font-bold text-[#241f1a]">
                  {weather.locationName} · {weather.condition || "Forecast"}
                </p>
                <p className="mt-1 text-sm leading-6 text-[#5f574f]">
                  {weather.summary}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-white p-4">
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#968d82]">
                Temp
              </p>
              <p className="mt-1 font-serif text-2xl text-[#241f1a]">
                {formatRange(weather.high, weather.low, "°")}
              </p>
            </div>

            <div className="rounded-2xl bg-white p-4">
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#968d82]">
                Rain
              </p>
              <p className="mt-1 font-serif text-2xl text-[#241f1a]">
                {formatValue(weather.rainChance, "%")}
              </p>
            </div>

            <div className="rounded-2xl bg-white p-4">
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#968d82]">
                Wind
              </p>
              <p className="mt-1 font-serif text-2xl text-[#241f1a]">
                {formatValue(weather.wind, " mph")}
              </p>
            </div>
          </div>

          {weather.periods && weather.periods.length > 0 && (
            <div className="grid gap-3 md:grid-cols-3">
              {weather.periods.map((period) => (
                <div key={period.name} className="rounded-2xl bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#968d82]">
                        {period.name}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-[#a09588]">
                        {period.timeRange}
                      </p>
                    </div>
                    <span className="text-2xl">{period.emoji}</span>
                  </div>

                  <p className="mt-3 text-sm font-bold text-[#241f1a]">
                    {period.condition}
                  </p>

                  <div className="mt-3 space-y-1 text-sm leading-6 text-[#5f574f]">
                    <p>
                      Temp:{" "}
                      <span className="font-semibold text-[#241f1a]">
                        {formatValue(period.temperature, "°")}
                      </span>
                    </p>
                    <p>
                      Rain:{" "}
                      <span className="font-semibold text-[#241f1a]">
                        {formatValue(period.rainChance, "%")}
                      </span>
                    </p>
                    <p>
                      Wind:{" "}
                      <span className="font-semibold text-[#241f1a]">
                        {formatValue(period.wind, " mph")}
                      </span>
                    </p>
                  </div>

                  <p className="mt-3 rounded-xl bg-[#f3eee5] p-3 text-sm leading-6 text-[#5f574f]">
                    {period.note}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-2xl border border-[#e3d8c9] bg-white p-4">
            <p className="text-sm font-bold text-[#746b62]">What to wear</p>
            <p className="mt-2 leading-7 text-[#5f574f]">
              {weather.wearSuggestion}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}