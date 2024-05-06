import { FunctionTool } from "llamaindex";

interface GeoLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

const getGeoLocation = async (location: string): Promise<GeoLocation> => {
  const apiUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${location}&count=10&language=en&format=json`;
  const response = await fetch(apiUrl);
  const data = await response.json();
  const { id, name, latitude, longitude } = data.results[0];
  return { id, name, latitude, longitude };
};

const getWeatherByLocation = async (location: string) => {
  console.log("Tool get_weather_information called with location: ", location);
  const geo = await getGeoLocation(location);
  const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${geo.latitude}&longitude=${geo.longitude}&hourly=temperature_2m`;
  const response = await fetch(apiUrl);
  const data = await response.json();
  return data;
};

export const getWeatherInformation = FunctionTool.from(
  ({ location }: { location: string }) => getWeatherByLocation(location),
  {
    name: "get_weather_information",
    description: "Use this function to get the weather of any given location",
    parameters: {
      type: "object",
      properties: {
        location: {
          type: "string",
          description: "The location to get the weather information",
        },
      },
      required: ["location"],
    },
  },
);
