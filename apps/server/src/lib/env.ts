import { parseServerEnv } from "./env-schema.js";

export const env = parseServerEnv(process.env);
