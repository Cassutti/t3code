import type { AcpToolCallState } from "@t3tools/provider-acp/server/runtimeModel";
import type { AcpAdapterV2SubagentUpdate } from "@t3tools/provider-acp/server/adapter";

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/**
 * zcode-acp marks its Agent/Task tool calls with `meta.subagent`: `true`
 * while running, a metadata object (agentId, usage counters) on the result
 * (dispatch.ts parseSubagentMetadata).
 */
function subagentMeta(tool: AcpToolCallState): true | Record<string, unknown> | undefined {
  const meta = record(tool.data.meta) ?? record(tool.data._meta);
  const sub = meta?.subagent;
  if (sub === true || typeof sub === "string") return sub === true ? true : undefined;
  return record(sub);
}

/**
 * Project a zcode Agent/Task tool call into the subagent timeline. The start
 * state (meta.subagent === true) projects as "running"; the result state
 * (meta.subagent = metadata object) projects as completed/failed and carries
 * the adapter-parsed agentId as the child session id.
 */
export function extractZcodeSubagentUpdate(
  tool: AcpToolCallState,
): AcpAdapterV2SubagentUpdate | undefined {
  const sub = subagentMeta(tool);
  if (sub === undefined) return undefined;
  const title = typeof tool.title === "string" ? tool.title : null;
  if (sub !== true) {
    const rawInput = record(tool.data.rawInput);
    return {
      nativeTaskId: tool.toolCallId,
      prompt: typeof rawInput?.prompt === "string" ? rawInput.prompt : "",
      title,
      model: null,
      status: tool.status === "failed" ? "failed" : "completed",
      childSessionId: typeof sub.agentId === "string" ? sub.agentId : null,
      result: typeof tool.data.rawResult === "string" ? tool.data.rawResult : null,
    };
  }
  const rawInput = record(tool.data.rawInput);
  return {
    nativeTaskId: tool.toolCallId,
    prompt: typeof rawInput?.prompt === "string" ? rawInput.prompt : "",
    title,
    model: null,
    status: tool.status === "failed" ? "failed" : "running",
    childSessionId: null,
    result: null,
  };
}
