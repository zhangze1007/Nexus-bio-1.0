/**
 * Zod schema for the /api/fba request body.
 *
 * The FBA route accepts multiple modes: single, community, steadycom, custom,
 * plus action variants (fva, pfba, knockout, fseof, optknock).
 */
import { z } from "zod";

const SpeciesSchema = z.enum(["ecoli", "yeast"]);
const ObjectiveSchema = z.enum(["biomass", "atp", "product"]);
const ActionSchema = z.enum(["fba", "fva", "pfba", "knockout", "fseof", "optknock"]);

const StrainInputSchema = z.object({
  glucoseUptake: z.number().finite().optional(),
  oxygenUptake: z.number().finite().optional(),
  knockouts: z.array(z.string()).optional(),
});

const DynamicReactionSchema = z.object({
  id: z.string(),
  stoichiometry: z.record(z.string(), z.number()),
  lowerBound: z.number().finite(),
  upperBound: z.number().finite(),
  gpr: z.string().optional(),
});

const SteadyComSpeciesSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  reactions: z.array(
    z.object({
      id: z.string(),
      stoichiometry: z.record(z.string(), z.number()),
      lowerBound: z.number().finite().optional(),
      upperBound: z.number().finite().optional(),
    }),
  ),
  metabolites: z.array(z.string()).optional(),
  biomassReaction: z.string(),
});

/**
 * Discriminated union across FBA modes.
 */
export const FBARequestSchema = z.union([
  // Community mode
  z.object({
    mode: z.literal("community"),
    objective: ObjectiveSchema.optional(),
    alpha: z.number().finite().optional(),
    ecoli: StrainInputSchema.optional(),
    yeast: StrainInputSchema.optional(),
  }),
  // SteadyCom mode
  z.object({
    mode: z.literal("steadycom"),
    species: z.array(SteadyComSpeciesSchema).min(1),
    sharedMetabolites: z.array(z.string()).optional(),
    maxIterations: z.number().int().positive().optional(),
    tolerance: z.number().positive().optional(),
  }),
  // Custom (BiGG) mode
  z.object({
    mode: z.literal("custom"),
    reactions: z.array(DynamicReactionSchema).min(1),
    objectiveId: z.string().optional(),
    glucoseUptake: z.number().finite().optional(),
    oxygenUptake: z.number().finite().optional(),
    knockouts: z.array(z.string()).optional(),
  }),
  // Standard / action modes (single species)
  z.object({
    mode: z.enum(["single"]).optional(),
    species: SpeciesSchema.optional(),
    objective: ObjectiveSchema.optional(),
    glucoseUptake: z.number().finite().optional(),
    oxygenUptake: z.number().finite().optional(),
    knockouts: z.array(z.string()).optional(),
    action: ActionSchema.optional(),
    // FVA / knockout / FSEOF / OptKnock extras
    reactionIds: z.array(z.string()).optional(),
    genes: z.array(z.string()).optional(),
    reactions: z.array(DynamicReactionSchema).optional(),
    objectiveId: z.string().optional(),
    productReactionId: z.string().optional(),
    numSteps: z.number().int().positive().optional(),
    reductionFactor: z.number().finite().optional(),
    maxKnockouts: z.number().int().positive().optional(),
    growthFraction: z.number().finite().optional(),
  }),
]);

export type FBARequest = z.infer<typeof FBARequestSchema>;
