# Ctrl+C Exit Behavior

## Overview

Ctrl+C operates on two levels:

1. **Menus/Selectors**: Immediate cancellation and return to previous state
2. **Main Application**: Two-stage exit requiring double Ctrl+C within 1 second

## Two-Stage Exit (Main Application)

### First Ctrl+C

- Shows temporary status message "ctrl+c to exit" in bottom-left status bar
- Message automatically disappears after 1 second
- Clears any text in the input field (if focused)
- Does **not** exit the application

### Second Ctrl+C (within 1 second)

- Exits the application immediately
- Performs graceful shutdown

### Second Ctrl+C (after 1 second)

- Treated as a new "first Ctrl+C"
- Shows exit message again
- User must press Ctrl+C twice within 1 second window to actually exit

## Menu/Selector Cancellation

Ctrl+C immediately cancels and returns to the previous state in all interactive menus and selectors.
