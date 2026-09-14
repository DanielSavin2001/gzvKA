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

import type { Box, Point, ZoomState } from '../../sharedModels/zoom';
import {
	clampPan,
	fittedSize,
	isDoubleTap,
	isTap,
	MAX_SCALE,
	NO_ZOOM,
	panLimits,
	toggleZoom,
	zoomAbout
} from '../../sharedModels/zoom';

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

	/**
	 * The gesture is followed on `window` rather than by capturing the pointer.
	 *
	 * Capture was the obvious fix for the original bug - a swipe is a movement towards the
	 * edge, so `pointerup` usually landed outside the element and the gesture was lost - but
	 * it broke something quieter. A captured pointer retargets every later pointer event to
	 * the capturing element, and the browser synthesises the `click` from those: the
	 * next and previous arrows inside this container stopped navigating altogether, because
	 * no click ever reached the link.
	 *
	 * Listening on `window` for the rest of the gesture solves the same problem without
	 * touching what a click targets. The listeners live only for the length of one gesture.
	 */
	function down(event: PointerEvent): void {
		if (current.enabled && !current.enabled()) return;

		if (pointerId !== null) {
			// A second finger: this is a pinch, not a swipe.
			stop();
			return;
		}

		pointerId = event.pointerId;
		startX = event.clientX;
		startY = event.clientY;

		window.addEventListener('pointerup', up);
		window.addEventListener('pointercancel', cancel);
	}

	function stop(): void {
		pointerId = null;
		window.removeEventListener('pointerup', up);
		window.removeEventListener('pointercancel', cancel);
	}

	function up(event: PointerEvent): void {
		if (pointerId !== event.pointerId) return;

		const dx = event.clientX - startX;
		const dy = event.clientY - startY;
		stop();

		if (current.enabled && !current.enabled()) return;

		if (Math.abs(dx) < SWIPE_THRESHOLD) return;
		if (Math.abs(dx) < Math.abs(dy) * HORIZONTAL_RATIO) return;

		// Swiping left moves forward, the way a photo roll works everywhere else.
		if (dx < 0) current.onLeft?.();
		else current.onRight?.();
	}

	function cancel(event: PointerEvent): void {
		if (pointerId !== event.pointerId) return;
		stop();
	}

	/**
	 * A browser's own image dragging is what made this feel broken: press on a photograph,
	 * move sideways, and the browser starts dragging a ghost of the picture instead. The
	 * pointer sequence is cancelled with it, so roughly every third swipe did nothing.
	 */
	function noDrag(event: Event): void {
		event.preventDefault();
	}

	node.addEventListener('pointerdown', down);
	node.addEventListener('dragstart', noDrag);

	return {
		update(next: SwipeOptions) {
			current = next;
		},
		destroy() {
			stop();
			node.removeEventListener('pointerdown', down);
			node.removeEventListener('dragstart', noDrag);
		}
	};
}

export type { ZoomState };
export { NO_ZOOM };

export interface ZoomOptions {
	onChange: (state: ZoomState) => void;
	/** Largest magnification. Beyond about four the scan's own grain is all there is. */
	max?: number;
	/**
	 * Anything that changes when the component has reset the zoom on its own.
	 *
	 * The lightbox does that on every navigation - a photograph you have not seen yet
	 * should not open already magnified - by putting its own `zoom` back to NO_ZOOM. That
	 * only changes what is drawn. This action keeps the real state, and nothing used to
	 * tell it, so stepping to the next photograph showed it at full view while the engine
	 * still believed it was at 2.5x: the first touch made the picture leap, and the first
	 * double-tap zoomed *out* of a photograph that was not zoomed in.
	 *
	 * Passing the open index is enough. It changes exactly when a reset is wanted and can
	 * never change for any other reason.
	 */
	epoch?: unknown;
}

/**
 * Pinch to zoom, drag to pan, double-tap to toggle, wheel to zoom on a desktop.
 *
 * The browser's own pinch-zoom is no use inside a full-screen overlay: it zooms the page
 * around the overlay rather than the photograph in it. So the transform is kept here and
 * handed back to the component to apply. The arithmetic lives in `sharedModels/zoom.ts`,
 * where it is tested; what is left here is the state machine that decides which gesture is
 * happening.
 *
 * ## Why the listeners are on `window`
 *
 * Only `pointerdown` is on the element. The rest of a gesture is followed on `window`, for
 * the two reasons the `swipe` action above gives at greater length: a drag towards the edge
 * of the screen - which is most drags, because the edge is where you are trying to look -
 * otherwise leaves the container and stops being reported, and its release is never seen at
 * all, so the next touch begins inside a gesture that never ended.
 *
 * `setPointerCapture` is the other way to get that, and it is the wrong one here. Capture
 * retargets every later pointer event to the capturing element and the browser builds the
 * `click` from those, so the previous and next arrows inside this container stop navigating.
 * That is not a guess: it is written up in the comment on `swipe`, which had exactly that
 * bug and was fixed exactly this way.
 */
export function pinchZoom(node: HTMLElement, options: ZoomOptions) {
	let current: ZoomOptions = options;
	let epoch = options.epoch;
	let state: ZoomState = { ...NO_ZOOM };

	/** One finger, with where and when it landed, so a tap can be told from a drag. */
	interface Contact {
		x: number;
		y: number;
		fromX: number;
		fromY: number;
		at: number;
	}

	const points = new Map<number, Contact>();

	/**
	 * Whether this gesture has had two fingers on it at any point.
	 *
	 * Read before it is cleared, and it is the single most important flag here. A pinch
	 * ends with two `pointerup`s tens of milliseconds apart; the old code tested nothing
	 * but "two releases within 300ms" and so counted the end of every pinch as a
	 * double-tap. The zoom undid itself the instant the reader let go - which is the
	 * loudest half of "it acts very strangely when zooming".
	 */
	let multiTouch = false;

	/** The anchor a pinch is measured from: re-taken every frame, always post-clamp. */
	let pinch: { scale: number; pan: Point; mid: Point } | null = null;
	let startDistance = 0;
	let startScale = 1;

	let panFrom: { x: number; y: number; ox: number; oy: number } | null = null;
	let lastTap: { at: number; x: number; y: number } | null = null;

	const max = () => current.max ?? MAX_SCALE;

	function emit(): void {
		current.onChange({ ...state });
	}

	/**
	 * The box the photograph is shown in, and where its centre sits on screen.
	 *
	 * The padding is taken off because the `<img>` is sized against the content box, while
	 * `clientWidth` includes the padding - 16px of phantom width on a phone and 128px from
	 * the `sm` breakpoint up. The centre is the element's, which is the picture's too: the
	 * padding is symmetric and the stage centres its child, so the two coincide. If either
	 * of those ever stops being true this is the line to change.
	 */
	function view(): { centre: Point; box: Box } {
		const rect = node.getBoundingClientRect();
		const style = getComputedStyle(node);
		const side = (value: string) => Number.parseFloat(value) || 0;

		return {
			centre: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
			box: {
				width: Math.max(0, rect.width - side(style.paddingLeft) - side(style.paddingRight)),
				height: Math.max(0, rect.height - side(style.paddingTop) - side(style.paddingBottom))
			}
		};
	}

	/**
	 * The size the photograph is painted at before this action scales it.
	 *
	 * From the natural size rather than the element's box, because `object-contain`
	 * letterboxes: a landscape scan on a phone is a band across the middle with black above
	 * and below, and clamping the pan against the element let the reader drag that band up
	 * and down through the empty space. Falls back to the whole box while the image is still
	 * decoding, when `naturalWidth` is 0 - a limit of zero then would freeze the first
	 * frames of every photograph.
	 */
	function picture(box: Box): Box {
		const image = node.querySelector('img');
		if (!image) return box;

		const fitted = fittedSize({ width: image.naturalWidth, height: image.naturalHeight }, box);
		return fitted.width > 0 ? fitted : box;
	}

	/** Stores the next state, dragged back inside what the picture allows. */
	function settle(next: ZoomState): void {
		const { box } = view();
		state = clampPan(next, panLimits(picture(box), box, next.scale));
	}

	/** A screen point measured from the centre the transform scales about. */
	function about(x: number, y: number, centre: Point): Point {
		return { x: x - centre.x, y: y - centre.y };
	}

	function midpoint(): Point {
		const [a, b] = [...points.values()];
		return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
	}

	function spread(): number {
		const [a, b] = [...points.values()];
		return Math.hypot(a.x - b.x, a.y - b.y);
	}

	function beginPinch(): void {
		const { centre } = view();
		startDistance = spread();
		startScale = state.scale;
		pinch = {
			scale: state.scale,
			pan: { x: state.x, y: state.y },
			mid: about(midpoint().x, midpoint().y, centre)
		};
	}

	function forget(): void {
		points.clear();
		pinch = null;
		panFrom = null;
		lastTap = null;
		multiTouch = false;
		startDistance = 0;
	}

	function down(event: PointerEvent): void {
		points.set(event.pointerId, {
			x: event.clientX,
			y: event.clientY,
			fromX: event.clientX,
			fromY: event.clientY,
			at: event.timeStamp
		});

		if (points.size >= 2) {
			multiTouch = true;
			// A tap that was waiting for its second half must not pair with the releases
			// that end this pinch.
			lastTap = null;
			panFrom = null;
			beginPinch();
			return;
		}

		if (state.scale > 1) {
			panFrom = { x: event.clientX, y: event.clientY, ox: state.x, oy: state.y };
		}
	}

	function move(event: PointerEvent): void {
		const contact = points.get(event.pointerId);
		if (!contact) return;

		contact.x = event.clientX;
		contact.y = event.clientY;

		if (points.size >= 2 && pinch && startDistance > 0) {
			event.preventDefault();

			const { centre } = view();
			// Clamped BEFORE the offset is computed. The other order keeps sliding the
			// picture while the magnification is already pinned at its maximum, which reads
			// as the photograph escaping from under your fingers.
			const scale = Math.min(max(), Math.max(1, (startScale * spread()) / startDistance));
			const now = about(midpoint().x, midpoint().y, centre);

			settle(zoomAbout({ scale: pinch.scale, ...pinch.pan }, scale, now, pinch.mid));

			// Carried forward from the CLAMPED result, so pinching against an edge cannot
			// accumulate an offset that springs back when the fingers lift.
			pinch = { scale: state.scale, pan: { x: state.x, y: state.y }, mid: now };
			emit();
			return;
		}

		if (panFrom && state.scale > 1) {
			event.preventDefault();
			settle({
				scale: state.scale,
				x: panFrom.ox + (event.clientX - panFrom.x),
				y: panFrom.oy + (event.clientY - panFrom.y)
			});
			emit();
		}
	}

	function up(event: PointerEvent): void {
		const contact = points.get(event.pointerId);
		if (!contact) return;

		points.delete(event.pointerId);
		const pinched = multiTouch;

		if (points.size < 2) {
			pinch = null;
			startDistance = 0;
		}

		if (points.size === 1 && state.scale > 1) {
			// One finger of a pinch lifted. The pan is re-anchored to the finger still on
			// the glass instead of going dead until the reader lifts it and touches again.
			const [remaining] = [...points.values()];
			panFrom = { x: remaining.x, y: remaining.y, ox: state.x, oy: state.y };
		}

		if (points.size === 0) {
			panFrom = null;
			multiTouch = false;
		}

		// Everything below decides whether this was a tap. A release that ended a pinch
		// never is, and neither is one with a finger still down.
		if (pinched || points.size > 0) {
			lastTap = null;
			return;
		}

		const travel = Math.hypot(event.clientX - contact.fromX, event.clientY - contact.fromY);
		if (!isTap(travel, event.timeStamp - contact.at)) {
			// A swipe and a pan both end in a release. Counting those is why two swipes in
			// a row used to throw the reader to 2.5x - and then swallow the second swipe,
			// because the gate that lets a swipe through only opens at exactly 1x.
			lastTap = null;
			return;
		}

		// The arrows and the details link are inside this box. Two quick taps on "volgende"
		// are two taps on a button, not a double-tap on the photograph.
		if ((event.target as Element | null)?.closest?.('a, button')) {
			lastTap = null;
			return;
		}

		const gap = lastTap ? event.timeStamp - lastTap.at : Infinity;
		const apart = lastTap
			? Math.hypot(event.clientX - lastTap.x, event.clientY - lastTap.y)
			: Infinity;

		if (lastTap && isDoubleTap(gap, apart)) {
			const { centre } = view();
			settle(toggleZoom(state, about(event.clientX, event.clientY, centre)));
			emit();
			lastTap = null;
			return;
		}

		lastTap = { at: event.timeStamp, x: event.clientX, y: event.clientY };
	}

	/**
	 * A cancelled pointer is never a tap.
	 *
	 * Shared with `up` before, which meant the browser taking a touch away - a system
	 * gesture, a notification, a finger sliding onto the edge - armed or completed a
	 * double-tap the reader never made.
	 */
	function cancel(event: PointerEvent): void {
		if (!points.has(event.pointerId)) return;

		points.delete(event.pointerId);
		if (points.size < 2) {
			pinch = null;
			startDistance = 0;
		}
		if (points.size === 0) {
			panFrom = null;
			multiTouch = false;
		}
		lastTap = null;
	}

	/**
	 * The desktop half of the same feature.
	 *
	 * There was no way to magnify with a mouse at all: pinching needs two fingers and the
	 * only other route in was a double-click, which was as likely to happen by accident as
	 * on purpose. A reader at a desk looking for their grandmother in a school photograph
	 * is exactly who this archive is for.
	 */
	function wheel(event: WheelEvent): void {
		event.preventDefault();

		const { centre } = view();
		// Exponential, so a notch is the same proportional step whatever the magnification.
		const factor = Math.exp(-event.deltaY / 400);
		const scale = Math.min(max(), Math.max(1, state.scale * factor));

		settle(zoomAbout(state, scale, about(event.clientX, event.clientY, centre)));
		emit();
	}

	node.addEventListener('pointerdown', down);
	node.addEventListener('wheel', wheel, { passive: false });
	window.addEventListener('pointermove', move, { passive: false });
	window.addEventListener('pointerup', up);
	window.addEventListener('pointercancel', cancel);

	return {
		update(next: ZoomOptions) {
			current = next;

			// Compared, never applied blindly: `update` runs on every frame of every pinch,
			// because the option object closes over the component's own `zoom`.
			if (next.epoch !== epoch) {
				epoch = next.epoch;
				state = { ...NO_ZOOM };
				forget();
			}
		},
		destroy() {
			node.removeEventListener('pointerdown', down);
			node.removeEventListener('wheel', wheel);
			window.removeEventListener('pointermove', move);
			window.removeEventListener('pointerup', up);
			window.removeEventListener('pointercancel', cancel);
		}
	};
}
