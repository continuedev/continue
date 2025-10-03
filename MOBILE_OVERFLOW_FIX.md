# MCP Card Mobile Overflow Fix

## Issue

MCP card text extending outside of card on mobile due to long links that exceed the viewport width.

## Root Cause

Long URLs and text content in MCP package description cards are not properly wrapped on mobile devices, causing horizontal overflow.

## Solution

Apply CSS `word-break` and `overflow-wrap` properties to ensure text content respects container boundaries.

## CSS Fix Applied

See `mcp-card-mobile-fix.css` for the complete solution.

### Key Properties:

- `word-break: break-word` - Breaks long words at appropriate points
- `overflow-wrap: break-word` - Wraps overflowing words to new lines
- `word-break: break-all` - More aggressive breaking for mobile
- `max-width: 100%` - Ensures content doesn't exceed container
- `overflow-x: hidden` - Prevents horizontal scroll

### Target Elements:

- `.package-card .description`
- `.mcp-card .description`
- `.package-header-card .description`
- Links within descriptions

## Implementation Notes

This fix should be applied to the Continue Hub frontend (hub.continue.dev) CSS.
The selectors may need adjustment based on the actual DOM structure used in the Hub.

## Testing

Test on various mobile devices and viewport sizes:

- iPhone (375px width)
- Android phones (360px-412px width)
- Tablet portrait (768px width)

Verify that:

- Long URLs break appropriately
- Text remains readable
- No horizontal scrolling occurs
- Card layout remains intact
