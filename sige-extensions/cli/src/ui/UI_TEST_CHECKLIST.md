# TUIChat UI Test Checklist

## ✅ Simple Tests (Priority 1)

### Message Display Tests

- [ ] Empty chat displays correctly (no messages)
- [ ] Single user message displays with correct formatting (● indicator)
- [ ] Single assistant message displays with correct formatting (● indicator)
- [ ] Multiple messages display in correct order
- [ ] System messages display with correct styling (gray, italic)

### User Input Tests

- [ ] Input field shows typed text
- [ ] Input field clears after pressing Enter
- [ ] Input field handles special characters
- [ ] Input prompt shows correctly ("cn>" or custom)

### Loading State Tests

- [ ] Loading spinner appears when `isLoading` is true
- [ ] Loading spinner disappears when `isLoading` is false
- [ ] Loading text displays correctly

## 📝 Medium Complexity Tests (Priority 2)

### Tool Execution Display Tests

- [ ] Tool start indicator (○) displays correctly
- [ ] Tool name displays next to indicator
- [ ] Tool arguments display correctly
- [ ] Tool success indicator (✓) displays correctly
- [ ] Tool error indicator (✗) displays correctly
- [ ] Tool result summary displays collapsed by default
- [ ] Tool result expands when selected

### Markdown Rendering Tests

- [ ] Bold text renders correctly
- [ ] Italic text renders correctly
- [ ] Code blocks render with syntax highlighting
- [ ] Inline code renders with correct styling
- [ ] Headers render as bold
- [ ] Lists render correctly

### Component Visibility Tests

- [ ] Config selector shows when multiple configs available
- [ ] Organization selector shows when multiple orgs available
- [ ] Scroll indicators appear for long content
- [ ] Box borders render correctly

## 🔧 Complex Tests (Priority 3)

### State Transition Tests

- [ ] Message transitions from streaming to complete
- [ ] Tool execution transitions through states (start → result)
- [ ] Error states display and recover correctly
- [ ] Focus changes between input and selectors

### Scrolling and Navigation Tests

- [ ] Chat scrolls to bottom on new messages
- [ ] PageUp/PageDown scroll through history
- [ ] Home/End jump to top/bottom
- [ ] Scroll position maintains during updates

### Error Handling Tests

- [ ] API errors display user-friendly messages
- [ ] Tool errors display correctly
- [ ] Network errors handle gracefully
- [ ] Invalid input errors display

### Integration Tests

- [ ] Full conversation flow works correctly
- [ ] Tool execution integrates with message display
- [ ] Config switching updates UI correctly
- [ ] Session resume displays previous messages

## 🎯 Test Implementation Strategy

1. **Start with the simplest tests** - Message display and input handling
2. **Use minimal mocking** - Only mock what's necessary (API calls)
3. **Test user-visible behavior** - Not implementation details
4. **Keep tests focused** - One behavior per test
5. **Use descriptive test names** - Should explain what's being tested
