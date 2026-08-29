/**
 * Counting visits, without collecting anything before being allowed to.
 *
 * Kapellen is in Belgium, so this site's readers are in the EEA and analytics cookies need
 * consent before they are set - Google's own console says so on the install page. That
 * shapes the whole file: the tag is loaded with Consent Mode denied by default, and nothing
 * is stored until somebody says yes. Declining is a real answer that sticks, not a dialog
 * that reappears on the next page.
 *
 * Three things also switch it off entirely, before consent is even asked:
 *
 *   - a hostname that is not the live site, so pull request previews and `localhost` never
 *     land in the real statistics;
 *   - `navigator.doNotTrack`, because somebody who has set that has answered already;
 *   - no measurement id, which is how a fork or a local build gets no tracking at all.
 */

/** The GA4 property for gzvka.com. Not a secret - it is in the page source of every site. */
const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID ?? 'G-HJKBK3R57W';

/**
 * Only the real site is counted.
 *
 * Firebase gives every pull request a preview channel on `*.web.app`, and a build from this
 * repository runs there too. Counting those would quietly mix testing into the numbers
 * somebody is trying to read.
 *
 * Overridable so the archive can move, or a staging domain can be measured deliberately,
 * without editing this file - and so the consent flow can be exercised in a browser
 * without pretending to be the live site.
 */
const COUNTED_HOSTS = (import.meta.env.VITE_ANALYTICS_HOSTS ?? 'gzvka.com,www.gzvka.com')
	.split(',')
	.map((host: string) => host.trim().toLowerCase())
	.filter((host: string) => host !== '');

export const CONSENT_KEY = 'analytics-consent';

export type Consent = 'granted' | 'denied' | 'unknown';

declare global {
	interface Window {
		dataLayer?: unknown[];
		gtag?: (...args: unknown[]) => void;
	}
}

export function storedConsent(): Consent {
	try {
		const value = localStorage.getItem(CONSENT_KEY);
		return value === 'granted' || value === 'denied' ? value : 'unknown';
	} catch {
		// Storage blocked. Treat it as not having been asked, and ask again next time.
		return 'unknown';
	}
}

/** Whether this build, on this host, should count anything at all. */
export function isCountable(): boolean {
	if (!MEASUREMENT_ID) return false;

	try {
		if (navigator.doNotTrack === '1') return false;
		return COUNTED_HOSTS.includes(window.location.hostname.toLowerCase());
	} catch {
		return false;
	}
}

/**
 * Google's own snippet, verbatim, behind a typed wrapper.
 *
 * The body has to push `arguments` rather than a rest array. gtag.js reads each dataLayer
 * entry as an arguments object, and a plain array is close enough to look right in the
 * console while quietly recording nothing - which is the worst possible failure for
 * analytics, because it looks installed.
 */
function gtag(...args: unknown[]): void {
	window.dataLayer = window.dataLayer ?? [];

	if (!window.gtag) {
		window.gtag = function () {
			// eslint-disable-next-line prefer-rest-params
			window.dataLayer!.push(arguments);
		} as (...args: unknown[]) => void;
	}

	window.gtag(...args);
}

let loaded = false;

/**
 * Loads gtag.js with everything denied.
 *
 * Consent Mode means the tag may be present before an answer: with `analytics_storage`
 * denied it sets no cookies and sends no identifiers. That is what makes it safe to load
 * here rather than only after a click, and it is what Google's EEA guidance asks for.
 */
function load(): void {
	if (loaded || !isCountable()) return;
	loaded = true;

	gtag('consent', 'default', {
		ad_storage: 'denied',
		ad_user_data: 'denied',
		ad_personalization: 'denied',
		analytics_storage: 'denied',
		wait_for_update: 500
	});

	const script = document.createElement('script');
	script.async = true;
	script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
	document.head.appendChild(script);

	gtag('js', new Date());
	gtag('config', MEASUREMENT_ID, {
		// Page views are sent by hand on navigation: this is a single-page app, so gtag's
		// own automatic one only ever fires for the first page somebody lands on.
		//
		// No `anonymize_ip` here on purpose. It is a Universal Analytics parameter and GA4
		// ignores it - GA4 anonymises addresses before they are stored either way. Setting
		// it reads as a privacy control that is doing something, which in a file whose whole
		// point is to be exact about what is collected is worse than not setting it.
		send_page_view: false
	});
}

/** Records the answer and tells the tag about it. */
export function setConsent(consent: 'granted' | 'denied'): void {
	try {
		localStorage.setItem(CONSENT_KEY, consent);
	} catch {
		// Nothing to store into. The answer still holds for this visit.
	}

	if (!isCountable() || consent !== 'granted') return;

	load();
	gtag('consent', 'update', { analytics_storage: 'granted' });
	pageView(window.location.pathname + window.location.search);
}

/**
 * Loads the tag on a visit that already said yes. Does nothing otherwise.
 *
 * Somebody who declined gets no Google script at all, rather than the script loaded with
 * Consent Mode set to denied. Denied mode is the correct thing when a site needs ad
 * measurement to keep working, and it still sends cookieless pings; this archive measures
 * nothing but visits, so not loading it is both simpler and exactly what the banner
 * promises - "zonder uw toestemming meten we niets" should be literally true.
 */
export function start(): void {
	if (!isCountable() || storedConsent() !== 'granted') return;

	load();
	gtag('consent', 'update', { analytics_storage: 'granted' });
}

/**
 * One page view. Called on every navigation, because the browser only loads this site once
 * and every route change after that is invisible to gtag.
 */
export function pageView(path: string, title?: string): void {
	if (!loaded || storedConsent() !== 'granted') return;

	gtag('event', 'page_view', {
		page_path: path,
		page_location: window.location.href,
		page_title: title ?? document.title
	});
}
