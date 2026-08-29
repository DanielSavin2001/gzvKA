/**
 * Touch gestures for browsing photographs.
 *
 * On a phone the arrows are not how anybody expects to move through a set of pictures -
 * they swipe, and they pinch to look closer. These are Svelte actions so a component can
 * say `use:swipe` and be done with it.
 *
 * Written against pointer events rather than touch events so a trackpad or a pen behaves
 * the same as a finger, and so a single code path handles both.
 */

/** How far a finger must travel before it counts as a swipe rather than a tap. */
const SWIPE_THRESHOLD = 60;

/**
 * How much more horizontal than vertical the movement must be. Without this a diagonal
 * flick while scrolling a gallery would jump to the next photograph, which feels broken.
 */
const HORIZONTAL_RATIO = 1.6;

export interface SwipeOptions {
	onLeft?: () => void;
	onRight?: () => void;
	/** Consulted on each move; return false to let the gesture through untouched. */
	enabled?: () => boolean;
}

/**
 * Recognises a horizontal swipe.
 *
 * Only one pointer is tracked: the moment a second touches down the gesture is abandoned,
 * because two fingers mean a pinch and stepping to the next photograph mid-zoom is exactly
 * the wrong response.
 */
export function swipe(node: HTMLElement, options: SwipeOptions) {
	let current: SwipeOptions = options;
	let startX = 0;
	let startY = 0;
	let pointerId: number | null = null;

	function down(event: PointerEvent): void {
		if (current.enabled && !current.enabled()) return;

		if (pointerId !== null) {
			pointerId = null; // a second finger: this is a pinch, not a swipe
			return;
		}

		pointerId = event.pointerId;
		startX = event.clientX;
		startY = event.clientY;
	}

	function up(event: PointerEvent): void {
		if (pointerId !== event.pointerId) return;
		pointerId = null;

		if (current.enabled && !current.enabled()) return;

		const dx = event.clientX - startX;
		const dy = event.clientY - startY;

		if (Math.abs(dx) < SWIPE_THRESHOLD) return;
		if (Math.abs(dx) < Math.abs(dy) * HORIZONTAL_RATIO) return;

		// Swiping left moves forward, the way a photo roll works everywhere else.
		if (dx < 0) current.onLeft?.();
		else current.onRight?.();
	}

	function cancel(): void {
		pointerId = null;
	}

	node.addEventListener('pointerdown', down);
	node.addEventListener('pointerup', up);
	node.addEventListener('pointercancel', cancel);

	return {
		update(next: SwipeOptions) {
			current = next;
		},
		destroy() {
			node.removeEventListener('pointerdown', down);
			node.removeEventListener('pointerup', up);
			node.removeEventListener('pointercancel', cancel);
		}
	};
}

export interface ZoomState {
	scale: number;
	x: number;
	y: number;
}

export const NO_ZOOM: ZoomState = { scale: 1, x: 0, y: 0 };

export interface ZoomOptions {
	onChange: (state: ZoomState) => void;
	/** Largest magnification. Beyond about four the scan's own grain is all there is. */
	max?: number;
}

/**
 * Pinch to zoom, drag to pan, double-tap to toggle.
 *
 * The browser's own pinch-zoom is no use inside a full-screen overlay: it zooms the page
 * around the overlay rather than the photograph in it. So the transform is kept here and
 * handed back to the component to apply.
 *
 * Panning is only active while zoomed in, which is what leaves ordinary swiping free to
 * move between photographs at 1x.
 */
export function pinchZoom(node: HTMLElement, options: ZoomOptions) {
	let current: ZoomOptions = options;
	let state: ZoomState = { ...NO_ZOOM };

	const points = new Map<number, { x: number; y: number }>();
	let startDistance = 0;
	let startScale = 1;
	let panFrom: { x: number; y: number; ox: number; oy: number } | null = null;
	let lastTap = 0;

	const max = () => current.max ?? 4;

	function emit(): void {
		current.onChange({ ...state });
	}

	function clampPan(): void {
		if (state.scale <= 1) {
			state.x = 0;
			state.y = 0;
			return;
		}

		// Keep the picture from being dragged off the screen entirely.
		const limitX = (node.clientWidth * (state.scale - 1)) / 2;
		const limitY = (node.clientHeight * (state.scale - 1)) / 2;
		state.x = Math.max(-limitX, Math.min(limitX, state.x));
		state.y = Math.max(-limitY, Math.min(limitY, state.y));
	}

	function distance(): number {
		const [a, b] = [...points.values()];
		return Math.hypot(a.x - b.x, a.y - b.y);
	}

	function down(event: PointerEvent): void {
		points.set(event.pointerId, { x: event.clientX, y: event.clientY });

		if (points.size === 2) {
			startDistance = distance();
			startScale = state.scale;
			panFrom = null;
			return;
		}

		if (points.size === 1 && state.scale > 1) {
			panFrom = { x: event.clientX, y: event.clientY, ox: state.x, oy: state.y };
		}
	}

	function move(event: PointerEvent): void {
		if (!points.has(event.pointerId)) return;
		points.set(event.pointerId, { x: event.clientX, y: event.clientY });

		if (points.size === 2 && startDistance > 0) {
			event.preventDefault();
			state.scale = Math.max(1, Math.min(max(), (startScale * distance()) / startDistance));
			clampPan();
			emit();
			return;
		}

		if (panFrom && state.scale > 1) {
			event.preventDefault();
			state.x = panFrom.ox + (event.clientX - panFrom.x);
			state.y = panFrom.oy + (event.clientY - panFrom.y);
			clampPan();
			emit();
		}
	}

	function up(event: PointerEvent): void {
		points.delete(event.pointerId);
		if (points.size < 2) startDistance = 0;
		if (points.size === 0) panFrom = null;

		// Double-tap: the quickest way in and back out again on a phone.
		const now = Date.now();
		if (now - lastTap < 300) {
			state = state.scale > 1 ? { ...NO_ZOOM } : { scale: 2.5, x: 0, y: 0 };
			emit();
			lastTap = 0;
		} else {
			lastTap = now;
		}
	}

	node.addEventListener('pointerdown', down);
	node.addEventListener('pointermove', move, { passive: false });
	node.addEventListener('pointerup', up);
	node.addEventListener('pointercancel', up);

	return {
		update(next: ZoomOptions) {
			current = next;
		},
		reset() {
			state = { ...NO_ZOOM };
			emit();
		},
		destroy() {
			node.removeEventListener('pointerdown', down);
			node.removeEventListener('pointermove', move);
			node.removeEventListener('pointerup', up);
			node.removeEventListener('pointercancel', up);
		}
	};
}
