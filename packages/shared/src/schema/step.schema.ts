import { z } from "zod";
import { SESSION_NAMES } from "../constants/session";
import { STEP_TYPES } from "../constants/step-types";

export const scenarioStepSchema = z.object({
  step_id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(STEP_TYPES),
  session: z.enum(SESSION_NAMES).optional(),
  target: z.string().optional(),
  url: z.string().optional(),
  value: z.string().optional(),
  expected: z.string().optional(),
  variable: z.string().optional(),
  timeout_ms: z.number().int().positive().optional(),
  continue_on_failure: z.boolean().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  file: z.string().optional()
});
