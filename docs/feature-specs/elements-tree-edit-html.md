# HTML Edit View in Elements Tree

## Overview
The HTML Edit View allows developers to freely edit the HTML of a DOM node directly in the Elements panel. When active, it replaces the standard tree item representation with a fully functional CodeMirror editor instance.

## Requirements
1. **Triggering**: Users can trigger the HTML edit view via keyboard shortcuts (`F2` on a selected node), or via the Context Menu ("Edit as HTML").
2. **Editor UI**: When activated, the tree element's inline attributes, tags, and descendant nodes are hidden. A CodeMirror editor instance is shown in place of the node.
3. **Behavior**:
    - The editor is populated with the node's `outerHTML` (or relevant subset).
    - It supports syntax highlighting, auto-completion of tags, and proper indentation.
    - If the user clicks outside the editor or presses `Cmd+Enter` / `Ctrl+Enter`, the edit is committed.
    - If the user presses `Escape`, the edit is aborted.
4. **State Management**: Upon committing or aborting, the tree element restores its standard view, and any updated DOM state is reflected.
