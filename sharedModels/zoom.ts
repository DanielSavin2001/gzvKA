/**
 * Where a magnified photograph sits, and what a finger did to put it there.
 *
 * The lightbox draws the picture with `transform: translate(x, y) scale(s)`. A CSS
 * transform list applies right to left, so the scale happens first and the translate is in
 * unscaled screen pixels on top of it: a point sitting `u` pixels from the picture's centre
 * is painted at
 *
 *     p = centre + s * u + t
 *
 * The bug this file was written for is one line long. The pinch handler set `s` and left
 * `t` alone - and with `t` fixed, the only point of the picture that does not move is
 * `u = 0`, its exact centre. So every pinch, wherever the fingers were, magnified the
 * middle of the photograph and slid whatever you were actually looking at off towards the
 * edge of the screen. On a 376-pixel phone, pinching from 1x to 2.5x with your fingers
 * 150px right of centre pushes the detail under them 225px further right.
 *
 * For an archive whose whole point is looking closely at a scan of a street in 1938, that
 * is not a rough edge. It is the feature not working.
 *
 * ## Why this is a module and not four lines in the action
 *
 * Because it is a rule with edge cases, and this project puts those in `sharedModels/`
 * where the jest suite in `functions/` can reach them. The edge cases are real: the scale
 * has to be clamped BEFORE the offset is computed or the picture keeps sliding while the
 * magnification is already pinned at its maximum; the pan limit has to come from the
 * picture's painted size rather than the box it sits in, or a landscape scan floats up and
 * down in the letterbox; and a limit of zero has to mean "this axis cannot move" rather
 * than "no limit".
 */

export interface ZoomState {
	scale: number;
	/** Screen pixels, unscaled, applied after the scale. */
	x: number;
	y: number;
}

export interface Point {
	x: number;
	y: number;
}

export interface Box {
	width: number;
	height: number;
}

export const NO_ZOOM: ZoomState = { scale: 1, x: 0, y: 0 };

/** Beyond about four times, a scan's own grain is all there is left to see. */
export const MAX_SCALE = 4;

/**
 * The size an `object-contain` picture is actually painted at inside a box.
 *
 * The pan limits need the picture, not the box around it. A 4:3 scan in a tall phone
 * viewport is painted as a wide band with black above and below it, and clamping against
 * the box lets the reader drag that band up and down through empty space - which is a
 * large part of what "it feels very awkward" was describing.
 *
 * Returns an empty box for an image that has not decoded yet, so a caller can tell
 * "nothing to pan" from "do not know yet".
 */
export function fittedSize(natural: Box, view: Box): Box {
	if (natural.width <= 0 || natural.height <= 0) return { width: 0, height: 0 };
	if (view.width <= 0 || view.height <= 0) return { width: 0, height: 0 };

	const ratio = Math.min(view.width / natural.width, view.height / natural.height);
	return { width: natural.width * ratio, height: natural.height * ratio };
}

/**
 * How far the picture may be dragged before its own edge would come inside the view.
 *
 * Zero on an axis means the picture does not overflow there and must not move at all. The
 * old rule had no zero: it computed `box * (scale - 1) / 2` from the container, which is
 * only ever correct when the picture exactly fills the container, and which offers 140
 * pixels of vertical travel to a landscape scan that overflows by nothing.
 */
export function panLimits(picture: Box, view: Box, scale: number): Point {
	return {
		x: Math.max(0, (picture.width * scale - view.width) / 2),
		y: Math.max(0, (picture.height * scale - view.height) / 2)
	};
}

/** The same state, dragged back inside its limits. */
export function clampPan(state: ZoomState, limits: Point): ZoomState {
	if (state.scale <= 1) return { ...NO_ZOOM };

	return {
		scale: state.scale,
		x: Math.min(limits.x, Math.max(-limits.x, state.x)),
		y: Math.min(limits.y, Math.max(-limits.y, state.y))
	};
}

/**
 * Re-scale about a point, so whatever is under that point stays under it.
 *
 * `focus` and `was` are measured from the centre of the view, which is also the centre the
 * transform scales about. `was` is where the anchor sat when `from` was the current state;
 * for a double-tap the two are the same point, and for a pinch they differ by however far
 * the two fingers drifted between frames - which is what makes a two-finger drag pan and
 * zoom at once, the way it does in every photo viewer.
 *
 * The derivation is one line. The content point under the anchor is `u = (was - from) /
 * from.scale`; requiring `scale * u + t = focus` gives the offset below.
 *
 * The caller must clamp `scale` before calling. That is not a detail: pinching past the
 * maximum otherwise keeps moving the picture while the magnification stands still, which
 * reads as the photograph sliding out from under your fingers.
 */
export function zoomAbout(
	from: ZoomState,
	scale: number,
	focus: Point,
	was: Point = focus
): ZoomState {
	// A degenerate previous scale would divide by zero. It cannot happen through the action,
	// which never lets the scale below 1, but this is a shared model and the next caller is
	// not this one.
	if (!(from.scale > 0)) return { scale, x: focus.x, y: focus.y };

	return {
		scale,
		x: focus.x - (scale * (was.x - from.x)) / from.scale,
		y: focus.y - (scale * (was.y - from.y)) / from.scale
	};
}

/**
 * What separates a tap from everything else a finger does.
 *
 * These are not style preferences, they are the difference between a working gallery and
 * the one this replaced. With no test at all, "two pointerups less than 300ms apart" was a
 * double-tap - and a pinch ends with exactly two pointerups a few tens of milliseconds
 * apart. So every pinch undid itself the moment you let go. So did two quick taps on the
 * next-photo arrow, and the release of any two consecutive swipes.
 */
export const TAP = {
	/** A finger that travelled further than this was dragging, not tapping. */
	travel: 10,
	/** A contact longer than this was a press or a drag. */
	hold: 250,
	/** Two taps further apart in time than this are two separate taps. */
	gap: 300,
	/** Two taps further apart on screen than this are aimed at different things. */
	spread: 40
};

/** Whether one contact was a tap: barely moved, barely lasted. */
export function isTap(travel: number, heldMs: number): boolean {
	return travel <= TAP.travel && heldMs <= TAP.hold;
}

/** Whether a tap follows closely enough on the previous one to be its second half. */
export function isDoubleTap(gapMs: number, distance: number): boolean {
	return gapMs <= TAP.gap && distance <= TAP.spread;
}

/**
 * Where a double-tap should leave the photograph.
 *
 * Toggles, because on a phone that is the quickest way in and straight back out. Zooming in
 * anchors on the tap - double-tapping a face in the corner of a class photograph should
 * magnify that face, which is the whole of the request - and zooming out always returns to
 * the full view, because there is only one of those.
 */
export function toggleZoom(from: ZoomState, at: Point, to = 2.5): ZoomState {
	if (from.scale > 1) return { ...NO_ZOOM };

	return zoomAbout(from, to, at);
}
