// Example initializer for markdown-it in the webview.
// This function will be called with the `markdown-it` instance and the value true as the only two arguments.

// This is where you can add plugins etc...
// Because this is just some file in your project, you can reuse this cofinguration
// for your actual code that renders markdown!
function initMarkdownIt(md, isExtension) {
  console.log("Initializing markdown-it for the preview. Is extension:", isExtension);
  md.use(markdownitContainer, "info");
}