import * as path from 'path';
import * as vscode from 'vscode';

import { getWebviewContent } from './webviewTemplate';

export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "markdown-it-custom-preview" is now active!');

    const disposableHello = vscode.commands.registerCommand('markdown-it-custom-preview.helloWorld', () => {
        vscode.window.showInformationMessage('Hello World from markdown-it-custom-preview!');
    });
    context.subscriptions.push(disposableHello);

    // Maintain a single preview panel that follows the active editor.
    type ActivePreview = {
        panel: vscode.WebviewPanel;
        docUri: vscode.Uri;
        assetsBaseUri: vscode.Uri;
        config: any;
        panelReady: boolean;
        pendingText: string | null;
        changeDocDisposable?: vscode.Disposable;
        watchers: vscode.FileSystemWatcher[];
    } | null;

    let activePreview: ActivePreview | null = null;

    async function showPreviewForEditor(editor: vscode.TextEditor) {
        if (!editor) { return; }
        const doc = editor.document;
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(doc.uri);

        // Config is detected only at the workspace root
        let assetsBaseUri: vscode.Uri;
        let config: any = {};
        const configRootUri = workspaceFolder ? vscode.Uri.joinPath(workspaceFolder.uri, '.vscode', 'markdown-it-custom-preview.json') : undefined;
        if (workspaceFolder) {
            try {
                const bytes = await vscode.workspace.fs.readFile(configRootUri!);
                const text = Buffer.from(bytes).toString('utf8');
                config = JSON.parse(text);
                assetsBaseUri = workspaceFolder.uri;
            } catch (e) {
                config = {};
                assetsBaseUri = vscode.Uri.file(path.dirname(doc.uri.fsPath));
            }
        } else {
            config = {};
            assetsBaseUri = vscode.Uri.file(path.dirname(doc.uri.fsPath));
        }

        // Determine allowed file extensions
        let allowedExts: string[] = [];
        if (Array.isArray(config.fileExtensions)) {
            allowedExts = config.fileExtensions.map((s: string) => s.toLowerCase());
        } else if (typeof config.fileExtension === 'string') {
            allowedExts = [config.fileExtension.toLowerCase()];
        } else {
            allowedExts = ['.md', '.markdown'];
        }

        const docExt = path.extname(doc.fileName).toLowerCase();
        if (doc.languageId !== 'markdown' && allowedExts.indexOf(docExt) === -1) {
            // not a markdown document; do not show preview for it
            return;
        }

        // If we already have a panel
        if (activePreview && !(activePreview.panel as any)._disposed) {
            // If it's already previewing this document, just reveal
            if (activePreview.docUri.toString() === doc.uri.toString()) {
                try { activePreview.panel.reveal(activePreview.panel.viewColumn, true); } catch (e) {}
                return;
            }

            // Otherwise update the existing panel to preview the new document
            // Dispose old listeners/watchers
            if (activePreview.changeDocDisposable) { try { activePreview.changeDocDisposable.dispose(); } catch (e) {} }
            for (const w of activePreview.watchers) { try { w.dispose(); } catch (e) {} }

            activePreview.docUri = doc.uri;
            activePreview.assetsBaseUri = assetsBaseUri;
            activePreview.config = config;
            activePreview.panel.title = `Markdown-it Preview: ${path.basename(doc.fileName)}`;
            activePreview.panel.webview.options = { enableScripts: true, localResourceRoots: [assetsBaseUri] };
            // refresh content
            activePreview.panel.webview.html = getWebviewContent(activePreview.panel.webview, assetsBaseUri, config, doc.getText());
            activePreview.panelReady = false;
            activePreview.pendingText = null;

        } else {
            // create new panel
            const panel = vscode.window.createWebviewPanel(
                'markdownItCustomPreview',
                `Markdown-it Preview: ${path.basename(doc.fileName)}`,
                vscode.ViewColumn.Beside,
                { enableScripts: true, localResourceRoots: [assetsBaseUri] }
            );
            try { panel.reveal(panel.viewColumn, true); } catch (e) {}

            activePreview = {
                panel,
                docUri: doc.uri,
                assetsBaseUri,
                config,
                panelReady: false,
                pendingText: null,
                watchers: []
            };

            // initial content
            activePreview.panel.webview.html = getWebviewContent(activePreview.panel.webview, assetsBaseUri, config, doc.getText());

            // handle messages
            activePreview.panel.webview.onDidReceiveMessage(msg => {
                try {
                    if (!activePreview) { return; }
                    if (msg && msg.type === 'ready') {
                        console.log('markdown-it-custom-preview: webview ready');
                        activePreview.panelReady = true;
                        if (activePreview.pendingText !== null) {
                            activePreview.panel.webview.postMessage({ type: 'update', text: activePreview.pendingText });
                            activePreview.pendingText = null;
                        }
                        return;
                    }
                    if (msg && msg.type === 'rendered') {
                        console.log('Webview rendered HTML length:', (msg.html || '').length);
                        return;
                    }
                    if (msg && msg.type === 'renderError') {
                        console.error('Webview render error:', msg.error);
                        return;
                    }
                    if (msg && msg.type === 'globals') {
                        console.log('Webview globals:', msg.globals);
                        if (Array.isArray(activePreview!.config.npmUrls) && activePreview!.config.npmUrls.length && !Object.values(msg.globals).some(v => v === true)) {
                            vscode.window.showWarningMessage('Preview: configured CDN scripts not detected in webview (check URLs).');
                        }
                    } else if (msg && msg.type === 'log') {
                        console.log('Webview:', msg.level, msg.message);
                    } else {
                        console.log('Webview message:', msg);
                    }
                } catch (e) {
                    console.error('Error handling webview message', e);
                }
            });

            const disposePanel = activePreview.panel.onDidDispose(() => {
                // cleanup
                if (activePreview) {
                    if (activePreview.changeDocDisposable) { try { activePreview.changeDocDisposable.dispose(); } catch (e) {} }
                    for (const w of activePreview.watchers) { try { w.dispose(); } catch (e) {} }
                    activePreview = null;
                }
                disposePanel.dispose();
            });
        }

        // Setup file watchers for config and assets for the current activePreview
        if (!activePreview) { return; }
        const watchers: vscode.FileSystemWatcher[] = [];
        try {
            if (configRootUri) {
                const w = vscode.workspace.createFileSystemWatcher(configRootUri.fsPath);
                w.onDidChange(async () => {
                    try {
                        const bytes = await vscode.workspace.fs.readFile(configRootUri!);
                        activePreview!.config = JSON.parse(Buffer.from(bytes).toString('utf8'));
                    } catch (e) {
                        activePreview!.config = {};
                    }
                    activePreview!.panel.webview.html = getWebviewContent(activePreview!.panel.webview, activePreview!.assetsBaseUri, activePreview!.config, (await vscode.workspace.openTextDocument(activePreview!.docUri)).getText());
                });
                w.onDidCreate(async () => { activePreview!.panel.webview.html = getWebviewContent(activePreview!.panel.webview, activePreview!.assetsBaseUri, activePreview!.config, (await vscode.workspace.openTextDocument(activePreview!.docUri)).getText()); });
                w.onDidDelete(async () => { activePreview!.panel.webview.html = getWebviewContent(activePreview!.panel.webview, activePreview!.assetsBaseUri, activePreview!.config, (await vscode.workspace.openTextDocument(activePreview!.docUri)).getText()); });
                watchers.push(w);
            }

            const assetPaths: vscode.Uri[] = [];
            if (Array.isArray(activePreview.config.css)) {
                for (const p of activePreview.config.css) { try { assetPaths.push(vscode.Uri.joinPath(activePreview.assetsBaseUri, p)); } catch (e) {} }
            }
            if (Array.isArray(activePreview.config.js)) {
                for (const p of activePreview.config.js) { try { assetPaths.push(vscode.Uri.joinPath(activePreview.assetsBaseUri, p)); } catch (e) {} }
            }
            if (activePreview.config.initializer) { try { assetPaths.push(vscode.Uri.joinPath(activePreview.assetsBaseUri, activePreview.config.initializer)); } catch (e) {} }

            for (const uri of assetPaths) {
                try {
                    const w = vscode.workspace.createFileSystemWatcher(uri.fsPath);
                    w.onDidChange(() => { activePreview!.panel.webview.html = getWebviewContent(activePreview!.panel.webview, activePreview!.assetsBaseUri, activePreview!.config, (vscode.workspace.textDocuments.find(d => d.uri.toString() === activePreview!.docUri.toString()) || { getText: () => '' }).getText()); });
                    w.onDidCreate(() => { activePreview!.panel.webview.html = getWebviewContent(activePreview!.panel.webview, activePreview!.assetsBaseUri, activePreview!.config, (vscode.workspace.textDocuments.find(d => d.uri.toString() === activePreview!.docUri.toString()) || { getText: () => '' }).getText()); });
                    w.onDidDelete(() => { activePreview!.panel.webview.html = getWebviewContent(activePreview!.panel.webview, activePreview!.assetsBaseUri, activePreview!.config, (vscode.workspace.textDocuments.find(d => d.uri.toString() === activePreview!.docUri.toString()) || { getText: () => '' }).getText()); });
                    watchers.push(w);
                } catch (e) {
                    // ignore invalid paths
                }
            }
        } catch (e) {
            // ignore watcher setup errors
        }

        // dispose previous watchers and assign new ones
        if (activePreview.watchers && activePreview.watchers.length) {
            for (const w of activePreview.watchers) { try { w.dispose(); } catch (e) {} }
        }
        activePreview.watchers = watchers;

        // Listen for document changes for the previewed document
        if (activePreview.changeDocDisposable) { try { activePreview.changeDocDisposable.dispose(); } catch (e) {} }
        activePreview.changeDocDisposable = vscode.workspace.onDidChangeTextDocument(async (e) => {
            if (!activePreview) { return; }
            if (e.document.uri.toString() === activePreview.docUri.toString()) {
                const text = e.document.getText();
                console.log('markdown-it-custom-preview: document changed, sending update to webview');
                try {
                    if (!activePreview.panelReady) {
                        activePreview.pendingText = text;
                        console.log('markdown-it-custom-preview: webview not ready, buffered update');
                    } else {
                        const ok = await activePreview.panel.webview.postMessage({ type: 'update', text });
                        console.log('markdown-it-custom-preview: postMessage result', ok);
                    }
                } catch (err) {
                    console.error('markdown-it-custom-preview: postMessage error', err);
                }
            }
        });

        context.subscriptions.push(activePreview.changeDocDisposable);
    }

    const disposablePreview = vscode.commands.registerCommand('markdown-it-custom-preview.openPreview', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) { vscode.window.showInformationMessage('Open a markdown file to preview'); return; }
        await showPreviewForEditor(editor);
    });
    context.subscriptions.push(disposablePreview);

    // When the active editor changes, update the single preview (if it exists) to show that document
    const activeEditorWatcher = vscode.window.onDidChangeActiveTextEditor(async (editor) => {
        try {
            if (!editor) { return; }
            if (activePreview) {
                await showPreviewForEditor(editor);
            }
        } catch (e) { console.error('activeEditorWatcher error', e); }
    });
    context.subscriptions.push(activeEditorWatcher);

    // Helper to check whether the workspace-root config indicates this document should open a preview
    async function shouldOpenForDocument(doc: vscode.TextDocument): Promise<boolean> {
        try {
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(doc.uri);
            if (!workspaceFolder) { return false; }
            const configUri = vscode.Uri.joinPath(workspaceFolder.uri, '.vscode', 'markdown-it-custom-preview.json');
            let config: any = {};
            try {
                const bytes = await vscode.workspace.fs.readFile(configUri);
                config = JSON.parse(Buffer.from(bytes).toString('utf8'));
            } catch (e) {
                config = {};
            }
            let allowedExts: string[] = [];
            if (Array.isArray(config.fileExtensions)) {
                allowedExts = config.fileExtensions.map((s: string) => s.toLowerCase());
            } else if (typeof config.fileExtension === 'string') {
                allowedExts = [config.fileExtension.toLowerCase()];
            } else {
                allowedExts = ['.md', '.markdown'];
            }
            const docExt = path.extname(doc.fileName).toLowerCase();
            return doc.languageId === 'markdown' || allowedExts.indexOf(docExt) !== -1;
        } catch (e) {
            return false;
        }
    }

    // Auto-open preview when a document is opened if user setting is enabled
    const openOnOpen = vscode.workspace.onDidOpenTextDocument(async (doc) => {
        try {
            const cfg = vscode.workspace.getConfiguration('markdownItCustomPreview');
            console.log('markdown-it-custom-preview: onDidOpenTextDocument fired for', doc.uri.toString());
            if (!cfg.get<boolean>('openPreviewOnOpen', false)) { return; }
            if (!await shouldOpenForDocument(doc)) { return; }
            // bring the document into view (preserve focus) then open preview
            await vscode.window.showTextDocument(doc, { preview: false, preserveFocus: true });
            await vscode.commands.executeCommand('markdown-it-custom-preview.openPreview');
        } catch (e) {
            console.error('openOnOpen error', e);
        }
    });
    context.subscriptions.push(openOnOpen);
}

export function deactivate() {}
