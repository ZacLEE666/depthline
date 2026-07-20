import type { CodexThread } from "./codex-types.js";

const now = Math.floor(Date.now() / 1000);

export function demoThreads(): CodexThread[] {
  return [
    {
      id: "demo-input",
      name: "Define the smallest useful onboarding flow",
      preview: "Turn the onboarding concept into a three-step experience with measurable completion.",
      cwd: "/Projects/depthline",
      source: "appServer",
      status: { type: "active", activeFlags: ["waitingOnUserInput"] },
      createdAt: now - 5_400,
      updatedAt: now - 180,
      turns: [
        {
          id: "turn-input",
          status: "inProgress",
          items: [
            {
              id: "message-input",
              type: "agentMessage",
              text: "Two viable onboarding paths remain. I need your decision on whether the first session should start with a focus timer or an agent connection.",
            },
          ],
        },
      ],
    },
    {
      id: "demo-approval",
      name: "Add the local Codex adapter",
      preview: "Connect to Codex app-server without reading private SQLite tables.",
      cwd: "/Projects/depthline",
      source: "cli",
      status: { type: "active", activeFlags: ["waitingOnApproval"] },
      createdAt: now - 7_200,
      updatedAt: now - 420,
      turns: [{ id: "turn-approval", status: "inProgress", items: [] }],
    },
    {
      id: "demo-working",
      name: "Research attention-friendly notification patterns",
      preview: "Find patterns that reduce monitoring without hiding meaningful blockers.",
      cwd: "/Projects/research",
      source: "appServer",
      status: { type: "active", activeFlags: [] },
      createdAt: now - 3_600,
      updatedAt: now - 60,
      turns: [{ id: "turn-working", status: "inProgress", items: [] }],
    },
    {
      id: "demo-review",
      name: "Draft the public project manifesto",
      preview: "Explain why human depth should remain the optimization target in the agent era.",
      cwd: "/Projects/depthline",
      source: "appServer",
      status: { type: "idle" },
      createdAt: now - 12_000,
      updatedAt: now - 1_200,
      turns: [
        {
          id: "turn-review",
          status: "completed",
          items: [
            {
              id: "message-review",
              type: "agentMessage",
              text: "The manifesto is complete. It defines attention as a finite human control surface and makes quiet execution the default.",
            },
          ],
        },
      ],
    },
    {
      id: "demo-parked",
      name: "Explore a mobile companion",
      preview: "Consider a phone surface for quick approvals after the desktop loop is validated.",
      cwd: "/Projects/depthline",
      source: "appServer",
      status: { type: "notLoaded" },
      createdAt: now - 90_000,
      updatedAt: now - 86_400,
      turns: [],
    },
  ];
}
