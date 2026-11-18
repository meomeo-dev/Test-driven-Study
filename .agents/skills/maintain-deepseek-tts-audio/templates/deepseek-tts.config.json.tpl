{
  "schema": "maintain-deepseek-tts-audio/config-v1",
  "provider": {
    "endpoint": "https://api.deepseek.com/v1/tools/tts",
    "filterMarkdown": false
  },
  "credentials": { "env": "DEEPSEEK_API_KEY", "file": ".env.deepseek-tts" },
  "request": { "concurrency": 4, "timeoutSeconds": 120, "maxRetries": 3 },
  "sets": [
    {
      "name": "main",
      "phrases": "audio/phrases.json",
      "outputDir": "audio/generated",
      "pathTemplate": "{voice}/{key}.wav",
      "keyScheme": "fnv1a64",
      "voices": { "female": "stella", "male": "tide" }
    }
  ]
}
