"""The shape of a finished itinerary: the model hands it in as the arguments of `submit_itinerary`."""

from jsonschema import Draft202012Validator

_STOP = {
    "type": "object",
    "properties": {
        "name": {"type": "string", "description": "The place, as it should appear on a page"},
        "lat": {"type": "number"},
        "lng": {"type": "number"},
        "time": {"type": "string", "description": "When in the day, e.g. 'Morning' or '14:00'"},
        "description": {"type": "string", "description": "One or two sentences: what to do there and why"},
    },
    "required": ["name", "lat", "lng", "time", "description"],
    "additionalProperties": False,
}

_DAY = {
    "type": "object",
    "properties": {
        "date": {"type": "string", "description": "YYYY-MM-DD"},
        "theme": {"type": "string", "description": "A short title for the day"},
        "weather": {"type": "string", "description": "What the weather tool said for this day, briefly"},
        "stops": {"type": "array", "items": _STOP},
    },
    "required": ["date", "theme", "weather", "stops"],
    "additionalProperties": False,
}

ITINERARY_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string", "description": "A chapter title for the trip, e.g. 'Autumn in Kyoto'"},
        "country": {"type": "string"},
        "summary": {"type": "string", "description": "Two or three sentences on the shape of the trip"},
        "start_date": {"type": "string", "description": "YYYY-MM-DD"},
        "end_date": {"type": "string", "description": "YYYY-MM-DD"},
        "getting_there": {"type": "string", "description": "How to arrive, from the flight or travel tools"},
        "days": {"type": "array", "items": _DAY},
        "tips": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["title", "country", "summary", "start_date", "end_date", "getting_there", "days", "tips"],
    "additionalProperties": False,
}

_validator = Draft202012Validator(ITINERARY_SCHEMA)


def validation_errors(itinerary: object) -> list[str]:
    return [e.message for e in _validator.iter_errors(itinerary)]
