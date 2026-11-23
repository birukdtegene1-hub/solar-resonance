# Solar Resonance Notebook

Listen to a year of solar observations. The analemma shapes the melody, and the locations and sizes of detected features on the solar disk shape the accompanying voices. The browser renders the solar portrait, chart, and steerable receiver in WebGL.

Open `index.html` in a modern browser. The player includes an archived observation window, two listening comparison clips, and stereo WAV and MP3 exports. All playback and encoding happen in the browser. The files in the repository root can also be served by a static host.

## Working on the player

- Run `npm ci` and `npm run build:receiver` after changing `receiver.mjs`. `receiver.js` is checked in so the player can run directly from disk.
- To refresh the observation window locally, install NumPy, SciPy, and Pillow, then run `python3 launch.py`. The launcher retrieves daily NASA SDO/HMI frames through Helioviewer, writes `observations.js`, and opens the player.

## Credits

Solar observations come from [NASA SDO/HMI](https://sdo.gsfc.nasa.gov/data/channels.php) via the [Helioviewer API](https://api.helioviewer.org/). The analemma uses [NOAA solar position equations](https://gml.noaa.gov/grad/solcalc/solareqns.PDF). The receiver is based on [Hairline](https://github.com/lucasmarkes/hairline). MP3 export uses [lamejs](https://github.com/shijinyu/lamejs), based on [LAME](https://lame.sourceforge.io/). Third-party notices are in `assets/`.
