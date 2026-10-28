"""The Gemini adapter, with the SDK's real types but no network: a fake client returns canned responses."""

from types import SimpleNamespace

from google.genai import types

from planner.gemini import GeminiModel, declaration_schema
from planner.graph import SUBMIT_DEFINITION, ToolCall
from planner.itinerary import ITINERARY_SCHEMA


def model_answering(response: types.GenerateContentResponse) -> GeminiModel:
    async def generate_content(**kwargs):
        return response

    client = SimpleNamespace(aio=SimpleNamespace(models=SimpleNamespace(generate_content=generate_content)))
    return GeminiModel(client, "gemini-test", "Plan trips.", [SUBMIT_DEFINITION])


def answer(*parts: types.Part, finish: str = "STOP") -> types.GenerateContentResponse:
    return types.GenerateContentResponse(candidates=[
        types.Candidate(content=types.Content(role="model", parts=list(parts)), finish_reason=finish),
    ])


def test_declaration_schema_drops_keywords_gemini_rejects():
    trimmed = declaration_schema({
        "type": "object", "title": "weatherArguments", "additionalProperties": False,
        "properties": {"start_date": {"type": "string", "format": "date", "title": "Start Date", "description": "YYYY-MM-DD"}},
        "required": ["start_date"],
    })
    assert trimmed == {
        "type": "object",
        "properties": {"start_date": {"type": "string", "description": "YYYY-MM-DD"}},
        "required": ["start_date"],
    }


def test_declaration_schema_keeps_property_names_that_look_like_keywords():
    # A property *called* "title" is data, not the "title" keyword.
    trimmed = declaration_schema(ITINERARY_SCHEMA)
    assert "title" in trimmed["properties"] and "additionalProperties" not in trimmed


def test_every_turn_must_call_a_function():
    config = model_answering(answer()).config
    assert config.tool_config.function_calling_config.mode == "ANY"
    assert [d.name for d in config.tools[0].function_declarations] == ["submit_itinerary"]


async def test_function_calls_become_tool_calls_and_the_turn_is_kept_as_is():
    call = types.Part(function_call=types.FunctionCall(id="c1", name="geocode", args={"query": "Kyoto"}),
                      thought_signature=b"sig")
    turn = await model_answering(answer(call)).turn([])

    assert turn.outcome == "calls"
    assert turn.calls == [ToolCall(id="c1", name="geocode", args={"query": "Kyoto"})]
    assert turn.message.parts[0].thought_signature == b"sig"  # Gemini needs its signatures back


async def test_safety_stops_and_malformed_calls():
    assert (await model_answering(answer(finish="SAFETY")).turn([])).outcome == "declined"
    assert (await model_answering(answer(finish="MALFORMED_FUNCTION_CALL")).turn([])).outcome == "malformed"
    assert (await model_answering(answer(finish="MAX_TOKENS")).turn([])).outcome == "too_long"
    blocked = types.GenerateContentResponse(prompt_feedback=types.GenerateContentResponsePromptFeedback(block_reason="SAFETY"))
    assert (await model_answering(blocked).turn([])).outcome == "declined"


def test_tool_results_answer_each_call_by_id_and_name():
    content = model_answering(answer()).tool_results([(ToolCall(id="c1", name="geocode", args={}), {"result": "ok"})])
    assert content.role == "user"  # the API rejects "tool"
    response = content.parts[0].function_response
    assert (response.id, response.name, response.response) == ("c1", "geocode", {"result": "ok"})
