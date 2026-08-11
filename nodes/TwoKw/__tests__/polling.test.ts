import { describe, it, expect, vi } from 'vitest';
import { pollUntilTerminal } from '../polling';

describe('pollUntilTerminal', () => {
	it('returns the first response whose status is in terminalStatuses', async () => {
		const responses = [
			{ status: 'PROCESSING', n: 1 },
			{ status: 'PROCESSING', n: 2 },
			{ status: 'COMPLETED', n: 3, result: { ok: true } },
		];
		let i = 0;
		const fetch = vi.fn(async () => responses[i++]);

		const result = await pollUntilTerminal(fetch, {
			intervalMs: 1,
			timeoutMs: 1000,
			terminalStatuses: ['COMPLETED', 'FAILED'],
		});

		expect(result).toEqual({ status: 'COMPLETED', n: 3, result: { ok: true } });
		expect(fetch).toHaveBeenCalledTimes(3);
	});

	it('returns immediately when the first response is already terminal', async () => {
		const fetch = vi.fn(async () => ({ status: 'FAILED', error: 'oops' }));

		const result = await pollUntilTerminal(fetch, {
			intervalMs: 1,
			timeoutMs: 1000,
			terminalStatuses: ['COMPLETED', 'FAILED'],
		});

		expect(result).toEqual({ status: 'FAILED', error: 'oops' });
		expect(fetch).toHaveBeenCalledTimes(1);
	});

	it('throws when timeout elapses before a terminal status is seen', async () => {
		const fetch = vi.fn(async () => ({ status: 'PROCESSING' }));

		await expect(
			pollUntilTerminal(fetch, {
				intervalMs: 5,
				timeoutMs: 20,
				terminalStatuses: ['COMPLETED', 'FAILED'],
			}),
		).rejects.toThrow(/timeout/i);
		expect(fetch).toHaveBeenCalled();
	});

	it('propagates fetch errors', async () => {
		const fetch = vi.fn(async () => {
			throw new Error('network down');
		});

		await expect(
			pollUntilTerminal(fetch, {
				intervalMs: 1,
				timeoutMs: 100,
				terminalStatuses: ['COMPLETED'],
			}),
		).rejects.toThrow('network down');
	});
});
