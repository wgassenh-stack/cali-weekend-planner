import { NextResponse } from "next/server";

type TripWeatherDay = {
  date: string;
  locationName: string;
  latitude: number;
  longitude: number;
};

type OpenMeteoDaily = {
  time?: string[];
  weather_code?: number[];
  temperature_2m_max?: number[];
  temperature_2m_min?: number[];
  precipitation_probability_max?: number[];
  precipitation_sum?: number[];
  wind_speed_10m_max?: number[];
  uv_index_max?: number[];
};

type OpenMeteoHourly = {
  time?: string[];
  temperature_2m?: number[];
  precipitation_probability?: number[];
  precipitation?: number[];
  weather_code?: number[];
  wind_speed_10m?: number[];
};

type OpenMeteoResponse = {
  daily?: OpenMeteoDaily;
  hourly?: OpenMeteoHourly;
};

type WeatherCondition = {
  label: string;
  emoji: string;
  rainy: boolean;
};

type PeriodName = "Morning" | "Afternoon" | "Evening";

type PeriodWeather = {
  name: PeriodName;
  timeRange: string;
  temperature: number | null;
  rainChance: number | null;
  wind: number | null;
  condition: string;
  emoji: string;
  note: string;
};

const tripWeatherDays: Record<string, TripWeatherDay> = {
  "may-15": {
    date: "2026-05-15",
    locationName: "Lisbon",
    latitude: 38.7223,
    longitude: -9.1393,
  },
  "may-16": {
    date: "2026-05-16",
    locationName: "Lisbon",
    latitude: 38.7223,
    longitude: -9.1393,
  },
  "may-17": {
    date: "2026-05-17",
    locationName: "Lisbon",
    latitude: 38.7223,
    longitude: -9.1393,
  },
  "may-18": {
    date: "2026-05-18",
    locationName: "Lisbon",
    latitude: 38.7223,
    longitude: -9.1393,
  },
  "may-19": {
    date: "2026-05-19",
    locationName: "Lisbon",
    latitude: 38.7223,
    longitude: -9.1393,
  },
  "may-20": {
    date: "2026-05-20",
    locationName: "Lisbon",
    latitude: 38.7223,
    longitude: -9.1393,
  },
  "may-21": {
    date: "2026-05-21",
    locationName: "Ponta Delgada",
    latitude: 37.7412,
    longitude: -25.6756,
  },
  "may-22": {
    date: "2026-05-22",
    locationName: "São Miguel",
    latitude: 37.7412,
    longitude: -25.6756,
  },
  "may-23": {
    date: "2026-05-23",
    locationName: "São Miguel",
    latitude: 37.7412,
    longitude: -25.6756,
  },
  "may-24": {
    date: "2026-05-24",
    locationName: "São Miguel",
    latitude: 37.7412,
    longitude: -25.6756,
  },
  "may-25": {
    date: "2026-05-25",
    locationName: "Ponta Delgada",
    latitude: 37.7412,
    longitude: -25.6756,
  },
};

const periods: {
  name: PeriodName;
  timeRange: string;
  startHour: number;
  endHour: number;
}[] = [
  { name: "Morning", timeRange: "8-11 AM", startHour: 8, endHour: 11 },
  { name: "Afternoon", timeRange: "12-5 PM", startHour: 12, endHour: 17 },
  { name: "Evening", timeRange: "6-10 PM", startHour: 18, endHour: 22 },
];

function roundNumber(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  return Math.round(value);
}

function isNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && !Number.isNaN(value);
}

function getMax(values: Array<number | null | undefined>) {
  const validValues = values.filter(isNumber);
  if (validValues.length === 0) return null;
  return Math.max(...validValues);
}

function getMin(values: Array<number | null | undefined>) {
  const validValues = values.filter(isNumber);
  if (validValues.length === 0) return null;
  return Math.min(...validValues);
}

function getHourlyIndexesForDay(hourly: OpenMeteoHourly, dayDate: string) {
  return (hourly.time ?? []).reduce<number[]>((matchingIndexes, time, index) => {
    if (time.startsWith(`${dayDate}T`)) {
      matchingIndexes.push(index);
    }

    return matchingIndexes;
  }, []);
}

function getWeatherSeverity(weatherCode: number | null) {
  if (weatherCode === null) return -1;
  if ([95, 96, 99].includes(weatherCode)) return 6;
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(weatherCode)) return 5;
  if ([51, 53, 55, 56, 57].includes(weatherCode)) return 4;
  if ([45, 48].includes(weatherCode)) return 3;
  if (weatherCode === 3) return 2;
  if ([1, 2].includes(weatherCode)) return 1;
  if (weatherCode === 0) return 0;
  return 1;
}

function getMostImportantWeatherCode(codes: Array<number | null>) {
  const validCodes = codes.filter((code): code is number => code !== null);

  if (validCodes.length === 0) {
    return null;
  }

  return validCodes.reduce((bestCode, currentCode) => {
    return getWeatherSeverity(currentCode) > getWeatherSeverity(bestCode)
      ? currentCode
      : bestCode;
  }, validCodes[0]);
}

function getCondition(
  weatherCode: number | null,
  rainChance: number | null,
  rainTotal: number | null
): WeatherCondition {
  const lowRainChance = rainChance !== null && rainChance < 35;
  const mediumRainChance = rainChance !== null && rainChance < 55;
  const tinyRainTotal = rainTotal !== null && rainTotal < 0.05;

  if (weatherCode === null) {
    return { label: "Forecast pending", emoji: "🌤️", rainy: false };
  }

  if (weatherCode === 0) {
    return { label: "Clear", emoji: "☀️", rainy: false };
  }

  if ([1, 2].includes(weatherCode)) {
    return { label: "Mostly sunny", emoji: "🌤️", rainy: false };
  }

  if (weatherCode === 3) {
    return { label: "Cloudy", emoji: "☁️", rainy: false };
  }

  if ([45, 48].includes(weatherCode)) {
    return { label: "Foggy", emoji: "🌫️", rainy: false };
  }

  if ([51, 53, 55, 56, 57].includes(weatherCode)) {
    if (lowRainChance || tinyRainTotal) {
      return { label: "Possible light shower", emoji: "🌦️", rainy: true };
    }

    return { label: "Drizzle possible", emoji: "🌦️", rainy: true };
  }

  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(weatherCode)) {
    if (lowRainChance || tinyRainTotal) {
      return { label: "Possible shower", emoji: "🌦️", rainy: true };
    }

    if (mediumRainChance) {
      return { label: "Showers possible", emoji: "🌦️", rainy: true };
    }

    return { label: "Rain likely", emoji: "🌧️", rainy: true };
  }

  if ([95, 96, 99].includes(weatherCode)) {
    return { label: "Thunderstorms possible", emoji: "⛈️", rainy: true };
  }

  return { label: "Mixed conditions", emoji: "🌤️", rainy: false };
}

function getWeatherSummary({
  condition,
  high,
  low,
  rainChance,
  wind,
}: {
  condition: WeatherCondition;
  high: number | null;
  low: number | null;
  rainChance: number | null;
  wind: number | null;
}) {
  const temperatureText =
    high !== null && low !== null ? `${high}° / ${low}°F` : "temps pending";
  const rainText =
    rainChance !== null ? `, ${rainChance}% rain chance` : ", rain chance pending";
  const windText = wind !== null && wind >= 18 ? ", breezy" : "";

  return `${condition.label}, ${temperatureText}${rainText}${windText}.`;
}

function getWearSuggestion({
  condition,
  high,
  low,
  rainChance,
  wind,
  uvIndex,
}: {
  condition: WeatherCondition;
  high: number | null;
  low: number | null;
  rainChance: number | null;
  wind: number | null;
  uvIndex: number | null;
}) {
  const suggestions = ["comfortable walking shoes"];

  if (high !== null && high >= 76) {
    suggestions.push("light breathable clothes");
  } else {
    suggestions.push("light layers");
  }

  if (low !== null && low <= 62) {
    suggestions.push("a light jacket for morning or dinner");
  }

  if (condition.rainy || (rainChance !== null && rainChance >= 35)) {
    suggestions.push("a compact rain jacket or umbrella");
  }

  if (wind !== null && wind >= 18) {
    suggestions.push("something wind-friendly for exposed viewpoints or boat time");
  }

  if (uvIndex !== null && uvIndex >= 6) {
    suggestions.push("sunscreen and sunglasses");
  }

  return `${suggestions.join(", ")}.`;
}

function getPeriodNote({
  temperature,
  rainChance,
  wind,
  condition,
}: {
  temperature: number | null;
  rainChance: number | null;
  wind: number | null;
  condition: WeatherCondition;
}) {
  const notes: string[] = [];

  if (temperature !== null && temperature >= 76) {
    notes.push("light clothes");
  } else if (temperature !== null && temperature >= 65) {
    notes.push("light layers");
  } else {
    notes.push("bring a light jacket");
  }

  if (condition.rainy || (rainChance !== null && rainChance >= 35)) {
    notes.push("rain layer handy");
  }

  if (wind !== null && wind >= 18) {
    notes.push("expect some breeze");
  }

  return notes.join(", ");
}

function buildPeriodWeather(
  period: {
    name: PeriodName;
    timeRange: string;
    startHour: number;
    endHour: number;
  },
  hourly: OpenMeteoHourly,
  dayDate: string
): PeriodWeather {
  const timeValues = hourly.time ?? [];

  const periodIndexes = timeValues.reduce<number[]>((matchingIndexes, time, index) => {
    if (!time.startsWith(`${dayDate}T`)) {
      return matchingIndexes;
    }

    const hour = Number(time.slice(11, 13));

    if (hour >= period.startHour && hour <= period.endHour) {
      matchingIndexes.push(index);
    }

    return matchingIndexes;
  }, []);

  const temperatures = periodIndexes.map((index) => hourly.temperature_2m?.[index]);
  const rainChances = periodIndexes.map(
    (index) => hourly.precipitation_probability?.[index]
  );
  const rainTotals = periodIndexes.map((index) => hourly.precipitation?.[index]);
  const winds = periodIndexes.map((index) => hourly.wind_speed_10m?.[index]);
  const weatherCodes = periodIndexes.map((index) =>
    roundNumber(hourly.weather_code?.[index])
  );

  const temperature = roundNumber(getMax(temperatures));
  const rainChance = roundNumber(getMax(rainChances));
  const rainTotal = getMax(rainTotals);
  const wind = roundNumber(getMax(winds));
  const weatherCode = getMostImportantWeatherCode(weatherCodes);
  const condition = getCondition(weatherCode, rainChance, rainTotal);

  return {
    name: period.name,
    timeRange: period.timeRange,
    temperature,
    rainChance,
    wind,
    condition: condition.label,
    emoji: condition.emoji,
    note: getPeriodNote({
      temperature,
      rainChance,
      wind,
      condition,
    }),
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dayId = searchParams.get("dayId") || "";
  const day = tripWeatherDays[dayId];

  if (!day) {
    return NextResponse.json({ error: "Unknown trip day." }, { status: 400 });
  }

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(day.latitude));
  url.searchParams.set("longitude", String(day.longitude));
  url.searchParams.set(
    "daily",
    [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_probability_max",
      "precipitation_sum",
      "wind_speed_10m_max",
      "uv_index_max",
    ].join(",")
  );
  url.searchParams.set(
    "hourly",
    [
      "temperature_2m",
      "precipitation_probability",
      "precipitation",
      "weather_code",
      "wind_speed_10m",
    ].join(",")
  );
  url.searchParams.set("temperature_unit", "fahrenheit");
  url.searchParams.set("wind_speed_unit", "mph");
  url.searchParams.set("precipitation_unit", "inch");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", "16");

  try {
    const response = await fetch(url, {
      next: { revalidate: 60 * 60 * 3 },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Could not load weather from Open-Meteo." },
        { status: 502 }
      );
    }

    const data = (await response.json()) as OpenMeteoResponse;
    const daily = data.daily;
    const hourly = data.hourly;
    const dayIndex = daily?.time?.findIndex((date) => date === day.date) ?? -1;

    if (!daily || !hourly || dayIndex < 0) {
      return NextResponse.json({
        available: false,
        dayId,
        date: day.date,
        locationName: day.locationName,
        message:
          "Forecast will appear when this day is within Open-Meteo’s forecast window.",
      });
    }

    const hourlyIndexesForDay = getHourlyIndexesForDay(hourly, day.date);
    const hourlyTempsForDay = hourlyIndexesForDay.map(
      (index) => hourly.temperature_2m?.[index]
    );

    const dailyHigh = roundNumber(daily.temperature_2m_max?.[dayIndex]);
    const hourlyHigh = roundNumber(getMax(hourlyTempsForDay));
    const high = roundNumber(getMax([dailyHigh, hourlyHigh]));

    const dailyLow = roundNumber(daily.temperature_2m_min?.[dayIndex]);
    const hourlyLow = roundNumber(getMin(hourlyTempsForDay));
    const low = roundNumber(getMin([dailyLow, hourlyLow]));

    const weatherCode = roundNumber(daily.weather_code?.[dayIndex]);
    const rainChance = roundNumber(daily.precipitation_probability_max?.[dayIndex]);
    const rainTotal = daily.precipitation_sum?.[dayIndex] ?? null;
    const wind = roundNumber(daily.wind_speed_10m_max?.[dayIndex]);
    const uvIndex = roundNumber(daily.uv_index_max?.[dayIndex]);
    const condition = getCondition(weatherCode, rainChance, rainTotal);
    const periodForecasts = periods.map((period) =>
      buildPeriodWeather(period, hourly, day.date)
    );

    return NextResponse.json({
      available: true,
      dayId,
      date: day.date,
      locationName: day.locationName,
      condition: condition.label,
      emoji: condition.emoji,
      high,
      low,
      rainChance,
      rainTotal,
      wind,
      uvIndex,
      periods: periodForecasts,
      summary: getWeatherSummary({
        condition,
        high,
        low,
        rainChance,
        wind,
      }),
      wearSuggestion: getWearSuggestion({
        condition,
        high,
        low,
        rainChance,
        wind,
        uvIndex,
      }),
      source: "Open-Meteo",
    });
  } catch {
    return NextResponse.json(
      { error: "Weather service is temporarily unavailable." },
      { status: 500 }
    );
  }
}