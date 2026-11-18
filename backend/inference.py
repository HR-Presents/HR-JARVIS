"""Local inference adapters for Ollama, vLLM and llama.cpp."""
import os

PROVIDER = os.getenv("JARVIS_LLM_PROVIDER", "ollama").strip().lower()
if PROVIDER not in {"ollama", "vllm", "llamacpp"}:
    raise ValueError("Invalid JARVIS_LLM_PROVIDER")

OLLAMA_URL = os.getenv(
    "OLLAMA_URL", "http://127.0.0.1:11434"
).rstrip("/")

DEFAULT_URLS = {
    "vllm": "http://127.0.0.1:8101/v1",
    "llamacpp": "http://127.0.0.1:8080/v1",
}

BASE_URL = os.getenv(
    "JARVIS_LLM_BASE_URL",
    DEFAULT_URLS.get(PROVIDER, OLLAMA_URL),
).rstrip("/")


def request_spec(model, messages, tools):
    if PROVIDER == "ollama":
        return (
            f"{OLLAMA_URL}/api/chat",
            {
                "model": model,
                "messages": messages,
                "tools": tools,
                "stream": False,
                "think": False,
            },
        )

    return (
        f"{BASE_URL}/chat/completions",
        {
            "model": model,
            "messages": messages,
            # Prototype mode: vLLM was launched without automatic tool calling.
            # Preserve agent tool definitions for future integration.
            **({"tools": tools, "tool_choice": "auto"}
               if PROVIDER != "vllm" else {}),
            "stream": False,
            **(
                {"chat_template_kwargs": {"enable_thinking": False}}
                if PROVIDER == "vllm" else {}
            ),
        },
    )


def extract_message(payload):
    if PROVIDER == "ollama":
        return payload.get("message", {})
    choices = payload.get("choices") or []
    if not choices:
        raise ValueError("Inference server returned no choices")
    return choices[0].get("message") or {}


def assistant_message(answer, calls):
    message = {
        "role": "assistant",
        "content": answer.get("content") or "",
        "tool_calls": calls,
    }
    return message


def tool_result_message(call, result_json):
    if PROVIDER == "ollama":
        return {"role": "tool", "content": result_json}

    call_id = call.get("id")
    if not call_id:
        raise ValueError("OpenAI-compatible tool call has no ID")
    return {
        "role": "tool",
        "tool_call_id": call_id,
        "content": result_json,
    }
