"""The MCP server, connected in-process: what the model sees, and the tools that need no network."""

import json

import httpx
from mcp import Client

from planner.graph import McpToolBox
from travel_mcp import server as travel


# Each test opens its own client: the connection must close in the task that opened it, which a
# pytest-asyncio fixture doesn't guarantee.


async def test_lists_all_tools_with_schemas():
    async with Client(travel.server) as client:
        tools = (await client.list_tools()).tools
    assert {t.name for t in tools} == {"geocode", "weather", "places_nearby", "travel_time", "estimate_flight", "travember_pages"}
    assert all(t.description and t.input_schema["type"] == "object" for t in tools)


async def test_toolbox_definitions_are_sorted_and_checked():
    async with Client(travel.server) as client:
        box = McpToolBox(client, (await client.list_tools()).tools)
    names = [d["name"] for d in box.definitions]
    assert names == sorted(names)
    assert box.check("geocode", {"query": "Kyoto"}) == []
    assert box.check("geocode", {}) != []
    assert box.check("teleport", {}) != []


async def test_estimate_flight():
    async with Client(travel.server) as client:
        result = await client.call_tool("estimate_flight", {"from_lat": 34.05, "from_lng": -118.24, "to_lat": -33.87, "to_lng": 151.21})
    data = json.loads(result.content[0].text)
    assert not result.is_error
    assert data["suggested_mode"] == "fly" and 15 < data["typical_direct_flight_hours"] < 17


async def test_out_of_range_coordinates_are_rejected():
    async with Client(travel.server) as client:
        result = await client.call_tool("estimate_flight", {"from_lat": 999, "from_lng": 0, "to_lat": 0, "to_lng": 0})
    assert result.is_error


async def test_travember_pages_matches_places_and_trims_notes(monkeypatch):
    book = {
        "id": "b1", "title": "Around Japan", "authorName": "Mei",
        "chapters": [{
            "id": "c1", "title": "Autumn in Kyoto", "country": "Japan",
            "places": [
                {"id": "p1", "name": "Fushimi Inari", "latitude": 34.97, "longitude": 135.77, "visitedOn": "2025-11-02",
                 "note": "x" * 500, "likeCount": 3},
                {"id": "p2", "name": "Arashiyama", "latitude": 35.01, "longitude": 135.67, "visitedOn": None,
                 "note": None, "likeCount": 9},
            ],
        }],
    }

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/api/books":
            return httpx.Response(200, json=[{"id": "b1"}])
        return httpx.Response(200, json=book)

    monkeypatch.setattr(travel, "_http", httpx.AsyncClient(transport=httpx.MockTransport(handler)))
    async with Client(travel.server) as client:
        result = await client.call_tool("travember_pages", {"query": "kyoto"})
    pages = json.loads(result.content[0].text)["pages"]

    assert [p["place"] for p in pages] == ["Arashiyama", "Fushimi Inari"]  # most liked first
    assert len(pages[1]["note"]) == 301 and pages[1]["link"].endswith("/chapters/c1/pages/p1")
