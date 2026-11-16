import { describe, expect, it } from "vitest";

import type { AcpToolCallState } from "@t3tools/provider-acp/server/runtimeModel";
import { extractZcodeSubagentUpdate } from "./zcodeAcp.ts";

function toolCall(partial: {
  toolCallId: string;
  title?: string;
  status?: AcpToolCallState["status"];
  data: Record<string, unknown>;
}): AcpToolCallState {
  return {
    toolCallId: partial.toolCallId,
    title: partial.title,
    status: partial.status,
    data: partial.data,
  };
}

describe("extractZcodeSubagentUpdate", () => {
  it("start state (meta.subagent === true) projects as running with the tool's prompt and title", () => {
    const tool = toolCall({
      toolCallId: "tc_1",
      title: "Elenco file .md",
      status: "inProgress",
      data: { meta: { subagent: true }, rawInput: { prompt: "Conta i file" } },
    });
    expect(extractZcodeSubagentUpdate(tool)).toEqual({
      nativeTaskId: "tc_1",
      prompt: "Conta i file",
      title: "Elenco file .md",
      model: null,
      status: "running",
      childSessionId: null,
      result: null,
    });
  });

  it("result state (meta.subagent = metadata object) projects as completed with the agentId as child session", () => {
    const tool = toolCall({
      toolCallId: "tc_1",
      title: "Elenco file .md",
      status: "completed",
      data: {
        meta: { subagent: { agentId: "agent_123", tokens: 42000, toolUses: 3 } },
        rawResult: "Conteggio: 0. agentId: agent_123 <usage>84340</usage>",
      },
    });
    expect(extractZcodeSubagentUpdate(tool)).toEqual({
      nativeTaskId: "tc_1",
      prompt: "",
      title: "Elenco file .md",
      model: null,
      status: "completed",
      childSessionId: "agent_123",
      result: "Conteggio: 0. agentId: agent_123 <usage>84340</usage>",
    });
  });

  it("failed tool call projects as failed", () => {
    const tool = toolCall({
      toolCallId: "tc_2",
      status: "failed",
      data: { meta: { subagent: { agentId: "agent_x" } } },
    });
    expect(extractZcodeSubagentUpdate(tool)?.status).toBe("failed");
  });

  it("non-subagent tool calls return undefined", () => {
    const tool = toolCall({
      toolCallId: "tc_3",
      title: "Bash",
      status: "completed",
      data: { meta: { terminal_output: true }, rawInput: { command: "ls" } },
    });
    expect(extractZcodeSubagentUpdate(tool)).toBeUndefined();
  });

  it("reads the subagent marker from data._meta too (raw-update path)", () => {
    const tool = toolCall({
      toolCallId: "tc_4",
      status: "inProgress",
      data: { _meta: { subagent: true } },
    });
    expect(extractZcodeSubagentUpdate(tool)?.status).toBe("running");
  });
});
