export type DecisionStatus = "Open" | "Locked";

export type OptionCategory =
  | "food"
  | "bar"
  | "club"
  | "live music"
  | "activity"
  | "other";

export type TripOption = {
  id: string;
  title: string;
  description: string;
  category: OptionCategory;
  url?: string;
  mapsUrl?: string;
  suggestedBy: string;
  votes: string[];
};

export type TripDecision = {
  id: string;
  title: string;
  description: string;
  dateLabel: string;
  timeLabel: string;
  status: DecisionStatus;
  options: TripOption[];
};

export type FlightLeg = {
  id: string;
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
};

export type TripDetails = {
  title: string;
  subtitle: string;
  dates: string;
  apartmentAddress: string;
apartmentMapsUrl?: string;
  photosUrl: string;
  heroImagePath: string;
  attendees: string[];
  flights: FlightLeg[];
};

export const optionCategories: OptionCategory[] = [
  "food",
  "bar",
  "club",
  "live music",
  "activity",
  "other",
];

export const tripDetails: TripDetails = {
  title: "Cali Weekend Planner",
  subtitle: "A simple group plan for food, drinks, salsa, rooftops, and one proper Saturday night party.",
  dates: "June 11 to June 14, 2026",
  apartmentAddress: "Passiflora Luxury Suites, Normandía, Av. 4a Oe. #5-125, Apt 205, Normandia Sebastian de Belalcazar, Cali, Valle del Cauca",
apartmentMapsUrl: "https://maps.app.goo.gl/w4suiw2bmCpeermW6",
  photosUrl: "https://photos.app.goo.gl/gP95oBDz7hfKkgks9",
  heroImagePath: "/cali-hero.jpg",
  attendees: ["Will", "Paula", "Vane", "Josh"],
  flights: [
    {
      id: "flight-bog-cali",
      title: "Flight to Cali",
      date: "June 11, 2026",
      airline: "LATAM",
      flightNumber: "LA4077",
      departTime: "5:00 p.m.",
      departCity: "Bogotá",
      departAirport: "BOG",
      arriveTime: "6:05 p.m.",
      arriveCity: "Cali",
      arriveAirport: "CLO",
    },
    {
      id: "flight-cali-bog",
      title: "Flight back to Bogotá",
      date: "June 14, 2026",
      airline: "LATAM",
      flightNumber: "LA4082",
      departTime: "8:05 p.m.",
      departCity: "Cali",
      departAirport: "CLO",
      arriveTime: "9:10 p.m.",
      arriveCity: "Bogotá",
      arriveAirport: "BOG",
    },
  ],
};

export const initialDecisions: TripDecision[] = [
  {
    id: "thu-dinner",
    title: "Thursday dinner",
    description: "Arrive, settle in, have some apartment drinks while getting ready, then start the weekend with a proper dinner.",
    dateLabel: "Thursday, June 11",
    timeLabel: "Dinner",
    status: "Open",
    options: [
      {
        id: "thu-dinner-platillos",
        title: "Platillos Voladores",
        description: "First-night dinner after arrival. Nice, memorable, and easy enough before going out.",
        category: "food",
        suggestedBy: "Will",
        votes: [],
      },
    ],
  },
  {
    id: "thu-night",
    title: "Thursday night",
    description: "Classic Cali first night after dinner.",
    dateLabel: "Thursday, June 11",
    timeLabel: "Night",
    status: "Open",
    options: [
      {
        id: "thu-night-la-topa",
        title: "La Topa Tolondra",
        description: "The classic Cali salsa intro after Platillos.",
        category: "club",
        url: "https://www.instagram.com/la_topa_tolondra",
        suggestedBy: "Will",
        votes: [],
      },
    ],
  },
  {
    id: "fri-afternoon",
    title: "Friday afternoon drinks",
    description: "Pre-drinks first, then somewhere with a view if the weather is good.",
    dateLabel: "Friday, June 12",
    timeLabel: "Afternoon",
    status: "Open",
    options: [
      {
        id: "fri-afternoon-view-drinks",
        title: "Drinks with a view",
        description: "Start with apartment pre-drinks, then go somewhere outside or rooftop-ish if it is sunny.",
        category: "bar",
        suggestedBy: "Will",
        votes: [],
      },
    ],
  },
  {
    id: "fri-dinner-game",
    title: "Friday dinner + USA game",
    description: "Find somewhere showing USA vs Paraguay. Cantina La 15 is the likely first choice if they will show it.",
    dateLabel: "Friday, June 12",
    timeLabel: "Dinner / game",
    status: "Open",
    options: [
      {
        id: "fri-dinner-cantina-la-15",
        title: "Cantina La 15 for USA vs Paraguay",
        description: "Dinner spot if they are showing the USA World Cup game. Need to confirm before locking it in.",
        category: "food",
        suggestedBy: "Will",
        votes: [],
      },
    ],
  },
  {
    id: "fri-night",
    title: "Friday night out",
    description: "Main Friday night plan after the USA game.",
    dateLabel: "Friday, June 12",
    timeLabel: "Night",
    status: "Open",
    options: [
      {
        id: "fri-night-la-pergola",
        title: "La Pérgola Clandestina",
        description: "Friday night party plan after dinner and the USA game.",
        category: "club",
        url: "https://www.instagram.com/lapergolaclandestina",
        suggestedBy: "Will",
        votes: [],
      },
    ],
  },
  {
    id: "sat-brunch",
    title: "Saturday brunch",
    description: "Slow Saturday start before an easy city walk and Saturday night party.",
    dateLabel: "Saturday, June 13",
    timeLabel: "Brunch",
    status: "Open",
    options: [
      {
        id: "sat-brunch-mascabado",
        title: "Mascabado",
        description: "Main Saturday brunch plan.",
        category: "food",
        suggestedBy: "Will",
        votes: [],
      },
    ],
  },
  {
    id: "sat-daytime",
    title: "Saturday daytime",
    description: "Boozy city walking, snacks, ice cream, and easy sightseeing before heading back to change.",
    dateLabel: "Saturday, June 13",
    timeLabel: "Daytime",
    status: "Open",
    options: [
      {
        id: "sat-day-boozy-city-walk",
        title: "Boozy city walk + easy sightseeing",
        description: "Ice cream, Boulevard del Río, Trompeta Jairo Varela, Canchas Panamericanas for cholao, and whatever else feels easy. No museum plan for now.",
        category: "activity",
        suggestedBy: "Will",
        votes: [],
      },
    ],
  },
  {
    id: "sat-dinner",
    title: "Saturday dinner",
    description: "Keep dinner casual and convenient before heading to Praia Club.",
    dateLabel: "Saturday, June 13",
    timeLabel: "Dinner",
    status: "Open",
    options: [
      {
        id: "sat-dinner-near-pergola",
        title: "Casual dinner near La Pérgola",
        description: "Easy dinner before getting ready for La Viniliza at Praia Club.",
        category: "food",
        suggestedBy: "Will",
        votes: [],
      },
    ],
  },
  {
    id: "sat-night",
    title: "Saturday night",
    description: "Main Saturday night event. Everyone needs to register.",
    dateLabel: "Saturday, June 13",
    timeLabel: "Night",
    status: "Open",
    options: [
      {
        id: "sat-night-la-viniliza",
        title: "La Viniliza en Praia Club",
        description: "Saturday night party plan. Action item: everyone needs to register on Eventbrite.",
        category: "club",
        url: "https://www.eventbrite.co/e/la-viniliza-en-praia-club-sabado-13-de-junio-tickets-1991254857883",
        suggestedBy: "Will",
        votes: [],
      },
    ],
  },
  {
    id: "sun-brunch",
    title: "Sunday brunch / recovery",
    description: "Check out, brunch somewhere, and go with the flow before the flight back to Bogotá.",
    dateLabel: "Sunday, June 14",
    timeLabel: "Brunch / afternoon",
    status: "Open",
    options: [
      {
        id: "sun-brunch-go-with-flow",
        title: "Brunch somewhere + go with the flow",
        description: "Keep Sunday flexible around checkout, bags, food, and airport timing.",
        category: "food",
        suggestedBy: "Will",
        votes: [],
      },
    ],
  },
];