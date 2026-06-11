# Is there Xanax ?

A Torn userscript that checks whether **Xanax** is available abroad in **Japan**, **United Kingdom**, and **South Africa**, then estimates whether stock is likely to still be available when you land.

The script is built for regular Torn browser use and **Torn PDA**.

## What it does

- Checks Xanax stock in Japan, UK, and South Africa.
- Uses **DroqsDB** as the primary travel-stock source.
- Falls back to **YATA** if DroqsDB fails.
- Falls back to cached stock if live sources are temporarily unavailable.
- Uses your **public Torn API key** to detect whether you are:
  - in Torn,
  - flying to a tracked country,
  - abroad,
  - or returning to Torn.
- Estimates whether stock may still be there when you land.
- Shows stock amount, price, data freshness, flight/landing estimate, and a risk label.

## Install

### Browser / Tampermonkey / Greasemonkey

Install from the raw userscript URL:

```text
https://raw.githubusercontent.com/glenn21f/is-there-xanax-tornscript/main/is-there-xanax.user.js
```

Or open the file in this repository:

```text
is-there-xanax.user.js
```

Your userscript manager should detect it as an installable userscript.

### Torn PDA

1. Open **Torn PDA**.
2. Go to **Settings → User Scripts**.
3. Add a new script.
4. Paste the contents of `is-there-xanax.user.js`.
5. Save and reload Torn.

## Recommended settings

Open the script panel using the settings button.

| Setting | Suggested value |
|---|---:|
| Flight method | PI Airstrip |
| Minimum safe stock | 50 |
| Fresh data max | 20 minutes |
| Auto-refresh | 2 minutes |

Your public Torn API key is optional, but recommended. It lets the script detect whether you are currently flying and use your actual remaining travel time.

## Data sources

Primary:

```text
https://droqsdb.com/api/public/v1/export
https://droqsdb.com/api/public/v1/meta
```

Fallback:

```text
https://yata.yt/api/v1/travel/export/
```

The script does not auto-travel, auto-buy, or click anything on your behalf. It only reads travel stock data and displays a planning estimate.

## Important limitation

Foreign stock data is crowd-sourced and can be stale. This script gives a **risk estimate**, not a guarantee. If 20 people fly for the same Xanax before you land, congratulations, you have experienced Torn.

## Auto-updates

Userscript managers check the metadata in the script header:

```javascript
// @downloadURL  https://raw.githubusercontent.com/glenn21f/is-there-xanax-tornscript/main/is-there-xanax.user.js
// @updateURL    https://raw.githubusercontent.com/glenn21f/is-there-xanax-tornscript/main/is-there-xanax.user.js
```

For updates to work cleanly:

1. Keep the filename as `is-there-xanax.user.js`.
2. Commit changes to the `main` branch.
3. Increase the `@version` number every time you want userscript managers to pick up an update.

## Repository files

```text
is-there-xanax.user.js   Main userscript
README.md                Project information and install steps
LICENSE                  MIT license
.gitignore               Basic local junk ignore file
CHANGELOG.md             Version history
```

## License

MIT License.
