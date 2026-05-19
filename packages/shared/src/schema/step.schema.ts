import { z } from "zod";
import { SESSION_NAMES } from "../constants/session";
import { STEP_TYPES } from "../constants/step-types";

const dbParamSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const dbExpectedSchema = z.record(z.union([z.string(), z.number(), z.boolean(), z.null()]));

export const scenarioStepSchema = z.object({
  step_id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(STEP_TYPES),
  session: z.enum(SESSION_NAMES).optional(),
  target: z.string().optional(),
  url: z.string().optional(),
  value: z.string().optional(),
  expected: z.union([z.string(), dbExpectedSchema]).optional(),
  variable: z.string().optional(),
  save_as: z.string().optional(),
  sql: z.string().optional(),
  params: z.array(dbParamSchema).optional(),
  row_index: z.number().int().nonnegative().optional(),
  timeout_ms: z.number().int().positive().optional(),
  wait_for_network: z.boolean().optional(),
  continue_on_failure: z.boolean().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  file: z.string().optional()
});
