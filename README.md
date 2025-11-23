# markdown-it-custom-preview

Preview Markdown using the same configuration as your project.

## Installation

- You can install this extension on the VSCode Marketplace.

## Usage

- Run the command: `Markdown-it Custom Preview: Open Preview`. This will open the preview window.
- Create a workspace-level file at `./.vscode/markdown-it-custom-preview.json` to configure your preview (see the Configuration section).
- The extension will open a single preview pane that follows the active editor. Edit a markdown file and the preview updates live.

## Configuration

Create `./.vscode/markdown-it-custom-preview.json` in your workspace root. Example:

```
{
	"fileExtensions": [".md", ".markdown"],
	"css": ["example/style.css"],
	"js": ["example/client-helper.js"],
	"npmUrls": [
		"https://cdn.jsdelivr.net/npm/markdown-it-container/dist/markdown-it-container.min.js"
	],
	"initializer": "example/init.js",
	"options": {
		"html": true,
		"linkify": true
	}
}
```

- `fileExtension` / `fileExtensions`: strings or array of strings specifying file extensions that should be considered Markdown for this preview. Defaults to `['.md', '.markdown']`.
- `css`: array of local CSS file paths (relative to the workspace root) to include in the preview.
- `js`: array of local JS file paths (relative to the workspace root) to include before the initializer.
- `npmUrls`: array of fully-qualified CDN URLs to UMD bundles for `markdown-it` plugins (the extension will inject these script tags into the webview). Use explicit UMD builds (jsDelivr/UNPKG) to avoid module format issues.
- `initializer`: path to a local JS initializer file (relative to workspace root) that will be loaded into the webview and called as `window.initMarkdownIt(md, true)`.
- `options`: object passed to `markdown-it` at construction time.

Notes:
- The extension only looks for the config at the workspace root (`.vscode/markdown-it-custom-preview.json`). This keeps configs workspace-local and predictable.

## Example initializer (example/init.js)

```
// This runs inside the webview. The extension will call initMarkdownIt(md, true)
window.initMarkdownIt = function(md, isExtension) {
	// Example: register container plugin
	if (window.markdownitContainer) {
		md.use(window.markdownitContainer, 'demo');
	}
};

// Optional fallback if plugin names are different
window.initMarkdownItFallback = window.initMarkdownIt;
```

## Commands & Settings

- Command: `markdown-it-custom-preview.openPreview` — Open/reuse the single preview for the active editor.
- Setting: `markdownItCustomPreview.openPreviewOnOpen` (boolean) — if enabled, the preview opens automatically when you open a markdown file.

You can run commands from the Command Palette (`Ctrl+Shift+P`) or bind a keyboard shortcut for quicker access.

## Troubleshooting

- If plugins fail to load, check the Webview DevTools console (right-click the preview → Inspect) for errors. Common causes:
	- CDN URL points to a non-UMD/CJS bundle (use UMD builds from jsDelivr/unpkg when possible).
	- CSP issues or invalid `localResourceRoots` when loading local assets.
- If you see JSON.parse or syntax errors in the webview template, ensure the extension is up to date — recent versions escape placeholders before runtime substitution.
- If the preview does not update, open the Extension Host console and the Webview DevTools console and look for the handshake messages: `webview ready`, `webview: received message`, and `webview: renderText completed`.

## Contributing

- Feel free to open issues and pull requests. Keep changes small and focused.
- Run `npm run compile` to build TypeScript, and `F5` in VS Code to test changes in the Extension Development Host.

## License

This project uses the repository's license (add a `LICENSE` file if you intend to publish).

----

If you want, I can also add an example `example/` folder into the repository with a working `init.js`, `style.css`, and a sample `markdown` file to demonstrate configuration and confirm the preview workflow — would you like that? 
