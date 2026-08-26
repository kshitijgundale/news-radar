import type { PoolLike, Queryable } from "./types.js";

export async function withTransaction<Result>(
  database: PoolLike,
  operation: (client: Queryable) => Promise<Result>,
): Promise<Result> {
  const client = await database.connect();

  try {
    await client.query("BEGIN");
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
