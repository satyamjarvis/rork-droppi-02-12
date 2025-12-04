import herzliyaData from "../../constants/herzliya-streets.json";
import ramatHasharonData from "../../constants/ramat-hasharon-streets.json";

type StreetDataset = {
  city: string;
  streets: string[];
};

const herzliya = herzliyaData as StreetDataset;
const ramatHasharon = ramatHasharonData as StreetDataset;

export const streetsStore = {
  herzliya: herzliya.streets,
  ramatHasharon: ramatHasharon.streets,
} as const;

export const streetCityLabels = {
  herzliya: herzliya.city,
  ramatHasharon: ramatHasharon.city,
} as const;

export type StreetCityKey = keyof typeof streetsStore;
