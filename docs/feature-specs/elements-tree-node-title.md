# Requirements Specification: Elements Panel Tree Node Title

## 1. Overview
The Elements panel represents the DOM tree as a collection of nodes. Each node's primary visual representation—its "title"—is a dynamic string of text, interactive links, and syntax-highlighted code. This specification documents the expected user-facing behaviors of the node title rendering across various DOM node types, ensuring a rich, interactive, and accurate representation of the document structure.

## 2. Node Types and Rendering Rules

### 2.1 Element Nodes (`Node.ELEMENT_NODE`)
Element nodes are the most common nodes in the tree. Their rendering depends on their state:
*   **Standard Tags**: Rendered as `<tagName attribute="value">` for opening tags and `</tagName>` for closing tags. The tag names are syntax-highlighted.
*   **Pseudo-Elements**: Rendered as `::pseudo-element-name(identifier)`.
*   **Inline Text Nodes**: If an element contains only a text node and no other children (e.g., `<div>Hello</div>`), it is rendered entirely on one line: `<tagName>Hello</tagName>`. The text content has its whitespace collapsed, and HTML entities are syntax-highlighted.
*   **Collapsed Expandable Elements**: When an element with children is collapsed, the title renders the opening tag, a clickable expand button (`▶`), a visually hidden `…` (for accessibility and layout tests), and the closing tag, all on one line.

### 2.2 Attributes
Attributes within Element nodes have complex interactive behaviors:
*   **Formatting**: Rendered natively as `name="value"`. If an attribute has no value, the `="value"` part is omitted unless explicitly forced.
*   **HTML Entities**: Unicode sequences and entities within attribute values are syntax-highlighted.
*   **Linkification (URLs)**: Values of `src` and `href` attributes, as well as complex `srcset` definitions in `<img>`, `<source>`, and `<image>` tags, are automatically detected. They are rendered as clickable links that open the resource or show an image preview popover on hover.
*   **Linkification (DOM Relations)**: Attributes that establish DOM relationships (`popovertarget`, `interesttarget`, `commandfor`) are parsed. Their values are rendered as clickable links that, when clicked, reveal the target DOM node in the Elements panel. Tooltips will read: "Reveal Popover Target", "Reveal Interest Target", or "Reveal Command For Target" respectively.

### 2.3 Text Nodes (`Node.TEXT_NODE`)
*   **Standard Text**: Rendered surrounded by double quotes (`"text"`). HTML entities within the text are highlighted.
*   **JavaScript inside `<script>`**: If the parent is a `<script>` tag, the text is treated as code. Quotes are omitted, whitespace is trimmed, and the content is passed through the JavaScript syntax highlighter.
*   **CSS inside `<style>`**: If the parent is a `<style>` tag, the text is treated as code. Quotes are omitted, whitespace is trimmed, and the content is passed through the CSS syntax highlighter.

### 2.4 Other Node Types
*   **Comment Nodes (`Node.COMMENT_NODE`)**: Rendered exactly as `<!-- comment text -->`.
*   **Doctype Nodes (`Node.DOCUMENT_TYPE_NODE`)**: Rendered in the format `<!DOCTYPE name PUBLIC "publicId" "systemId" [internalSubset]>`. Only the applicable parts of the doctype are displayed.
*   **CDATA Sections (`Node.CDATA_SECTION_NODE`)**: Rendered as `<![CDATA[text]]>`.
*   **Document Nodes (`Node.DOCUMENT_NODE`)**: Rendered as `#document (url)` where the URL is a clickable link.
*   **Document Fragments (`Node.DOCUMENT_FRAGMENT_NODE`)**: Rendered as the fragment name, with whitespace collapsed (e.g., `#document-fragment`). Shadow roots also receive specific CSS classes to indent them appropriately (`shadow-root`, `shadow-root-deep`, etc.).

## 3. Dynamic Highlighting and Interactions

### 3.1 DOM Update Flash (Animations)
When the DevTools backend reports a change to a node (via an `ElementUpdateRecord`), the specific portion of the title that changed must briefly flash with a purple highlight (`dom-update-highlight` CSS animation):
*   If an attribute was added/modified, the attribute value flashes.
*   If children were added/removed (and the element is not expanded), the tag name flashes.
*   If text content changed, the text node itself flashes.

### 3.2 Search Result Highlighting
When a user executes a search within the Elements panel (Ctrl/Cmd + F), matches found within the text representation of the node title are highlighted with a distinct yellow background span. This highlight spans across Tag names, attributes, and text values.

### 3.3 Adorners
Specific semantic markers like `slot`, `grid`, `flex`, and `popover` markers are appended to the title but managed via a separate layout/adorner system, overlaying on the line.
