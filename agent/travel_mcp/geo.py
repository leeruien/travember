"""Pure helpers for the travel tools: distances, travel-time estimates and weather codes. No network here."""

from datetime import date, timedelta
from math import asin, cos, radians, sin, sqrt

EARTH_RADIUS_KM = 6371.0

# Open-Meteo's free forecast reaches this many days ahead (today included).
FORECAST_DAYS = 16

# Rough door-to-door speeds; a walk is longer than the straight line, so it gets a detour factor too.
WALK_KMH = 4.8
WALK_DETOUR = 1.3
CRUISE_KMH = 780
TAXI_AND_CLIMB_HOURS = 0.5


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance between two points."""
    p1, p2 = radians(lat1), radians(lat2)
    dp, dl = p2 - p1, radians(lng2 - lng1)
    a = sin(dp / 2) ** 2 + cos(p1) * cos(p2) * sin(dl / 2) ** 2
    return 2 * EARTH_RADIUS_KM * asin(sqrt(a))


def walking_minutes(distance_km: float) -> int:
    return round(distance_km * WALK_DETOUR / WALK_KMH * 60)


def flight_hours(distance_km: float) -> float:
    """Typical gate-to-gate time for a direct flight of this length."""
    return round(distance_km / CRUISE_KMH + TAXI_AND_CLIMB_HOURS, 1)


def suggested_mode(distance_km: float) -> str:
    if distance_km < 2:
        return "walk"
    if distance_km < 40:
        return "public transport or taxi"
    if distance_km < 500:
        return "train, bus or car"
    if distance_km < 900:
        return "fast train if there is one, otherwise fly"
    return "fly"


def weather_window(start: date, end: date, today: date) -> tuple[str, date, date]:
    """
    Decide where to get weather for a trip. Dates inside the forecast window get the forecast; anything
    later gets the same dates last year, as a guide to typical weather. Returns (source, start, end).
    """
    if end < start:
        raise ValueError("end_date is before start_date")
    if (end - start).days >= FORECAST_DAYS:
        raise ValueError(f"ask for at most {FORECAST_DAYS} days at a time")
    if start >= today and end < today + timedelta(days=FORECAST_DAYS):
        return "forecast", start, end
    # Shift by whole years until the window is safely in the past (the archive lags a few days).
    years = max(1, end.year - today.year)
    while True:
        try:
            s, e = start.replace(year=start.year - years), end.replace(year=end.year - years)
        except ValueError:  # 29 February
            s, e = start.replace(year=start.year - years, day=28), end.replace(year=end.year - years, day=28)
        if e < today - timedelta(days=7):
            return "last_year", s, e
        years += 1


# https://open-meteo.com/en/docs - WMO weather interpretation codes
WMO_CODES = {
    0: "clear sky", 1: "mainly clear", 2: "partly cloudy", 3: "overcast",
    45: "fog", 48: "freezing fog",
    51: "light drizzle", 53: "drizzle", 55: "heavy drizzle", 56: "freezing drizzle", 57: "freezing drizzle",
    61: "light rain", 63: "rain", 65: "heavy rain", 66: "freezing rain", 67: "freezing rain",
    71: "light snow", 73: "snow", 75: "heavy snow", 77: "snow grains",
    80: "light showers", 81: "showers", 82: "violent showers", 85: "snow showers", 86: "heavy snow showers",
    95: "thunderstorm", 96: "thunderstorm with hail", 99: "thunderstorm with heavy hail",
}


def describe_weather(code: int | None) -> str:
    return WMO_CODES.get(code, "unknown") if code is not None else "unknown"
