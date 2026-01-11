// Export bookmarks to Netscape Bookmark File Format
export function exportToNetscapeFormat(
  bookmarks: chrome.bookmarks.BookmarkTreeNode[]
): string {
  let output = `<!DOCTYPE NETSCAPE-Bookmark-file-1>\n`;
  output += `<!-- This is an automatically generated file.\n`;
  output += `     It will be read and overwritten.\n`;
  output += `     DO NOT EDIT! -->\n`;
  output += `<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n`;
  output += `<TITLE>Bookmarks</TITLE>\n`;
  output += `<H1>Bookmarks</H1>\n`;
  output += `<DL><p>\n`;

  function exportNode(node: chrome.bookmarks.BookmarkTreeNode, indent: number = 1) {
    const pad = '  '.repeat(indent);

    if (node.url) {
      // It's a bookmark
      const dateAdded = node.dateAdded || Date.now();
      const timestamp = Math.floor(dateAdded / 1000);
      output += `${pad}<DT><A HREF="${escapeHtml(node.url)}" ADD_DATE="${timestamp}">${escapeHtml(node.title || node.url)}</A>\n`;
    } else {
      // It's a folder
      output += `${pad}<DT><H3 ADD_DATE="${Math.floor((node.dateAdded || Date.now()) / 1000)}">${escapeHtml(node.title)}</H3>\n`;
      output += `${pad}<DL><p>\n`;

      if (node.children) {
        for (const child of node.children) {
          exportNode(child, indent + 1);
        }
      }

      output += `${pad}</DL><p>\n`;
    }
  }

  for (const node of bookmarks) {
    exportNode(node, 1);
  }

  output += `</DL><p>\n`;

  return output;
}

// Escape HTML special characters
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return text.replace(/[&<>"']/g, char => map[char]);
}

// Export bookmarks to JSON format
export function exportToJson(
  bookmarks: chrome.bookmarks.BookmarkTreeNode[]
): string {
  return JSON.stringify(bookmarks, null, 2);
}

// Download content as file
export function downloadAsFile(content: string, filename: string, mimeType: string = 'text/html') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();

  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Export all bookmarks and trigger download
export async function exportAllBookmarks(
  filename: string = `bookmarks-export-${Date.now()}.html`
) {
  return new Promise<void>((resolve, reject) => {
    chrome.bookmarks.getTree((tree) => {
      try {
        const html = exportToNetscapeFormat(tree);
        downloadAsFile(html, filename, 'text/html');
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
}

// Export specific bookmark nodes
export function exportBookmarks(
  bookmarks: chrome.bookmarks.BookmarkTreeNode[],
  filename: string = `bookmarks-export-${Date.now()}.html`
): void {
  const html = exportToNetscapeFormat(bookmarks);
  downloadAsFile(html, filename, 'text/html');
}

// Export specific bookmark nodes as JSON
export function exportBookmarksAsJson(
  bookmarks: chrome.bookmarks.BookmarkTreeNode[],
  filename: string = `bookmarks-export-${Date.now()}.json`
): void {
  const json = exportToJson(bookmarks);
  downloadAsFile(json, filename, 'application/json');
}
