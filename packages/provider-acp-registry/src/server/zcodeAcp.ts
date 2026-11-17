import type { AcpToolCallState } from "@t3tools/provider-acp/server/runtimeModel";
import type { AcpAdapterV2SubagentUpdate } from "@t3tools/provider-acp/server/adapter";

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/** Detect the zcode adapter from its registry id or launch command: local
 * installs run `node …/zcode-acp/dist/cli.js`, where registryAgentId is empty. */
export function isZcodeAcpAgentSettings(settings: {
  agentId: string;
  commandArgs: readonly string[];
}): boolean {
  return (
    settings.agentId === "zcode-acp" ||
    settings.commandArgs.some((arg) => /zcode-acp[^/\\]*[/\\]dist[/\\]cli\.js$/i.test(arg))
  );
}

/** zcode-acp marks its Agent/Task tool calls with meta.subagent: `true` while
 * the subagent runs, a metadata object (agentId, usage counters) on the result. */
function subagentMeta(tool: AcpToolCallState): true | Record<string, unknown> | undefined {
  const meta = record(tool.data.meta) ?? record(tool.data._meta);
  const sub = meta?.subagent;
  return sub === true || record(sub);
}

/** The result text lives in the tool call's content blocks (zcode-acp leaves
 * the raw hand-back text there); rawOutput is the fallback — content wins
 * because rawOutput may be bound-truncated. */
function resultText(tool: AcpToolCallState): string | null {
  const content = Array.isArray(tool.data.content) ? tool.data.content : [];
  const parts = content
    .map((block) => record(block)?.content ?? block)
    .map((block) => record(block)?.text)
    .filter((t): t is string => typeof t === "string" && t.trim().length > 0);
  if (parts.length > 0) return parts.join("\n");
  const rawOutput = tool.data.rawOutput;
  return typeof rawOutput === "string" && rawOutput.trim().length > 0 ? rawOutput : null;
}

export function extractZcodeSubagentUpdate(
  tool: AcpToolCallState,
): AcpAdapterV2SubagentUpdate | undefined {
  const sub = subagentMeta(tool);
  if (sub === undefined) return undefined;
  const rawInput = record(tool.data.rawInput);
  const base = {
    nativeTaskId: tool.toolCallId,
    prompt: typeof rawInput?.prompt === "string" ? rawInput.prompt : "",
    title: typeof tool.title === "string" ? tool.title : null,
    model: null,
  };
  if (sub === true) {
    return {
      ...base,
      status: tool.status === "failed" ? "failed" : "running",
      childSessionId: null,
      result: null,
    };
  }
  return {
    ...base,
    status: tool.status === "failed" ? "failed" : "completed",
    childSessionId: typeof sub.agentId === "string" ? sub.agentId : null,
    result: resultText(tool),
  };
}
