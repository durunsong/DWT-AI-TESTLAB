import { z } from "zod";

const locatorFallbackSchema = z.union([
  z.object({ role: z.string(), name: z.string().optional() }),
  z.object({ label: z.string() }),
  z.object({ placeholder: z.string() }),
  z.object({ text: z.string() }),
  z.object({ name: z.string() }),
  z.object({ css: z.string() }),
  z.object({ xpath: z.string() })
]);

export const locationDefinitionSchema = z.object({
  testId: z.string().optional(),
  role: z.string().optional(),
  label: z.string().optional(),
  placeholder: z.string().optional(),
  text: z.string().optional(),
  name: z.string().optional(),
  css: z.string().optional(),
  xpath: z.string().optional(),
  fallback: z.array(locatorFallbackSchema).optional()
});

export const locationMapSchema = z.record(locationDefinitionSchema);
