interface JobClient {
  startJob(id: string): Promise<void>;
  progressJob(id: string): Promise<void>;
  completeJob(id: string, result: Record<string, unknown>): Promise<void>;
  failJob(id: string, message: string, retryable: boolean): Promise<void>;
}

export async function runReservedJob(
  client: JobClient,
  id: string,
  execute: () => Promise<Record<string, unknown>>,
  renewalMs = 20_000,
) {
  await client.startJob(id);
  let pending: Promise<void> | undefined;
  let lost = false;
  const timer = setInterval(() => {
    if (pending || lost) return;
    pending = client.progressJob(id).catch(() => { lost = true; }).finally(() => { pending = undefined; });
  }, renewalMs);
  let result: Record<string, unknown>;
  let failure: { message: string; retryable: boolean } | undefined;
  try {
    result = await execute();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code = error instanceof Error && "code" in error ? String(error.code) : "";
    const retryable = /timeout|timed out|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EHOSTUNREACH|ENETUNREACH/i.test(message + " " + code);
    failure = { message, retryable };
  } finally {
    clearInterval(timer);
    await pending;
  }
  if (lost) throw new Error(`Lease renewal failed for job ${id}`);
  if (failure) await client.failJob(id, failure.message, failure.retryable);
  else await client.completeJob(id, result!);
}
