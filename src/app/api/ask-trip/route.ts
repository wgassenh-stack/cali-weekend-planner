import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type OpenMeteoDaily = {
  time?: string[];
  weather_code?: number[];
  temperature_2m_max?: number[];
  temperature_2m_min?: number[];
  precipitation_probability_max?: number[];
  precipitation_sum?: number[];
};

type OpenMeteoHourly = {
  time?: string[];
  weather_code?: number[];
  temperature_2m?: number[];
  precipitation_probability?: number[];
  precipitation?: number[];
};

type OpenMeteoResponse = {
  daily?: OpenMeteoDaily;
  hourly?: OpenMeteoHourly;
};

function getWeatherSummary(code: number) {
  if (code === 0) return "Sunny";
  if ([1, 2].includes(code)) return "Partly cloudy";
  if (code === 3) return "Cloudy";
  if ([45, 48].includes(code)) return "Foggy";
  if ([51, 53, 55, 56, 57].includes(code)) return "Drizzle possible";
  if ([61, 63, 65, 66, 67].includes(code)) return "Rain likely";
  if ([71, 73, 75, 77].includes(code)) return "Snow";
  if ([80, 81, 82].includes(code)) return "Showers possible";
  if ([95, 96, 99].includes(code)) return "Thunderstorms possible";
  return "Mixed weather";
}

function getWeatherIcon(code: number) {
  if (code === 0) return "☀️";
  if ([1, 2].includes(code)) return "⛅";
  if (code === 3) return "☁️";
  if ([45, 48].includes(code)) return "🌫️";
  if ([51, 53, 55, 56, 57].includes(code)) return "🌦️";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "🌧️";
  if ([95, 96, 99].includes(code)) return "⛈️";
  return "🌤️";
}

function formatDateLabel(dateValue: string) {
  const date = new Date(`${dateValue}T12:00:00-05:00`);

  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "America/Bogota",
  }).format(date);
}

function formatShortLabel(dateValue: string) {
  const date = new Date(`${dateValue}T12:00:00-05:00`);

  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "numeric",
    day: "numeric",
    timeZone: "America/Bogota",
  }).format(date);
}

function formatHourLabel(hour: number) {
  const date = new Date(`2026-06-11T${String(hour).padStart(2, "0")}:00:00-05:00`);

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hour12: true,
    timeZone: "America/Bogota",
  }).format(date);
}

function roundNumber(value: number | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  return Math.round(value);
}

function getHourlySlot(data: OpenMeteoHourly | undefined, dateValue: string, hour: number) {
  const timeKey = `${dateValue}T${String(hour).padStart(2, "0")}:00`;
  const index = data?.time?.findIndex((time) => time === timeKey) ?? -1;

  if (index < 0) return null;

  const code = data?.weather_code?.[index] ?? 3;

  return {
    hour,
    label: formatHourLabel(hour),
    tempF: roundNumber(data?.temperature_2m?.[index]),
    rainChance: roundNumber(data?.precipitation_probability?.[index]),
    precipitationIn:
      typeof data?.precipitation?.[index] === "number"
        ? Number(data.precipitation[index].toFixed(2))
        : null,
    code,
    summary: getWeatherSummary(code),
    icon: getWeatherIcon(code),
  };
}

export async function GET() {
  try {
    const latitude = 3.4516;
    const longitude = -76.532;
    const url = new URL("https://api.open-meteo.com/v1/forecast");

    url.searchParams.set("latitude", String(latitude));
    url.searchParams.set("longitude", String(longitude));
    url.searchParams.set(
      "daily",
      [
        "weather_code",
        "temperature_2m_max",
        "temperature_2m_min",
        "precipitation_probability_max",
        "precipitation_sum",
      ].join(",")
    );
    url.searchParams.set(
      "hourly",
      ["weather_code", "temperature_2m", "precipitation_probability", "precipitation"].join(",")
    );
    url.searchParams.set("temperature_unit", "fahrenheit");
    url.searchParams.set("precipitation_unit", "inch");
    url.searchParams.set("timezone", "America/Bogota");
    url.searchParams.set("forecast_days", "10");

    const response = await fetch(url.toString(), {
      next: { revalidate: 60 * 30 },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Weather request failed with status ${response.status}.` },
        { status: 502 }
      );
    }

    const data = (await response.json()) as OpenMeteoResponse;
    const daily = data.daily;

    if (!daily?.time?.length) {
      return NextResponse.json(
        { error: "Weather response did not include daily forecast data." },
        { status: 502 }
      );
    }

    const days = daily.time.map((dateValue, index) => {
      const code = daily.weather_code?.[index] ?? 3;

      return {
        date: dateValue,
        dateLabel: formatDateLabel(dateValue),
        shortLabel: formatShortLabel(dateValue),
        highF: roundNumber(daily.temperature_2m_max?.[index]),
        lowF: roundNumber(daily.temperature_2m_min?.[index]),
        rainChance: roundNumber(daily.precipitation_probability_max?.[index]),
        precipitationIn:
          typeof daily.precipitation_sum?.[index] === "number"
            ? Number(daily.precipitation_sum[index].toFixed(2))
            : null,
        code,
        summary: getWeatherSummary(code),
        icon: getWeatherIcon(code),
        slots: {
          morning: getHourlySlot(data.hourly, dateValue, 9),
          brunch: getHourlySlot(data.hourly, dateValue, 11),
          daytime: getHourlySlot(data.hourly, dateValue, 14),
          afternoon: getHourlySlot(data.hourly, dateValue, 16),
          dinner: getHourlySlot(data.hourly, dateValue, 19),
          night: getHourlySlot(data.hourly, dateValue, 22),
        },
      };
    });

    return NextResponse.json({
      location: "Cali, Colombia",
      source: "Open-Meteo",
      generatedAt: new Date().toISOString(),
      days,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown weather error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}