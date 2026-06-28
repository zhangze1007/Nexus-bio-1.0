/**
 * Zod schema for the /api/workbench PUT request body.
 *
 * The workbench route accepts a state object wrapped in { state: WorkbenchState }.
 * The state is further validated by sanitizeWorkbenchState() downstream,
 * so this schema covers the envelope shape only.
 */
import { z } from "zod";

/**
 * Loose schema for the workbench PUT body envelope.
 * The `state` field is intentionally permissive — sanitizeWorkbenchState()
 * performs deep structural validation. This schema catches missing/wrong
 * envelope shape before the handler runs.
 */
export const WorkbenchPutSchema = z.object({
  state: z
    .record(z.string(), z.unknown())
    .refine((val) => val !== null && typeof val === "object", { message: "state must be a non-null object" }),
});

export type WorkbenchPutBody = z.infer<typeof WorkbenchPutSchema>;
