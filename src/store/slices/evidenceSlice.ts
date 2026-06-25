/**
 * Evidence slice — literature evidence management.
 *
 * State: evidenceItems, selectedEvidenceIds, draftAnalyzeInput
 * Actions: upsertEvidence, toggleEvidenceSelection, prepareAnalyzeFromEvidence, setDraftAnalyzeInput
 */
import type { StateCreator } from "zustand";
import { buildCheckpoints, composeEvidenceText, createId } from "../workbenchStoreHelpers";
import type { WorkbenchEvidenceItem, WorkbenchWorkflowControlSnapshot } from "../workbenchTypes";
import {
  buildWorkflowControlSnapshot,
  dispatchEvidenceAdded,
  getAnalyzeArtifactForState,
  touchState,
} from "./sharedHelpers";
import type { WorkbenchState } from "./types";

export interface EvidenceSlice {
  evidenceItems: WorkbenchEvidenceItem[];
  selectedEvidenceIds: string[];
  draftAnalyzeInput: string;
  upsertEvidence: (item: Omit<WorkbenchEvidenceItem, "id" | "savedAt">, options?: { select?: boolean }) => string;
  toggleEvidenceSelection: (id: string) => void;
  prepareAnalyzeFromEvidence: (ids?: string[]) => string;
  setDraftAnalyzeInput: (text: string) => void;
}

export const evidenceInitialState = {
  evidenceItems: [],
  selectedEvidenceIds: [],
  draftAnalyzeInput: "",
};

export const createEvidenceSlice: StateCreator<WorkbenchState, [], [], EvidenceSlice> = (set, get) => ({
  ...evidenceInitialState,

  upsertEvidence: (item, options) => {
    const now = Date.now();
    const key = `${item.doi || item.url || item.title}`.toLowerCase();
    let finalId = "";

    set((state) => {
      const existing = state.evidenceItems.find(
        (entry) => `${entry.doi || entry.url || entry.title}`.toLowerCase() === key,
      );

      const evidenceId = existing?.id ?? createId("evidence");
      finalId = evidenceId;

      const nextEvidence: WorkbenchEvidenceItem = {
        ...existing,
        ...item,
        id: evidenceId,
        savedAt: existing?.savedAt ?? now,
      };

      const evidenceItems = existing
        ? state.evidenceItems.map((entry) => (entry.id === evidenceId ? nextEvidence : entry))
        : [nextEvidence, ...state.evidenceItems];

      const selectedEvidenceIds = options?.select
        ? Array.from(new Set([evidenceId, ...state.selectedEvidenceIds]))
        : state.selectedEvidenceIds;

      const project = state.project ?? {
        id: createId("project"),
        title: item.query ? `Research: ${item.query}` : "Synthetic Biology Program",
        summary: "Evidence-led project seeded from literature.",
        targetProduct: "Target Product",
        status: "draft" as const,
        isDemo: false,
        createdAt: now,
        updatedAt: now,
      };

      const nextProject = { ...project, updatedAt: now, sourceQuery: item.query ?? project.sourceQuery, isDemo: false };

      if (!existing) dispatchEvidenceAdded([evidenceId]);

      return touchState(state, {
        project: nextProject,
        evidenceItems,
        selectedEvidenceIds,
        workflowControl: buildWorkflowControlSnapshot({
          ...state,
          project: nextProject,
          evidenceItems,
        }),
      });
    });

    return finalId;
  },

  toggleEvidenceSelection: (id) => {
    set((state) =>
      touchState(state, {
        selectedEvidenceIds: state.selectedEvidenceIds.includes(id)
          ? state.selectedEvidenceIds.filter((entry) => entry !== id)
          : [...state.selectedEvidenceIds, id],
      }),
    );
  },

  prepareAnalyzeFromEvidence: (ids) => {
    const state = get();
    const targetIds = ids?.length ? ids : state.selectedEvidenceIds;
    const selectedItems = state.evidenceItems.filter((item) => targetIds.includes(item.id));
    const composed = composeEvidenceText(selectedItems);

    if (selectedItems.length) {
      const title =
        state.project?.title && !state.project.isDemo
          ? state.project.title
          : selectedItems[0]?.query
            ? `Research: ${selectedItems[0].query}`
            : selectedItems[0].title;
      get().ensureProject({
        title,
        summary: `Evidence bundle with ${selectedItems.length} literature item(s).`,
        status: "active",
        isDemo: false,
      });
    }

    set((currentState) =>
      touchState(currentState, {
        draftAnalyzeInput: composed,
        selectedEvidenceIds: targetIds,
        checkpoints: buildCheckpoints("stage-1", getAnalyzeArtifactForState(currentState), currentState.toolRuns),
      }),
    );

    set({ currentStageId: "stage-1" });
    return composed;
  },

  setDraftAnalyzeInput: (text) => {
    set((state) => touchState(state, { draftAnalyzeInput: text }));
  },
});
