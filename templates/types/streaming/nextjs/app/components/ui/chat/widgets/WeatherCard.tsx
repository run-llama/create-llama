interface WeatherData {
  name: string;
  latitute: number;
  longitude: number;
  temperature_unit: string;
  hourlyWeather: Record<
    string,
    {
      temperature: number;
      weather_code: string;
    }
  >;
}

const weatherCodeDisplayMap: Record<
  string,
  {
    icon: JSX.Element;
    status: string;
  }
> = {
  "01d": {
    icon: <span>☀️</span>,
    status: "Clear sky",
  },
  "01n": {
    icon: <span>🌙</span>,
    status: "Clear sky",
  },
  "02d": {
    icon: <span>🌤️</span>,
    status: "Few clouds",
  },
  "02n": {
    icon: <span>🌤️</span>,
    status: "Few clouds",
  },
  "03d": {
    icon: <span>☁️</span>,
    status: "Scattered clouds",
  },
  "03n": {
    icon: <span>☁️</span>,
    status: "Scattered clouds",
  },
  "04d": {
    icon: <span>☁️</span>,
    status: "Broken clouds",
  },
  "04n": {
    icon: <span>☁️</span>,
    status: "Broken clouds",
  },
  "09d": {
    icon: <span>🌧️</span>,
    status: "Shower rain",
  },
  "09n": {
    icon: <span>🌧️</span>,
    status: "Shower rain",
  },
  "10d": {
    icon: <span>🌦️</span>,
    status: "Rain",
  },
  "10n": {
    icon: <span>🌦️</span>,
    status: "Rain",
  },
  "11d": {
    icon: <span>🌩️</span>,
    status: "Thunderstorm",
  },
  "11n": {
    icon: <span>🌩️</span>,
    status: "Thunderstorm",
  },
  "13d": {
    icon: <span>❄️</span>,
    status: "Snow",
  },
  "13n": {
    icon: <span>❄️</span>,
    status: "Snow",
  },
  "50d": {
    icon: <span>🌫️</span>,
    status: "Mist",
  },
  "50n": {
    icon: <span>🌫️</span>,
    status: "Mist",
  },
};

export function WeatherCard({ data }: { data: WeatherData }) {
  const currentWeather = Object.values(data.hourlyWeather)[0];
  const currentDayString = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="bg-blue-400 rounded-md shadow-md space-y-4 max-w-[500px]">
      <div className="flex justify-between">
        <div className="space-y-2">
          <div className="text-xl">{currentDayString}</div>
          <div className="text-3xl">
            <span>
              {currentWeather.temperature} {data.temperature_unit}
            </span>
            <div>{weatherCodeDisplayMap[currentWeather.weather_code].icon}</div>
          </div>
        </div>
        <span className="text-xl">
          {weatherCodeDisplayMap[currentWeather.weather_code].status}
        </span>
      </div>
      <div className="flex gap-4">
        {Object.entries(data.hourlyWeather).map(([hour, weather]) => (
          <div key={hour} className="flex flex-col items-center">
            <span>{hour}</span>
            <span>{weatherCodeDisplayMap[weather.weather_code].icon}</span>
            <span>
              {weather.temperature} {data.temperature_unit}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
