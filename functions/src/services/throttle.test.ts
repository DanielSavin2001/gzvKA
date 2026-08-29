import { callerKey } from './throttle';

/**
 * The address a request is counted against.
 *
 * `x-forwarded-for` is a list, and a client can prepend whatever it likes to it. Only the
 * last entry - the one Google's own proxy appended - reflects who actually connected, so
 * reading the first would let anyone choose their own bucket and walk straight past the
 * limit by sending a different header each time.
 */
describe('callerKey', () => {
	it('takes the address the proxy appended, not the one the client offered', () => {
		expect(callerKey({ 'x-forwarded-for': '10.0.0.1, 203.0.113.7' })).toBe('203.0.113.7');
	});

	it('is not fooled by a spoofed chain', () => {
		const honest = callerKey({ 'x-forwarded-for': '203.0.113.7' });
		const spoofed = callerKey({ 'x-forwarded-for': 'not-me, 203.0.113.7' });

		expect(spoofed).toBe(honest);
	});

	it('handles a header array', () => {
		expect(callerKey({ 'x-forwarded-for': ['10.0.0.1', '203.0.113.7'] })).toBe('203.0.113.7');
	});

	it('still returns something when the header is missing', () => {
		// Better to count every unattributable request together than to skip the limit.
		expect(callerKey({})).toBe('onbekend');
	});

	it('produces something usable as a document id', () => {
		// A slash would silently create a subcollection instead of a document.
		const key = callerKey({ 'x-forwarded-for': 'a/b\\c#d 2001:db8::1' });

		expect(key).not.toMatch(/[/\\#\s]/);
		expect(key.length).toBeLessThanOrEqual(120);
	});

	it('keeps an IPv6 address readable', () => {
		expect(callerKey({ 'x-forwarded-for': '2001:db8::1' })).toBe('2001:db8::1');
	});
});
