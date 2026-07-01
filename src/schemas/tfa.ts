/**
 * Zod schema for the /api/tfa request body.
 *
 * Accepts a bare TFAModel ({ reactions, conditions }) plus optional solver
 * options. (The route also accepts a { model, options } envelope, which it
 * unwraps before validation.)
 */
import { z } from "zod";

const TFAReactionSchema = z.object({
  id: z.string().min(1),
  deltaG0Prime: z.number().finite(),
  stoichiometry: z.record(z.string(), z.number()),
  lb: z.number().finite().optional(),
  ub: z.number().finite().optional(),
  nH: z.number().finite().optional(),
  deltaZSquared: z.number().finite().optional(),
});

const TFAConditionsSchema = z.object({
  pH: z.number().min(0).max(14),
  ionicStrength: z.number().min(0),
  temperature: z.number().positive(),
});

export const TFARequestSchema = z.object({
  reactions: z.array(TFAReactionSchema).min(1, "at least one reaction is required"),
  conditions: TFAConditionsSchema,
  options: z
    .object({
      reversibilityThreshold: z.number().finite().optional(),
      bottleneckThreshold: z.number().finite().optional(),
    })
    .optional(),
});

export type TFARequestInput = z.infer<typeof TFARequestSchema>;
