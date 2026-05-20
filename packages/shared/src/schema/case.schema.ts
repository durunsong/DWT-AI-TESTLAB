import { z } from "zod";
import { SESSION_NAMES } from "../constants/session";
import { scenarioStepSchema } from "./step.schema";

export const scenarioSessionSchema = z.object({
  name: z.enum(SESSION_NAMES),
  login_url: z.string().min(1),
  username: z.string().optional(),
  password: z.string().optional()
});

export const scenarioCaseSchema = z.object({
  case_id: z.string().min(1),
  case_name: z.string().min(1),
  description: z.string().optional(),
  mode: z.enum(["web", "hybrid"]).default("web"),
  defaults: z.object({
    step_timeout_ms: z.number().int().positive().optional(),
    wait_for_network: z.boolean().optional(),
    manual_review_on_failure: z.boolean().optional()
  }).optional(),
  sessions: z.array(scenarioSessionSchema).min(1),
  variables: z.record(z.string(), z.string()).optional(),
  locations: z.object({
    file: z.string().min(1)
  }),
  steps: z.array(scenarioStepSchema).min(1)
});
