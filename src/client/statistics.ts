import type { AttentionState, DepthlineSnapshot } from "../shared/types";

export interface ProjectAttentionStats {
  project: string;
  total: number;
  working: number;
  needsYou: number;
  readyForReview: number;
  parked: number;
  latestUpdate: string;
}

export interface AttentionStats {
  attentionProtectionRate: number | null;
  protectedItems: number;
  parallelLoad: number;
  stateCounts: Record<AttentionState, number>;
  totalVisible: number;
  projects: ProjectAttentionStats[];
}

export function buildAttentionStats(snapshot: DepthlineSnapshot): AttentionStats {
  const visible = snapshot.items.filter((item) => !item.snoozedUntil);
  const stateCounts: Record<AttentionState, number> = {
    needs_input: 0,
    needs_approval: 0,
    error: 0,
    ready_review: 0,
    working: 0,
    parked: 0,
  };
  const projects = new Map<string, ProjectAttentionStats>();

  for (const item of visible) {
    stateCounts[item.state] += 1;
    const current = projects.get(item.project) ?? {
      project: item.project,
      total: 0,
      working: 0,
      needsYou: 0,
      readyForReview: 0,
      parked: 0,
      latestUpdate: item.updatedAt,
    };
    current.total += 1;
    if (item.state === "working") current.working += 1;
    if (item.urgency === "blocking") current.needsYou += 1;
    if (item.state === "ready_review") current.readyForReview += 1;
    if (item.state === "parked") current.parked += 1;
    if (item.updatedAt > current.latestUpdate) current.latestUpdate = item.updatedAt;
    projects.set(item.project, current);
  }

  const needsYou = stateCounts.needs_input + stateCounts.needs_approval + stateCounts.error;
  const protectedItems = stateCounts.working + stateCounts.ready_review;
  const attentionItems = needsYou + protectedItems;

  return {
    attentionProtectionRate:
      attentionItems > 0 ? Math.round((protectedItems / attentionItems) * 100) : null,
    protectedItems,
    parallelLoad: stateCounts.working + needsYou,
    stateCounts,
    totalVisible: visible.length,
    projects: [...projects.values()]
      .sort((a, b) => {
        const activeA = a.working + a.needsYou + a.readyForReview;
        const activeB = b.working + b.needsYou + b.readyForReview;
        return activeB - activeA || b.latestUpdate.localeCompare(a.latestUpdate);
      })
      .slice(0, 10),
  };
}
