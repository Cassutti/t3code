import { describe, expect, it } from "@effect/vitest";

import type { AcpToolCallState } from "@t3tools/provider-acp/server/runtimeModel";
import { extractZcodeSubagentUpdate, isZcodeAcpAgentSettings } from "./zcodeAcp.ts";

function toolCall(partial: {
  toolCallId: string;
  title?: string;
  status?: AcpToolCallState["status"];
  data: Record<string, unknown>;
}): AcpToolCallState {
  const { title, status, ...rest } = partial;
  return {
    ...rest,
    ...(title !== undefined && { title }),
    ...(status !== undefined && { status }),
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

  it("result state projects as completed: agentId as child session, text from content blocks", () => {
    const tool = toolCall({
      toolCallId: "tc_1",
      title: "Elenco file .md",
      status: "completed",
      data: {
        meta: { subagent: { agentId: "agent_123", tokens: 42000, toolUses: 3 } },
        content: [
          {
            type: "content",
            content: {
              type: "text",
              text: "Conteggio: 0. agentId: agent_123 <usage>84340</usage>",
            },
          },
        ],
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

  it("falls back to data.rawOutput when content is absent", () => {
    const tool = toolCall({
      toolCallId: "tc_2",
      status: "completed",
      data: { meta: { subagent: { agentId: "agent_x" } }, rawOutput: "fatto" },
    });
    expect(extractZcodeSubagentUpdate(tool)?.result).toBe("fatto");
  });

  it("prefers content blocks over a bound rawOutput", () => {
    const tool = toolCall({
      toolCallId: "tc_2b",
      status: "completed",
      data: {
        meta: { subagent: { agentId: "agent_x" } },
        content: [
          { type: "content", content: { type: "text", text: "report completo dal subagent" } },
        ],
        rawOutput: "report troncato…",
      },
    });
    expect(extractZcodeSubagentUpdate(tool)?.result).toBe("report completo dal subagent");
  });

  it("failed tool call projects as failed", () => {
    const tool = toolCall({
      toolCallId: "tc_3",
      status: "failed",
      data: { meta: { subagent: { agentId: "agent_x" } } },
    });
    expect(extractZcodeSubagentUpdate(tool)?.status).toBe("failed");
  });

  it("non-subagent tool calls return undefined", () => {
    const tool = toolCall({
      toolCallId: "tc_4",
      title: "Bash",
      status: "completed",
      data: { meta: { terminal_output: true }, rawInput: { command: "ls" } },
    });
    expect(extractZcodeSubagentUpdate(tool)).toBeUndefined();
  });

  it("reads the subagent marker from data._meta too (raw-update path)", () => {
    const tool = toolCall({
      toolCallId: "tc_5",
      status: "inProgress",
      data: { _meta: { subagent: true } },
    });
    expect(extractZcodeSubagentUpdate(tool)?.status).toBe("running");
  });
});

describe("isZcodeAcpAgentSettings", () => {
  it("matches the registry id", () => {
    expect(isZcodeAcpAgentSettings({ agentId: "zcode-acp", commandArgs: [] })).toBe(true);
  });

  it("matches local node launches of the adapter (fork and npm-global layouts)", () => {
    expect(
      isZcodeAcpAgentSettings({
        agentId: "",
        commandArgs: ["C:\\Users\\marco\\zcode-acp-patched\\dist\\cli.js", "server"],
      }),
    ).toBe(true);
    expect(
      isZcodeAcpAgentSettings({
        agentId: "",
        commandArgs: ["node", "C:\\npm\\node_modules\\zcode-acp\\dist\\cli.js", "server"],
      }),
    ).toBe(true);
  });

  it("does not match other adapters or unrelated paths", () => {
    expect(
      isZcodeAcpAgentSettings({
        agentId: "claude-acp",
        commandArgs: ["claude-agent-acp/dist/cli.js"],
      }),
    ).toBe(false);
    expect(isZcodeAcpAgentSettings({ agentId: "", commandArgs: [] })).toBe(false);
  });
});
