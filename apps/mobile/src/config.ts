import { z } from "zod";

const publicConfigSchema = z.object({
  // Web uses the current Vercel origin by default. Native builds must provide
  // EXPO_PUBLIC_API_URL because React Native has no browser origin.
  apiUrl: z.union([z.string().url(), z.literal("")]),
});

export type PublicConfig = z.infer<typeof publicConfigSchema>;

export const publicConfig = publicConfigSchema.parse({
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "",
});
