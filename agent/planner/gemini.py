"""The planner's model: Google Gemini, through the official google-genai SDK."""

from typing import Any

from google import genai
from google.genai import types

from planner.graph import ModelTurn, ToolCall

# Gemini rejects some JSON Schema keywords in function declarations; the full schemas are still enforced
# on our side (planner.graph checks every call), so the model only needs the shape.
_KEPT_KEYWORDS = {
    "type", "properties", "required", "items", "description", "enum", "anyOf", "nullable",
    "minimum", "maximum", "minLength", "maxLength", "minItems", "maxItems",
}

_DECLINED = {"SAFETY", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII", "RECITATION"}
_MALFORMED = {"MALFORMED_FUNCTION_CALL", "UNEXPECTED_TOOL_CALL", "TOO_MANY_TOOL_CALLS"}


def declaration_schema(schema: Any) -> Any:
    """A JSON schema trimmed to the keywords Gemini accepts for function parameters."""
    if isinstance(schema, list):
        return [declaration_schema(s) for s in schema]
    if not isinstance(schema, dict):
        return schema
    out = {}
    for key, value in schema.items():
        if key == "properties":
            out[key] = {name: declaration_schema(prop) for name, prop in value.items()}
        elif key in _KEPT_KEYWORDS:
            out[key] = declaration_schema(value)
    return out


def _name(value: Any) -> str:
    return getattr(value, "value", None) or str(value or "")


class GeminiModel:
    def __init__(self, client: genai.Client, model: str, system_prompt: str, tool_definitions: list[dict]):
        self.client = client
        self.model = model
        # Built once: every request sends exactly the same instructions and tools.
        self.config = types.GenerateContentConfig(
            system_instruction=system_prompt,
            tools=[types.Tool(function_declarations=[
                types.FunctionDeclaration(
                    name=t["name"],
                    description=t["description"],
                    parameters_json_schema=declaration_schema(t["input_schema"]),
                )
                for t in tool_definitions
            ])],
            # Every turn must be a function call; the plan ends with a call to submit_itinerary.
            tool_config=types.ToolConfig(function_calling_config=types.FunctionCallingConfig(mode="ANY")),
            # The graph runs the tools itself, so the SDK mustn't try to.
            automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
        )

    async def turn(self, messages: list) -> ModelTurn:
        response = await self.client.aio.models.generate_content(model=self.model, contents=messages, config=self.config)
        if response.prompt_feedback and response.prompt_feedback.block_reason:
            return ModelTurn(message=None, calls=[], outcome="declined")
        candidate = response.candidates[0] if response.candidates else None
        if candidate is None:
            return ModelTurn(message=None, calls=[], outcome="declined")

        reason = _name(candidate.finish_reason)
        content = candidate.content
        parts = (content.parts if content else None) or []
        calls = [
            ToolCall(id=p.function_call.id, name=p.function_call.name, args=dict(p.function_call.args or {}))
            for p in parts if p.function_call
        ]
        # The turn goes back unchanged, thought signatures and all, which Gemini needs to keep its reasoning.
        message = content if parts else None
        if reason in _DECLINED:
            return ModelTurn(message=None, calls=[], outcome="declined")
        if reason == "MAX_TOKENS":
            return ModelTurn(message=None, calls=[], outcome="too_long")
        if reason in _MALFORMED:
            return ModelTurn(message=None, calls=[], outcome="malformed")
        return ModelTurn(message=message, calls=calls, outcome="calls" if calls else "text")

    def user_message(self, text: str) -> types.Content:
        return types.Content(role="user", parts=[types.Part.from_text(text=text)])

    def tool_results(self, results: list[tuple[ToolCall, dict]]) -> types.Content:
        # Function responses go back as a "user" turn: the API rejects role "tool" (400 INVALID_ARGUMENT).
        return types.Content(role="user", parts=[
            types.Part(function_response=types.FunctionResponse(id=call.id, name=call.name, response=result))
            for call, result in results
        ])
