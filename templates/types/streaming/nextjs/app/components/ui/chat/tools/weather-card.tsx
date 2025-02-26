import { getCustomAnnotation, useChatMessage } from "@llamaindex/chat-ui";
import { ChatEvents } from "@llamaindex/chat-ui/widgets";
import { useMemo } from "react";
import { z } from "zod";

export interface WeatherData {
  latitude: number;
  longitude: number;
  generationtime_ms: number;
  utc_offset_seconds: number;
  timezone: string;
  timezone_abbreviation: string;
  elevation: number;
  current_units: {
    time: string;
    interval: string;
    temperature_2m: string;
    weather_code: string;
  };
  current: {
    time: string;
    interval: number;
    temperature_2m: number;
    weather_code: number;
  };
  hourly_units: {
    time: string;
    temperature_2m: string;
    weather_code: string;
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    weather_code: number[];
  };
  daily_units: {
    time: string;
    weather_code: string;
  };
  daily: {
    time: string[];
    weather_code: number[];
  };
}

// Follow WMO Weather interpretation codes (WW)
const weatherCodeDisplayMap: Record<
  string,
  {
    icon: React.ReactNode;
    status: string;
  }
> = {
  "0": {
    icon: <span>☀️</span>,
    status: "Clear sky",
  },
  "1": {
    icon: <span>🌤️</span>,
    status: "Mainly clear",
  },
  "2": {
    icon: <span>☁️</span>,
    status: "Partly cloudy",
  },
  "3": {
    icon: <span>☁️</span>,
    status: "Overcast",
  },
  "45": {
    icon: <span>🌫️</span>,
    status: "Fog",
  },
  "48": {
    icon: <span>🌫️</span>,
    status: "Depositing rime fog",
  },
  "51": {
    icon: <span>🌧️</span>,
    status: "Drizzle",
  },
  "53": {
    icon: <span>🌧️</span>,
    status: "Drizzle",
  },
  "55": {
    icon: <span>🌧️</span>,
    status: "Drizzle",
  },
  "56": {
    icon: <span>🌧️</span>,
    status: "Freezing Drizzle",
  },
  "57": {
    icon: <span>🌧️</span>,
    status: "Freezing Drizzle",
  },
  "61": {
    icon: <span>🌧️</span>,
    status: "Rain",
  },
  "63": {
    icon: <span>🌧️</span>,
    status: "Rain",
  },
  "65": {
    icon: <span>🌧️</span>,
    status: "Rain",
  },
  "66": {
    icon: <span>🌧️</span>,
    status: "Freezing Rain",
  },
  "67": {
    icon: <span>🌧️</span>,
    status: "Freezing Rain",
  },
  "71": {
    icon: <span>❄️</span>,
    status: "Snow fall",
  },
  "73": {
    icon: <span>❄️</span>,
    status: "Snow fall",
  },
  "75": {
    icon: <span>❄️</span>,
    status: "Snow fall",
  },
  "77": {
    icon: <span>❄️</span>,
    status: "Snow grains",
  },
  "80": {
    icon: <span>🌧️</span>,
    status: "Rain showers",
  },
  "81": {
    icon: <span>🌧️</span>,
    status: "Rain showers",
  },
  "82": {
    icon: <span>🌧️</span>,
    status: "Rain showers",
  },
  "85": {
    icon: <span>❄️</span>,
    status: "Snow showers",
  },
  "86": {
    icon: <span>❄️</span>,
    status: "Snow showers",
  },
  "95": {
    icon: <span>⛈️</span>,
    status: "Thunderstorm",
  },
  "96": {
    icon: <span>⛈️</span>,
    status: "Thunderstorm",
  },
  "99": {
    icon: <span>⛈️</span>,
    status: "Thunderstorm",
  },
};

const displayDay = (time: string) => {
  return new Date(time).toLocaleDateString("en-US", {
    weekday: "long",
  });
};

export function WeatherCard({ data }: { data: WeatherData }) {
  const currentDayString = new Date(data.current.time).toLocaleDateString(
    "en-US",
    {
      weekday: "long",
      month: "long",
      day: "numeric",
    },
  );

  return (
    data && (
      <div className="bg-[#61B9F2] rounded-2xl shadow-xl p-5 space-y-4 text-white w-fit">
        <div className="flex justify-between">
          <div className="space-y-2">
            <div className="text-xl">{currentDayString}</div>
            <div className="text-5xl font-semibold flex gap-4">
              <span>
                {data.current.temperature_2m}{" "}
                {data.current_units.temperature_2m}
              </span>
              {weatherCodeDisplayMap[data.current.weather_code].icon}
            </div>
          </div>
          <span className="text-xl">
            {weatherCodeDisplayMap[data.current.weather_code].status}
          </span>
        </div>
        <div className="gap-2 grid grid-cols-6">
          {data.daily.time.map((time, index) => {
            if (index === 0) return null; // skip the current day
            return (
              <div key={time} className="flex flex-col items-center gap-4">
                <span>{displayDay(time)}</span>
                <div className="text-4xl">
                  {weatherCodeDisplayMap[data.daily.weather_code[index]].icon}
                </div>
                <span className="text-sm">
                  {weatherCodeDisplayMap[data.daily.weather_code[index]].status}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    )
  );
}

// A new component for the weather tool which uses the WeatherCard component with the new data schema from agent workflow events
const WeatherToolSchema = z.object({
  tool_name: z.literal("get_weather_information"),
  tool_kwargs: z.object({
    location: z.string(),
  }),
  tool_id: z.string(),
  tool_output: z.optional(
    z
      .object({
        content: z.string(),
        tool_name: z.string(),
        raw_input: z.record(z.unknown()),
        raw_output: z.custom<WeatherData>(),
        is_error: z.boolean().optional(),
      })
      .optional(),
  ),
  return_direct: z.boolean().optional(),
});

type WeatherTool = z.infer<typeof WeatherToolSchema>;

type GroupedWeatherQuery = {
  initial: WeatherTool;
  output?: WeatherTool;
};

export function WeatherToolComponent() {
  const { message } = useChatMessage();

  const weatherEvents = getCustomAnnotation<WeatherTool>(
    message.annotations,
    (annotation: unknown) => {
      const result = WeatherToolSchema.safeParse(annotation);
      return result.success;
    },
  );

  // Group events by tool_id
  const groupedWeatherQueries = useMemo(() => {
    const groups = new Map<string, GroupedWeatherQuery>();

    weatherEvents?.forEach((event: WeatherTool) => {
      groups.set(event.tool_id, { initial: event });
    });

    return Array.from(groups.values());
  }, [weatherEvents]);

  return (
    groupedWeatherQueries.length > 0 && (
      <div className="space-y-4">
        {groupedWeatherQueries.map(({ initial }) => {
          if (!initial.tool_output?.raw_output) {
            return (
              <ChatEvents
                key={initial.tool_id}
                data={[
                  {
                    title: `Loading weather information for ${initial.tool_kwargs.location}...`,
                  },
                ]}
                showLoading={true}
              />
            );
          }

          return (
            <WeatherCard
              key={initial.tool_id}
              data={initial.tool_output.raw_output as WeatherData}
            />
          );
        })}
      </div>
    )
  );
}
