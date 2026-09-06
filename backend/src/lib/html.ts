/** Small HTML helpers shared by the feed reader and the article reader. */

export function decodeEntities(input: string): string {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&amp;/g, '&')
}

export function stripTags(input: string): string {
  // CDATA sections have no closing ">" until their "]]>" terminator, so they
  // must be unwrapped before any tag stripping happens.
  const unwrapped = input.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  return decodeEntities(unwrapped.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()
}

/** Remove whole elements by tag name, ignoring attributes and casing. */
export function removeElements(html: string, tags: string[]): string {
  let output = html
  for (const tag of tags) {
    output = output.replace(new RegExp(`<${tag}\\b[\\s\\S]*?</${tag}\\s*>`, 'gi'), ' ')
  }
  return output
}
