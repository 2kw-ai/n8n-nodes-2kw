export interface PollOptions {
	intervalMs: number;
	timeoutMs: number;
	terminalStatuses: string[];
}

export async function pollUntilTerminal<T extends { status?: string }>(
	fetch: () => Promise<T>,
	opts: PollOptions,
): Promise<T> {
	const deadline = Date.now() + opts.timeoutMs;

	while (true) {
		const result = await fetch();
		if (result.status && opts.terminalStatuses.includes(result.status)) {
			return result;
		}
		if (Date.now() >= deadline) {
			throw new Error(
				`Polling timeout after ${opts.timeoutMs}ms — last status: ${result.status ?? '<unknown>'}`,
			);
		}
		await new Promise((resolve) => setTimeout(resolve, opts.intervalMs));
	}
}
