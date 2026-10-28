from datetime import date

import pytest

from travel_mcp import geo


def test_haversine_known_distance():
    # Los Angeles to Sydney is about 12,050 km.
    assert geo.haversine_km(34.05, -118.24, -33.87, 151.21) == pytest.approx(12_060, rel=0.01)


def test_haversine_same_point_is_zero():
    assert geo.haversine_km(35.0, 135.7, 35.0, 135.7) == 0


def test_suggested_mode_by_distance():
    assert geo.suggested_mode(1) == "walk"
    assert geo.suggested_mode(300) == "train, bus or car"
    assert geo.suggested_mode(5000) == "fly"


def test_flight_hours_include_taxi_and_climb():
    assert geo.flight_hours(780) == 1.5


def test_weather_window_uses_forecast_for_the_next_two_weeks():
    today = date(2026, 10, 28)
    assert geo.weather_window(date(2026, 11, 1), date(2026, 11, 4), today) == ("forecast", date(2026, 11, 1), date(2026, 11, 4))


def test_weather_window_uses_last_year_beyond_the_forecast():
    today = date(2026, 10, 28)
    source, start, end = geo.weather_window(date(2027, 3, 10), date(2027, 3, 14), today)
    assert source == "last_year"
    assert (start, end) == (date(2026, 3, 10), date(2026, 3, 14))


def test_weather_window_handles_leap_day():
    source, start, _ = geo.weather_window(date(2028, 2, 29), date(2028, 3, 2), date(2026, 10, 28))
    assert source == "last_year" and start.month == 2 and start.day == 28


def test_weather_window_rejects_long_or_backwards_ranges():
    with pytest.raises(ValueError):
        geo.weather_window(date(2026, 11, 5), date(2026, 11, 1), date(2026, 10, 28))
    with pytest.raises(ValueError):
        geo.weather_window(date(2026, 11, 1), date(2026, 11, 30), date(2026, 10, 28))


def test_describe_weather():
    assert geo.describe_weather(63) == "rain"
    assert geo.describe_weather(None) == "unknown"
