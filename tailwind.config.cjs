const config = {
    content: [
        "./src/**/*.{html,js,svelte,ts}",
        "./node_modules/flowbite-svelte/**/*.{html,js,svelte,ts}",
    ],
    plugins: [
        require('flowbite/plugin')
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                // rose
                'white':'#FFFFFF',
                /*
                 * The page itself, in light mode.
                 *
                 * Pure white behind a whole screen of text is glare - and this is an archive
                 * of paper photographs, where a warm ground is closer to what the originals
                 * sit on anyway. The cards, the header and the menus stay white, so they now
                 * lift off the page instead of dissolving into it.
                 *
                 * Warm rather than grey: a cool off-white next to sepia photographs makes
                 * them look faded, and these are not faded.
                 */
                'paper': '#f7f4ec',
                /*
                 * What the body actually paints, underneath the paper grain.
                 *
                 * The grain in `app.postcss` is mid-grey noise at 15%, and any texture
                 * visible on a ground this light must darken it - the blend modes that
                 * would preserve the colour (overlay, soft-light) all screen towards
                 * white up here and flatten the grain to nothing. Measured, that costs
                 * about five levels per channel.
                 *
                 * So the body starts five levels light and lands on `paper` once the
                 * grain is composited over it. Anything that has to match the page
                 * behind it - the timeline's sticky decade strip - wants `paper`, which
                 * is the colour a reader actually sees. Only the body wants this one.
                 */
                'paper-base': '#fcf9f0',
            }
        }
    }
};

module.exports = config;