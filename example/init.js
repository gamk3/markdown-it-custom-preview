// Example initializer for markdown-it in the webview.
// This function will be called with the `markdown-it` instance as the only argument.

// This is where you can add plugins etc...
// Because this is just some file in your project, you can reuse this cofinguration
// for your actual code that renders markdown!
initMarkdownIt = function(md) {
  md.use(markdownitContainer, "info");
};
