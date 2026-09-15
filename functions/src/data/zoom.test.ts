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
} from '../../../sharedModels/zoom';

/**
 * The rule these hold: whatever is under your fingers stays under your fingers.
 *
 * The lightbox used to set the scale and leave the offset alone, which pins the one
 * unmoving point of the transform to the picture's exact centre. Pinching the corner of a
 * class photograph magnified the middle of it and pushed the faces you were looking at off
 * the side of the screen. The reporter's words were "it only zooms into the centre of the
 * image, that is a horrible bug, the whole point of this archive is that you can look at
 * the pictures and zoom into it where you want it".
 *
 * The stage numbers below are a real phone: 360x560 of usable space inside a 376px-wide
 * screen, which is what the lightbox leaves after its `px-2` padding.
 */

const STAGE = { width: 360, height: 560 };

/** Where the transform actually paints a point sitting `u` from the picture's centre. */
function painted(state: { scale: number; x: number; y: number }, u: number): number {
	return state.scale * u + state.x;
}

describe('zoomAbout', () => {
	it('leaves the point under the fingers exactly where it was', () => {
		// Fingers 150px right of centre, spreading from 1x to 2.5x.
		const focus = { x: 150, y: 0 };
		const after = zoomAbout(NO_ZOOM, 2.5, focus);

		// The content that was under the fingers is at u = 150 (scale was 1, offset 0).
		expect(painted(after, 150)).toBeCloseTo(150, 6);
	});

	it('is what the old code got wrong, by 225 pixels', () => {
		// The old behaviour, written out: scale set, offset left alone.
		const old = { scale: 2.5, x: 0, y: 0 };

		expect(painted(old, 150)).toBeCloseTo(375, 6);
		expect(painted(old, 150) - 150).toBeCloseTo(225, 6);
	});

	it('holds the anchor through a second pinch from a magnified state', () => {
		const first = zoomAbout(NO_ZOOM, 2, { x: 100, y: 40 });
		const anchor = { x: -80, y: 120 };
		// The content under the new anchor, given the state we are pinching FROM.
		const u = { x: (anchor.x - first.x) / first.scale, y: (anchor.y - first.y) / first.scale };

		const second = zoomAbout(first, 3.5, anchor);

		expect(painted(second, u.x)).toBeCloseTo(anchor.x, 6);
		expect(second.scale * u.y + second.y).toBeCloseTo(anchor.y, 6);
	});

	it('pans and zooms together when the fingers drift', () => {
		// Two-finger drag: the midpoint moved 60px right while the spread grew.
		const was = { x: 20, y: 0 };
		const now = { x: 80, y: 0 };
		const u = 20; // content under the anchor at 1x, offset 0

		const after = zoomAbout(NO_ZOOM, 2, now, was);

		expect(painted(after, u)).toBeCloseTo(80, 6);
	});

	it('is the identity when nothing changes', () => {
		expect(zoomAbout(NO_ZOOM, 1, { x: 137, y: -42 })).toEqual({ scale: 1, x: 0, y: 0 });
	});

	it('survives a nonsense previous scale rather than dividing by zero', () => {
		const after = zoomAbout({ scale: 0, x: 0, y: 0 }, 2, { x: 10, y: 10 });

		expect(Number.isFinite(after.x)).toBe(true);
		expect(Number.isFinite(after.y)).toBe(true);
	});
});

describe('fittedSize', () => {
	it('letterboxes a landscape scan on a tall phone', () => {
		// A 4:3 photograph on a 360x560 stage is painted 360x270, with black above and below.
		expect(fittedSize({ width: 2000, height: 1500 }, STAGE)).toEqual({ width: 360, height: 270 });
	});

	it('pillarboxes a portrait scan', () => {
		expect(fittedSize({ width: 1000, height: 2000 }, STAGE)).toEqual({ width: 280, height: 560 });
	});

	it('says nothing for an image that has not decoded', () => {
		// naturalWidth is 0 until the bytes arrive, and a limit computed from that would
		// pin the picture at 0,0 for the first frames of every photograph.
		expect(fittedSize({ width: 0, height: 0 }, STAGE)).toEqual({ width: 0, height: 0 });
	});
});

describe('panLimits', () => {
	it('refuses to move a landscape scan vertically, whatever the magnification', () => {
		// The awkward one. 360x270 painted at 1.5x is 540x405 - wider than the stage, but
		// still 155px short of its height. The old rule offered 140px of vertical travel.
		const picture = { width: 360, height: 270 };

		expect(panLimits(picture, STAGE, 1.5)).toEqual({ x: 90, y: 0 });
	});

	it('gives exactly the overhang once the picture does overflow', () => {
		const picture = { width: 360, height: 270 };
		// 270 * 2.5 = 675, which overhangs 560 by 115, so half of that each way.
		expect(panLimits(picture, STAGE, 2.5)).toEqual({ x: 270, y: 57.5 });
	});

	it('is zero everywhere at full view', () => {
		expect(panLimits({ width: 360, height: 270 }, STAGE, 1)).toEqual({ x: 0, y: 0 });
	});

	it('is zero for a picture nothing is known about yet', () => {
		expect(panLimits({ width: 0, height: 0 }, STAGE, 4)).toEqual({ x: 0, y: 0 });
	});

	it('never lets an edge come inside the view', () => {
		const picture = { width: 280, height: 560 };
		for (let scale = 1; scale <= MAX_SCALE; scale += 0.25) {
			const limits = panLimits(picture, STAGE, scale);
			const half = (picture.height * scale) / 2;
			// Dragged to its limit, the picture's edge is still at or beyond the view's edge.
			expect(half - limits.y).toBeGreaterThanOrEqual(STAGE.height / 2 - 1e-9);
		}
	});
});

describe('clampPan', () => {
	it('drags a runaway offset back to the edge', () => {
		expect(clampPan({ scale: 2, x: 900, y: -900 }, { x: 180, y: 57 })).toEqual({
			scale: 2,
			x: 180,
			y: -57
		});
	});

	it('pins an axis that cannot move', () => {
		expect(clampPan({ scale: 1.5, x: 40, y: 40 }, { x: 90, y: 0 })).toEqual({
			scale: 1.5,
			x: 40,
			y: 0
		});
	});

	it('forgets the offset entirely once back at full view', () => {
		// Otherwise a pinch that ends at 1x leaves the photograph sitting off-centre, and
		// the swipe-to-next gate (which only opens at exactly 1x) opens on a crooked picture.
		expect(clampPan({ scale: 1, x: 120, y: -40 }, { x: 0, y: 0 })).toEqual(NO_ZOOM);
	});
});

describe('isTap', () => {
	it('accepts a real tap', () => {
		expect(isTap(3, 90)).toBe(true);
	});

	it('rejects the release of a swipe', () => {
		// This is the one that mattered: a swipe ends in a pointerup, and with no distance
		// test two swipes in a row counted as a double-tap and threw the reader to 2.5x.
		expect(isTap(180, 200)).toBe(false);
	});

	it('rejects a slow press', () => {
		expect(isTap(2, 900)).toBe(false);
	});

	it('rejects a pan, which is a long slow drag', () => {
		expect(isTap(240, 700)).toBe(false);
	});
});

describe('isDoubleTap', () => {
	it('accepts two quick taps in the same place', () => {
		expect(isDoubleTap(180, 12)).toBe(true);
	});

	it('rejects two taps at opposite ends of the screen', () => {
		expect(isDoubleTap(180, 300)).toBe(false);
	});

	it('rejects a second tap that came too late', () => {
		expect(isDoubleTap(800, 4)).toBe(false);
	});
});

describe('toggleZoom', () => {
	it('magnifies the corner you tapped, not the middle', () => {
		const at = { x: -140, y: 200 };
		const after = toggleZoom(NO_ZOOM, at);

		expect(after.scale).toBe(2.5);
		// t = at * (1 - s): the tapped content stays under the tap.
		expect(painted(after, at.x)).toBeCloseTo(at.x, 6);
	});

	it('always comes back to the whole photograph', () => {
		expect(toggleZoom({ scale: 2.5, x: -210, y: 300 }, { x: 0, y: 0 })).toEqual(NO_ZOOM);
	});
});
