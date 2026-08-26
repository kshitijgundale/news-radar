import type { PoolClient, QueryResult, QueryResultRow } from "pg";

export interface Queryable {
  query<Row extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<Row>>;
}

export interface TransactionClient extends Queryable {
  release(): void;
}

export interface PoolLike extends Queryable {
  connect(): Promise<PoolClient>;
}
