# File Hub - Google Drive Sync Extension

**File Hub** is a minimalistic and powerful Chrome/Edge extension that allows you to upload files directly to your Google Drive via Drag & Drop or file selection.

## Features

- 🚀 **Drag & Drop Upload**: Simply drag files onto the extension popup to upload.
- 📂 **Auto-Folder Creation**: Creates a "File Hub Uploads" folder in your Drive automatically.
- 🌍 **Multilingual**: Fully localized for **Turkish (TR)** and **English (EN)**.
- 🖥️ **Window Mode**: Open the extension in a separate window for a focused upload experience (Great for Linux users!).
- 🗑️ **Management**: View your recent uploads and delete files directly from the extension.
- 🎨 **Modern UI**: Clean, responsive design with dark/light mode compatibility.

## Installation

1.  Clone this repository:
    ```bash
    git clone https://github.com/palamut62/gdrive_edge_addon.git
    ```
2.  Open your browser (Chrome, Edge, Brave, etc.).
3.  Go to `chrome://extensions` (or `edge://extensions`).
4.  Enable **Developer Mode** (top right).
5.  Click **Load Unpacked** and select the cloned folder.

## Configuration (Important!)

To use the Google Drive API, you need a Client ID.

1.  Create a project in [Google Cloud Console](https://console.cloud.google.com/).
2.  Enable the **Google Drive API**.
3.  Create **OAuth 2.0 Credentials** (Web Application).
4.  Copy your **Client ID**.
5.  Open the extension, click the **Settings (Cog)** icon.
6.  Paste your Client ID into the box and click **Save**.
7.  Click **Connect with Google**.

## Development

- `popup.html`: Main UI logic.
- `popup.js`: Authentication and Drive API interactions.
- `manifest.json`: Extension configuration (Manifest V3).
- `_locales/`: Localization files for TR and EN.

## License

MIT
