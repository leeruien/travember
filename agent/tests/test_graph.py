"""The ReAct loop, driven by a scripted stand-in for the model so it runs offline and costs nothing."""

import json

from planner.graph import MAX_TURNS, RECURSION_LIMIT, SUBMIT_TOOL, ModelTurn, ToolCall, build_graph, initial_state

ITINERARY = {
    "title": "Two days in Kyoto",
    "country": "Japan",
    "summary": "Temples one day, gardens the next.",
    "start_date": "2026-11-10",
    "end_date": "2026-11-11",
    "getting_there": "Shinkansen from Tokyo, about 2h15.",
    "days": [{
        "date": "2026-11-10",
        "theme": "Temples",
        "weather": "Clear, 16°C",
        "stops": [{"name": "Kiyomizu-dera", "lat": 34.9949, "lng": 135.785, "time": "Morning", "description": "Go early."}],
    }],
    "tips": ["Buy an IC card."],
}


def calls(*calls: ToolCall) -> ModelTurn:
    return ModelTurn(message={"role": "model", "calls": list(calls)}, calls=list(calls), outcome="calls")


def geocode(id: str, query: str) -> ToolCall:
    return ToolCall(id=id, name="geocode", args={"query": query})


def submit(itinerary: dict) -> ToolCall:
    return ToolCall(id="done", name=SUBMIT_TOOL, args=itinerary)


class ScriptedModel:
    """Answers with the scripted turns in order, and records the conversation it was sent each time."""

    def __init__(self, *turns: ModelTurn):
        self.turns = list(turns)
        self.seen: list[list] = []

    async def turn(self, messages):
        self.seen.append(list(messages))
        return self.turns.pop(0)

    def user_message(self, text):
        return {"role": "user", "text": text}

    def tool_results(self, results):
        return {"role": "tool", "results": [(call.id, result) for call, result in results]}


class FakeTools:
    definitions = [{"name": "geocode", "description": "", "input_schema": {"type": "object"}}]

    def __init__(self):
        self.calls = []

    def check(self, name, args):
        if name != "geocode":
            return [f"There is no tool called {name!r}."]
        return [] if isinstance(args.get("query"), str) else ["'query' is a required property"]

    async def call(self, name, args):
        self.calls.append(args["query"])
        return json.dumps({"matches": [{"name": args["query"], "lat": 34.99, "lng": 135.78}]}), False


async def run(model, tools=None):
    graph = build_graph(model, tools or FakeTools())
    return await graph.ainvoke(initial_state(model, "Two days in Kyoto", "2026-10-28"), {"recursion_limit": RECURSION_LIMIT})


async def test_reason_act_observe_then_submit():
    model = ScriptedModel(calls(geocode("a", "Kiyomizu-dera"), geocode("b", "Gion")), calls(submit(ITINERARY)))
    tools = FakeTools()
    state = await run(model, tools)

    assert state["error"] is None
    assert state["itinerary"]["title"] == "Two days in Kyoto"
    assert tools.calls == ["Kiyomizu-dera", "Gion"]
    # Both results went back together, in one message, matched to their calls by id.
    results = model.seen[1][-1]
    assert results["role"] == "tool" and [r[0] for r in results["results"]] == ["a", "b"]
    # The model's own turn went back exactly as it came.
    assert model.seen[1][1]["role"] == "model"


async def test_invalid_tool_input_is_returned_as_an_error_not_run():
    model = ScriptedModel(calls(ToolCall(id="a", name="geocode", args={"q": "typo"})), calls(submit(ITINERARY)))
    tools = FakeTools()
    await run(model, tools)

    assert tools.calls == []
    _, result = model.seen[1][-1]["results"][0]
    assert "INVALID_INPUT" in result["error"]


async def test_an_itinerary_that_breaks_the_schema_goes_back_to_be_fixed():
    model = ScriptedModel(calls(submit({"title": "Kyoto"})), calls(submit(ITINERARY)))
    state = await run(model)

    _, result = model.seen[1][-1]["results"][0]
    assert "doesn't fit the format" in result["error"]
    assert state["itinerary"] == ITINERARY


async def test_a_text_answer_is_nudged_towards_submitting():
    model = ScriptedModel(ModelTurn(message={"role": "model"}, calls=[], outcome="text"), calls(submit(ITINERARY)))
    state = await run(model)

    assert SUBMIT_TOOL in model.seen[1][-1]["text"]
    assert state["itinerary"] == ITINERARY


async def test_a_blocked_request_ends_without_running_anything():
    tools = FakeTools()
    state = await run(ScriptedModel(ModelTurn(message=None, calls=[], outcome="declined")), tools)

    assert tools.calls == []
    assert state["itinerary"] is None and "declined" in state["error"]


async def test_gives_up_after_max_turns():
    endless = [calls(geocode(str(i), "Kyoto")) for i in range(MAX_TURNS)]
    state = await run(ScriptedModel(*endless))
    assert state["turns"] == MAX_TURNS and "steps" in state["error"]
