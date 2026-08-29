import { swipe } from '../../../src/lib/gestures';

/**
 * The swipe action, driven against a fake element.
 *
 * These exist because of a specific regression. Pointer capture was added so a swipe would
 * survive the pointer leaving the photograph - a swipe is a movement towards the edge, so
 * `pointerup` usually lands elsewhere. But a captured pointer retargets every later pointer
 * event to the capturing element, and the browser builds the `click` from those, so the
 * next and previous arrows *inside* the swipe area silently stopped navigating. Nothing
 * threw; the links simply never fired.
 *
 * A fake node is used rather than jsdom because what is being tested is which listeners the
 * action registers and where - and that is exactly what the bug was about.
 */

interface Recorder {
	node: HTMLElement;
	fire: (type: string, event: Partial<PointerEvent>) => void;
	fireWindow: (type: string, event: Partial<PointerEvent>) => void;
	captured: number[];
	nodeEvents: string[];
	windowEvents: string[];
}

function recorder(): Recorder {
	const nodeListeners = new Map<string, ((event: any) => void)[]>();
	const windowListeners = new Map<string, ((event: any) => void)[]>();
	const captured: number[] = [];

	const add = (map: Map<string, ((event: any) => void)[]>) => (type: string, fn: any) => {
		map.set(type, [...(map.get(type) ?? []), fn]);
	};
	const remove = (map: Map<string, ((event: any) => void)[]>) => (type: string, fn: any) => {
		map.set(
			type,
			(map.get(type) ?? []).filter((other) => other !== fn)
		);
	};

	const node = {
		addEventListener: add(nodeListeners),
		removeEventListener: remove(nodeListeners),
		setPointerCapture: (id: number) => captured.push(id),
		hasPointerCapture: () => false,
		releasePointerCapture: () => undefined
	} as unknown as HTMLElement;

	// The action reaches for `window` for the rest of the gesture; a jest node environment
	// has none. Put back after each test by the hook below.
	(globalThis as any).window = {
		addEventListener: add(windowListeners),
		removeEventListener: remove(windowListeners)
	};

	const dispatch =
		(map: Map<string, ((event: any) => void)[]>) =>
		(type: string, event: Partial<PointerEvent>) => {
			for (const fn of [...(map.get(type) ?? [])]) fn({ pointerId: 1, ...event });
		};

	return {
		node,
		fire: dispatch(nodeListeners),
		fireWindow: dispatch(windowListeners),
		captured,
		get nodeEvents() {
			return [...nodeListeners.entries()].filter(([, fns]) => fns.length > 0).map(([type]) => type);
		},
		get windowEvents() {
			return [...windowListeners.entries()]
				.filter(([, fns]) => fns.length > 0)
				.map(([type]) => type);
		}
	};
}

const NO_WINDOW = globalThis.window;

afterEach(() => {
	(globalThis as any).window = NO_WINDOW;
});

describe('swipe', () => {
	it('never captures the pointer', () => {
		// The regression in one line. Capturing here retargets the synthesised click to this
		// container, and every link and button inside it stops working.
		const r = recorder();
		swipe(r.node, {});

		r.fire('pointerdown', { clientX: 200, clientY: 100 });
		r.fireWindow('pointerup', { clientX: 40, clientY: 104 });

		expect(r.captured).toEqual([]);
	});

	it('follows the rest of the gesture on window', () => {
		// Which is how it survives the pointer leaving the photograph without capture.
		const r = recorder();
		swipe(r.node, {});

		expect(r.windowEvents).toEqual([]);
		r.fire('pointerdown', { clientX: 200, clientY: 100 });
		expect(r.windowEvents).toEqual(expect.arrayContaining(['pointerup', 'pointercancel']));
	});

	it('steps forward on a swipe left, even when it ends far outside', () => {
		const r = recorder();
		let forward = 0;
		swipe(r.node, { onLeft: () => (forward += 1) });

		r.fire('pointerdown', { clientX: 300, clientY: 100 });
		r.fireWindow('pointerup', { clientX: -80, clientY: 104 });

		expect(forward).toBe(1);
	});

	it('steps back on a swipe right', () => {
		const r = recorder();
		let back = 0;
		swipe(r.node, { onRight: () => (back += 1) });

		r.fire('pointerdown', { clientX: 100, clientY: 100 });
		r.fireWindow('pointerup', { clientX: 400, clientY: 96 });

		expect(back).toBe(1);
	});

	it('ignores a tap, which is what a click on an arrow looks like', () => {
		const r = recorder();
		let stepped = 0;
		swipe(r.node, { onLeft: () => (stepped += 1), onRight: () => (stepped += 1) });

		r.fire('pointerdown', { clientX: 200, clientY: 100 });
		r.fireWindow('pointerup', { clientX: 202, clientY: 101 });

		expect(stepped).toBe(0);
	});

	it('ignores a mostly-vertical drag, which is a scroll', () => {
		const r = recorder();
		let stepped = 0;
		swipe(r.node, { onLeft: () => (stepped += 1), onRight: () => (stepped += 1) });

		r.fire('pointerdown', { clientX: 200, clientY: 400 });
		r.fireWindow('pointerup', { clientX: 130, clientY: 60 });

		expect(stepped).toBe(0);
	});

	it('abandons the gesture when a second finger arrives', () => {
		// Two fingers mean a pinch, and stepping to the next photograph mid-zoom is exactly
		// the wrong response.
		const r = recorder();
		let stepped = 0;
		swipe(r.node, { onLeft: () => (stepped += 1) });

		r.fire('pointerdown', { pointerId: 1, clientX: 300, clientY: 100 });
		r.fire('pointerdown', { pointerId: 2, clientX: 320, clientY: 100 });
		r.fireWindow('pointerup', { pointerId: 1, clientX: -80, clientY: 104 });

		expect(stepped).toBe(0);
	});

	it('lets go of window once the gesture is over', () => {
		const r = recorder();
		swipe(r.node, {});

		r.fire('pointerdown', { clientX: 200, clientY: 100 });
		r.fireWindow('pointerup', { clientX: 100, clientY: 100 });

		expect(r.windowEvents).toEqual([]);
	});

	it('unhooks everything when the component goes away', () => {
		const r = recorder();
		const action = swipe(r.node, {});

		r.fire('pointerdown', { clientX: 200, clientY: 100 });
		action.destroy();

		expect(r.nodeEvents).toEqual([]);
		expect(r.windowEvents).toEqual([]);
	});
});
