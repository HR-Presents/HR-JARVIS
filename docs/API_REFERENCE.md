# J.A.R.V.I.S. API Reference

Generated from the actual FastAPI application.

Base URL: http://127.0.0.1:8100

Interactive documentation: http://127.0.0.1:8100/docs

## Endpoints

| Method | Endpoint |
|---|---|
| GET | `/api/health` |
| POST | `/api/chat` |
| POST | `/api/chat/stream` |
| GET | `/api/agent/status` |
| POST | `/api/agent/chat` |
| GET | `/api/agent/approvals` |
| GET | `/api/agent/approvals/{approval_id}` |
| POST | `/api/agent/approvals/{approval_id}/reject` |
| POST | `/api/agent/approvals/{approval_id}/approve` |
| GET | `/api/memory/status` |
| GET | `/api/memory/conversations` |
| GET | `/api/memory/conversations/{conversation_id}` |
| DELETE | `/api/memory/conversations/{conversation_id}` |
| POST | `/api/memory/chat` |
| GET | `/api/research/status` |
| POST | `/api/research/search` |
| POST | `/api/research/answer` |
| GET | `/api/coding/status` |
| POST | `/api/coding/diagnose` |
| POST | `/api/coding/inspect` |
| POST | `/api/coding/search` |
| POST | `/api/coding/diff` |
| GET | `/api/voice/status` |
| POST | `/api/voice/transcribe` |
| POST | `/api/voice/speak` |
| POST | `/api/voice/converse` |

## Request schemas

### AgentRequest

```json
{
  "properties": {
    "message": {
      "type": "string",
      "maxLength": 12000,
      "minLength": 1,
      "title": "Message"
    },
    "history": {
      "items": {
        "additionalProperties": true,
        "type": "object"
      },
      "type": "array",
      "maxItems": 30,
      "title": "History"
    },
    "context": {
      "type": "string",
      "maxLength": 4000,
      "title": "Context",
      "default": ""
    }
  },
  "type": "object",
  "required": [
    "message"
  ],
  "title": "AgentRequest"
}
```

### Body_converse_api_voice_converse_post

```json
{
  "properties": {
    "file": {
      "type": "string",
      "contentMediaType": "application/octet-stream",
      "title": "File"
    },
    "history": {
      "type": "string",
      "title": "History",
      "default": "[]"
    }
  },
  "type": "object",
  "required": [
    "file"
  ],
  "title": "Body_converse_api_voice_converse_post"
}
```

### Body_transcribe_api_voice_transcribe_post

```json
{
  "properties": {
    "file": {
      "type": "string",
      "contentMediaType": "application/octet-stream",
      "title": "File"
    }
  },
  "type": "object",
  "required": [
    "file"
  ],
  "title": "Body_transcribe_api_voice_transcribe_post"
}
```

### ChatRequest

```json
{
  "properties": {
    "message": {
      "type": "string",
      "maxLength": 32000,
      "minLength": 1,
      "title": "Message"
    },
    "history": {
      "items": {
        "$ref": "#/components/schemas/Message"
      },
      "type": "array",
      "title": "History"
    }
  },
  "type": "object",
  "required": [
    "message"
  ],
  "title": "ChatRequest"
}
```

### CodeSearchRequest

```json
{
  "properties": {
    "query": {
      "type": "string",
      "maxLength": 200,
      "minLength": 2,
      "title": "Query"
    },
    "path": {
      "type": "string",
      "maxLength": 500,
      "title": "Path",
      "default": "backend"
    },
    "max_matches": {
      "type": "integer",
      "maximum": 100.0,
      "minimum": 1.0,
      "title": "Max Matches",
      "default": 30
    }
  },
  "type": "object",
  "required": [
    "query"
  ],
  "title": "CodeSearchRequest"
}
```

### DiffRequest

```json
{
  "properties": {
    "path": {
      "type": "string",
      "maxLength": 500,
      "minLength": 1,
      "title": "Path"
    },
    "proposed_content": {
      "type": "string",
      "maxLength": 200000,
      "title": "Proposed Content"
    }
  },
  "type": "object",
  "required": [
    "path",
    "proposed_content"
  ],
  "title": "DiffRequest"
}
```

### FileRequest

```json
{
  "properties": {
    "path": {
      "type": "string",
      "maxLength": 500,
      "minLength": 1,
      "title": "Path"
    }
  },
  "type": "object",
  "required": [
    "path"
  ],
  "title": "FileRequest"
}
```

### HTTPValidationError

```json
{
  "properties": {
    "detail": {
      "items": {
        "$ref": "#/components/schemas/ValidationError"
      },
      "type": "array",
      "title": "Detail"
    }
  },
  "type": "object",
  "title": "HTTPValidationError"
}
```

### InspectRequest

```json
{
  "properties": {
    "path": {
      "type": "string",
      "maxLength": 500,
      "title": "Path",
      "default": "backend"
    },
    "max_files": {
      "type": "integer",
      "maximum": 100.0,
      "minimum": 1.0,
      "title": "Max Files",
      "default": 50
    }
  },
  "type": "object",
  "title": "InspectRequest"
}
```

### MemoryChatRequest

```json
{
  "properties": {
    "message": {
      "type": "string",
      "maxLength": 32000,
      "minLength": 1,
      "title": "Message"
    },
    "conversation_id": {
      "anyOf": [
        {
          "type": "string",
          "maxLength": 64
        },
        {
          "type": "null"
        }
      ],
      "title": "Conversation Id"
    }
  },
  "type": "object",
  "required": [
    "message"
  ],
  "title": "MemoryChatRequest"
}
```

### Message

```json
{
  "properties": {
    "role": {
      "type": "string",
      "title": "Role"
    },
    "content": {
      "type": "string",
      "title": "Content"
    }
  },
  "type": "object",
  "required": [
    "role",
    "content"
  ],
  "title": "Message"
}
```

### ResearchRequest

```json
{
  "properties": {
    "query": {
      "type": "string",
      "maxLength": 300,
      "minLength": 2,
      "title": "Query"
    },
    "max_results": {
      "type": "integer",
      "maximum": 8.0,
      "minimum": 1.0,
      "title": "Max Results",
      "default": 5
    }
  },
  "type": "object",
  "required": [
    "query"
  ],
  "title": "ResearchRequest"
}
```

### SpeakRequest

```json
{
  "properties": {
    "text": {
      "type": "string",
      "maxLength": 2000,
      "minLength": 1,
      "title": "Text"
    }
  },
  "type": "object",
  "required": [
    "text"
  ],
  "title": "SpeakRequest"
}
```

### ValidationError

```json
{
  "properties": {
    "loc": {
      "items": {
        "anyOf": [
          {
            "type": "string"
          },
          {
            "type": "integer"
          }
        ]
      },
      "type": "array",
      "title": "Location"
    },
    "msg": {
      "type": "string",
      "title": "Message"
    },
    "type": {
      "type": "string",
      "title": "Error Type"
    },
    "input": {
      "title": "Input"
    },
    "ctx": {
      "type": "object",
      "title": "Context"
    }
  },
  "type": "object",
  "required": [
    "loc",
    "msg",
    "type"
  ],
  "title": "ValidationError"
}
```
