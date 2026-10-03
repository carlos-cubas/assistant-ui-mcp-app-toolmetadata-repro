// @ai-sdk/mcp -> streamText -> UI message -> assistant-ui's AISDKMessageConverter.
// Does assistant-ui detect an MCP App whose pointer is on the tool definition?
import { fileURLToPath } from "node:url";
import { createMCPClient } from "@ai-sdk/mcp";
import { Experimental_StdioMCPTransport } from "@ai-sdk/mcp/mcp-stdio";
import { readUIMessageStream, simulateReadableStream, stepCountIs, streamText } from "ai";
import { MockLanguageModelV4 } from "ai/test";
// Not a public export; loaded by path to run the converter useChatRuntime uses.
import { AISDKMessageConverter } from "./node_modules/@assistant-ui/ai-sdk/dist/converters/convertMessage.js";

const server = fileURLToPath(new URL("./server.mjs", import.meta.url));
const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
};

function makeModel() {
  const responses = [
    [
      { type: "stream-start", warnings: [] },
      { type: "tool-call", toolCallId: "call-1", toolName: "show_card", input: JSON.stringify({ cardId: "c-1" }) },
      { type: "finish", finishReason: { unified: "tool-calls", raw: "tool_use" }, usage },
    ],
    [
      { type: "stream-start", warnings: [] },
      { type: "text-start", id: "t1" },
      { type: "text-delta", id: "t1", delta: "Done." },
      { type: "text-end", id: "t1" },
      { type: "finish", finishReason: { unified: "stop", raw: "stop" }, usage },
    ],
  ];
  let call = 0;
  return new MockLanguageModelV4({ doStream: async () => ({ stream: simulateReadableStream({ chunks: responses[call++] }) }) });
}

async function run(label, echo) {
  const client = await createMCPClient({
    transport: new Experimental_StdioMCPTransport({
      command: process.execPath,
      args: [server],
      env: { ...process.env, ECHO: echo ? "1" : "0" },
    }),
  });
  try {
    const tools = await client.tools();
    const result = streamText({ model: makeModel(), tools, prompt: "Show card c-1", stopWhen: stepCountIs(2) });
    let message;
    for await (const m of readUIMessageStream({ stream: result.toUIMessageStream() })) message = m;
    const part = message.parts.find((p) => p.toolCallId === "call-1");
    const thread = AISDKMessageConverter.toThreadMessages([message], false);
    const toolCall = thread.flatMap((m) => m.content).find((c) => c.type === "tool-call");

    console.log(`\n${label}`);
    console.log(`  tool metadata.app     : ${JSON.stringify(tools.show_card?.metadata?.app)}   <- control: @ai-sdk/mcp read the definition`);
    console.log(`  part.state            : ${part?.state}`);
    console.log(`  part.toolMetadata.app : ${JSON.stringify(part?.toolMetadata?.app)}`);
    console.log(`  part.output._meta     : ${JSON.stringify(part?.output?._meta)}`);
    console.log(`  assistant-ui part.mcp : ${JSON.stringify(toolCall?.mcp)}`);
    return toolCall?.mcp?.app?.resourceUri;
  } finally {
    await client.close();
  }
}

const definitionOnly = await run("A pointer on the tool definition only (the MCP Apps spec)", false);
const echoed = await run("B the same server also repeating it on the result _meta", true);

console.log(
  definitionOnly === undefined && echoed !== undefined
    ? "\nREPRODUCED: assistant-ui detects the app only when the result repeats the pointer; toolMetadata.app is ignored"
    : `\nNOT REPRODUCED (definitionOnly=${definitionOnly}, echoed=${echoed})`,
);
