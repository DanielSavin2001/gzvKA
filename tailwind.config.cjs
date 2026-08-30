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
            }
        }
    }
};

module.exports = config;