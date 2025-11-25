import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

const TEMPLATE_PATH = path.join(__dirname, '..', 'media', 'webview.html');
let cachedTemplate: string | null = null;

function loadTemplate(): string {
    if (cachedTemplate !== null) { return cachedTemplate; }
    try {
        cachedTemplate = fs.readFileSync(TEMPLATE_PATH, 'utf8');
        return cachedTemplate;
    } catch (e) {
        // fallback to a minimal inline template if file read fails
        const fallback = `<!doctype html><html><body><pre>Failed to load webview template</pre></body></html>`;
        cachedTemplate = fallback;
        return cachedTemplate;
    }
}

export function getWebviewContent(webview: vscode.Webview, baseUri: vscode.Uri, config: any, initialText: string) {
    const nonce = getNonce();
    const mdCdn = 'https://cdn.jsdelivr.net/npm/markdown-it/dist/markdown-it.min.js';

    // CSS
    let cssLinks = '';
    if (Array.isArray(config.css)) {
        for (const cssPath of config.css) {
            try {
                const cssUri = vscode.Uri.joinPath(baseUri, cssPath);
                const webUri = webview.asWebviewUri(cssUri);
                cssLinks += `<link rel="stylesheet" href="${webUri.toString()}">\n`;
            } catch (e) { }
        }
    }

    // npmUrls
    let npmScripts = '';
    if (Array.isArray(config.npmUrls)) {
        for (const url of config.npmUrls) {
            npmScripts += `<script src="${url}"></script>\n`;
        }
    }

    // moduleUrls (load as ES modules)
    let moduleScripts = '';
    if (Array.isArray(config.moduleUrls)) {
        for (const url of config.moduleUrls) {
            moduleScripts += `<script type="module" nonce="${nonce}" src="${url}"></script>\n`;
        }
    }

    // extra local JS
    let extraScripts = '';
    if (Array.isArray(config.js)) {
        for (const jsPath of config.js) {
            try {
                const jsUri = vscode.Uri.joinPath(baseUri, jsPath);
                const webUri = webview.asWebviewUri(jsUri);
                extraScripts += `<script src="${webUri.toString()}"></script>\n`;
            } catch (e) { }
        }
    }

    // initializer script
    let initializerScriptTag = '';
    if (config.initializer) {
        try {
            const initUri = vscode.Uri.joinPath(baseUri, config.initializer);
            const webInit = webview.asWebviewUri(initUri);
            initializerScriptTag = `<script src="${webInit.toString()}" type="module"></script>\n`;
        } catch (e) { initializerScriptTag = ''; }
    }

    const options = config.options ? JSON.stringify(config.options) : '{}';
    // When inserting JSON into single-quoted JS string literals in the template
    // we must escape backslashes and single quotes so the produced
    // `JSON.parse('...')` call is syntactically valid at runtime.
    function escapeForSingleQuotedJS(s: string) {
        return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    }
    const optionsEscaped = escapeForSingleQuotedJS(options);
    const initialTextEscaped = escapeForSingleQuotedJS(JSON.stringify(initialText));
    const template = loadTemplate();

    let out = template
        .replace(/%%NONCE%%/g, nonce)
        .replace(/%%MD_CDN%%/g, mdCdn)
        .replace(/%%CSS_LINKS%%/g, cssLinks)
        .replace(/%%NPM_SCRIPTS%%/g, npmScripts)
        .replace(/%%MODULE_SCRIPTS%%/g, moduleScripts)
        .replace(/%%EXTRA_SCRIPTS%%/g, extraScripts)
        .replace(/%%INITIALIZER_SCRIPT%%/g, initializerScriptTag)
        .replace(/%%OPTIONS%%/g, optionsEscaped)
        .replace(/%%INITIAL_TEXT%%/g, initialTextEscaped)
        .replace(/%%CSP_SOURCE%%/g, webview.cspSource);

    return out;
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
