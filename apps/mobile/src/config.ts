import { z } from "zod";

const publicConfigSchema = z.object({
  apiUrl: z.string().url(),
});

export type PublicConfig = z.infer<typeof publicConfigSchema>;

export const publicConfig = publicConfigSchema.parse({
  apiUrl: process.env.EXPO_PUBLIC_API_URL,
});
