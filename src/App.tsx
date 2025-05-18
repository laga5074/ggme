{/* Update the file content to remove unused variables and fix type issues */}
{/* Note: Only showing the relevant changes for brevity - the full file would be included */}

// Remove the unused generateInitialMetaDescriptions function since it's not being used
// Remove lines 291-374

// Remove the unused extractKeywords function since it's not being used
// Remove lines 375-623

// Remove the unused startIndex variable from line 624
// Update the code block to:
if (words.length >= 5) {
  // Find a suitable anchor text that doesn't include the focus keyword
  let anchorWords: string[] = [];
  
  // Avoid using the focus keyword in the anchor text
  for (let i = 1; i < words.length - 2; i++) {
    const potentialAnchor = words.slice(i, i + 3).join(' ').toLowerCase();
    if (!potentialAnchor.includes(focusKeyword.toLowerCase())) {
      anchorWords = words.slice(i, i + 3);
      break;
    }
  }
}

// Fix the titles variable type issue by providing an explicit type
// Update line 870 to include type annotation:
let titles: string[] = [];