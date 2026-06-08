# ClearOnStart

> A Chrome extension that clears your browsing history, cache, downloads, and form data the moment Chrome opens. No accounts, no telemetry, no surprises.

## Why

Most "clear on exit" extensions miss too much: they rely on the `chrome.windows.onRemoved` event, which MV3 service workers are not guaranteed to fire before the worker is terminated. ClearOnStart hooks into `chrome.runtime.onStartup` instead, which is the only reliable startup trigger in MV3.

## What it clears

Four categories, all essential, nothing more:

- Browsing history
- Cached images and files
- Download records
- Autofill form data

## Features

- **On-start wipe** — runs automatically when Chrome launches.
- **Manual clear** — `Clear now` button in the popup.
- **Time range** — last hour, day, week, month, or forever.
- **Per-category toggle** — disable any of the four in settings.
- **Manual save** — changes in the settings page stay unsaved until you press `Save`. A pulsing red `Save ●` button and a browser warning on close keep you from losing work.
- **Activity log** — last 25 wipes with timestamp, trigger, and result.
- **Dark mode** — follows the system, with a manual override.
- **Native notifications** — off by default, opt in if you want a desktop ping after each wipe.
- **Zero data exfiltration** — no remote endpoints, no analytics, no sync.

## Screenshots
<img width="319" height="459" alt="image" src="https://github.com/user-attachments/assets/e77dd144-4424-456f-a465-2dd201d8b085" />
<img width="1346" height="646" alt="image" src="https://github.com/user-attachments/assets/896d9c5e-3b79-494b-9e22-908b161da350" />
<img width="1352" height="635" alt="image" src="https://github.com/user-attachments/assets/b6abad34-3194-46ff-96cb-e8d318054b23" />


## Installation

### Step 1 — Download the extension files

You need the extension files on your computer. Choose one method:

**Option A — Download ZIP (easiest)**
1. Download the extension: [Download ZIP](https://github.com/Mysteriza/ClearOnStart/archive/refs/heads/main.zip).
3. Find the downloaded `.zip` file (usually in your **Downloads** folder).
4. **Right-click** the file → **Extract All...** → click **Extract**.
5. A new folder will appear — keep this folder, you'll need it in Step 3.

### Step 2 — Open Chrome Extensions page

1. Open **Google Chrome**.
2. In the address bar at the top, type `chrome://extensions` and press **Enter**.
3. You'll see the Extensions management page.

### Step 3 — Enable Developer mode

1. Look at the **top-right corner** of the Extensions page.
2. Find the toggle labeled **Developer mode**.
3. Click it to turn it **ON** (the toggle should turn blue).

### Step 4 — Load the extension

1. After enabling Developer mode, new buttons appear at the top-left.
2. Click the **Load unpacked** button.
3. A file browser window opens. Navigate to the folder you extracted/downloaded in **Step 1**.
4. Select the folder (the one containing `manifest.json`), then click **Select Folder**.

### Step 5 — Pin to toolbar (optional, recommended)

1. The **ClearOnStart** card now appears on the Extensions page.
2. Look for the **puzzle piece icon** (🧩) in Chrome's top-right toolbar.
3. Click it → find **ClearOnStart** → click the **pin icon** (📌) next to it.
4. The ClearOnStart icon now stays visible in your toolbar.

---

The extension icon appears in the toolbar. Click it to open the popup, or right-click for the menu.

### Troubleshooting

- **"Failed to load extension"** — Make sure you selected the correct folder (the one that contains `manifest.json`).
- **Want to remove it?** — Go to `chrome://extensions`, find ClearOnStart, and click **Remove**.

## How it works

The service worker listens for `chrome.runtime.onStartup`. When Chrome starts, it reads the user's preferences (which categories, what time range), calls `chrome.browsingData.remove()`, and writes a row to the local activity log.

Settings are stored in `chrome.storage.sync` (preferences) and `chrome.storage.local` (activity log). The popup and options page read directly from these stores — there is no in-memory cache to keep in sync.

## Privacy

ClearOnStart only calls the standard `chrome.browsingData` API. It does not:

- Contact any remote server.
- Read your browsing data (it only deletes it).
- Track you, fingerprint you, or store anything off your machine.

The only persisted data is your settings and the activity log, both local to your browser.

## Credits

Built on top of the Chrome Extensions MV3 platform. Fonts by [IBM Plex](https://www.ibm.com/plex/).
