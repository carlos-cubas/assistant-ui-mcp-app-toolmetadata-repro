# assistant-ui ignores `toolMetadata.app` from `@ai-sdk/mcp`

Upstream issue: https://github.com/assistant-ui/assistant-ui/issues/8783

Minimal reproduction for `@assistant-ui/ai-sdk`.  The fixture MCP server runs over **stdio**, spawned by the repro,
and the model is the AI SDK's `MockLanguageModelV4`, so there are no ports, keys or network calls.

```bash
npm install
npm run repro
```

## Expected vs actual

```
A pointer on the tool definition only (the MCP Apps spec)
  tool metadata.app     : {"resourceUri":"ui://repro/card","mimeType":"text/html;profile=mcp-app"}   <- control: @ai-sdk/mcp read the definition
  part.state            : output-available
  part.toolMetadata.app : {"resourceUri":"ui://repro/card","mimeType":"text/html;profile=mcp-app"}
  part.output._meta     : undefined
  assistant-ui part.mcp : undefined

B the same server also repeating it on the result _meta
  tool metadata.app     : {"resourceUri":"ui://repro/card","mimeType":"text/html;profile=mcp-app"}   <- control: @ai-sdk/mcp read the definition
  part.state            : output-available
  part.toolMetadata.app : {"resourceUri":"ui://repro/card","mimeType":"text/html;profile=mcp-app"}
  part.output._meta     : {"ui":{"resourceUri":"ui://repro/card"}}
  assistant-ui part.mcp : {"app":{"resourceUri":"ui://repro/card"}}

REPRODUCED: assistant-ui detects the app only when the result repeats the pointer; toolMetadata.app is ignored
```

In A `assistant-ui part.mcp` should be `{"app":{"resourceUri":"ui://repro/card",...}}`, read from `part.toolMetadata.app`.

## What each run shows

- **A**: the tool declares `_meta.ui.resourceUri` on its definition only.  `@ai-sdk/mcp` puts it in the tool's
  `metadata.app` and `streamText` streams it as `toolMetadata`, so it reaches the UI part, and the converter
  does not pick it up.
- **B**: the server also puts `_meta.ui.resourceUri` on every result.  The converter finds it through its
  result-body fallback, which is the only reason B renders.

`AISDKMessageConverter` is not a public export of `@assistant-ui/ai-sdk`, so `probe.mjs` imports it from
`dist/converters/convertMessage.js`.  It is the converter `useChatRuntime` uses.

## Versions

`@assistant-ui/ai-sdk` 0.0.9, `@assistant-ui/core` 0.3.22, `@ai-sdk/mcp` 2.0.66, `ai` 7.0.127.  Node 25.1.0,
macOS arm64.
