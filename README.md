# markdown-it-custom-preview

Preview Markdown using the same configuration as your project.

This extension lets you configure the preview you recieve per-repositiory using workspace files. This lets you re-use code and CSS from your project to create a custom preview that matches what your tool parses.

## Intended Usecase

This extension was designed to be used in places where you have both markdown and a markdown-it based parser in the same workspace. You can configure this extension, with a small change in your file structure, to use the same css and markdown-it plugins that your project uses.

## Installation

- You will be able to install this extension on the VSCode Marketplace in the near future.

## Usage

- Create a file at `.vscode/markdown-it-custom-preview.json` to configure your preview (see the Configuration section).
- Run the command: `Markdown-it Custom Preview: Open Preview`. This will open the preview window.
- The extension will open a single preview pane that follows the active editor. Edit a markdown file and the preview updates live.

## Configuration

Create `.vscode/markdown-it-custom-preview.json` in your workspace root. Example:

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
- `css`: array of local CSS file paths (relative to the workspace root) to include in the preview. To be used for custom styling.
- `js`: array of local JS file paths (relative to the workspace root) to include in the preview. To be used for interactivity e.g. collabsible tabs.
- `npmUrls`: array of CDN URLs to UMD bundles for `markdown-it` plugins (the extension will inject these files into the preview for use by the initializer).
- `initializer`: path to a local JS initializer file (relative to workspace root) that will be loaded into the webview and called as `window.initMarkdownIt(md, true)`.
- `options`: object passed to `markdown-it` at construction time.

Notes:
- The extension only looks for the config at the workspace root (`.vscode/markdown-it-custom-preview.json`). This keeps configs workspace-local and predictable.

## Initializer (example/init.js)

This should create a function `initMarkdownIt`. The function should take two parameters, `md`, a markdown-it instance, and `isExtension`. This is true when inside the preview, but you can set it to false when calling it in your project to get different behaviour in the extension than the program.

## Commands & Settings

- Command: `markdown-it-custom-preview.openPreview` — Open/reuse the preview for the active editor.
- Setting: `markdownItCustomPreview.openPreviewOnOpen` (boolean) — if enabled, the preview opens automatically when you open a markdown file.

You can run commands from the Command Palette (`Ctrl+Shift+P`) or bind a keyboard shortcut for quicker access.