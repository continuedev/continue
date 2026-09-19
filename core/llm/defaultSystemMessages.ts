# PROJECT RULES AND HARDENING ADDENDUM

## HARDENING MODE ADDENDUM
When modifying, debugging, extending, or correcting systems:
The objective is not only to make code work.
The objective is to make code remain stable under future expansion.
=================================================================
STABILITY FIRST
=================================================================
Prefer:
Stable > Clever
Predictable > Elegant
Maintainable > Compact
Testable > Optimized
The engine must remain understandable six months from now.
=================================================================
NO MAGIC VALUES
=================================================================
Never introduce unexplained numbers.
Incorrect:
speed *= 1.37
Correct:
const SHIFT_PROTECTION_RADIUS = 250
All constants must have names.
All named values should be centralized where practical.
=================================================================
CONFIGURATION OVER HARDCODING
=================================================================
If a value is expected to be tuned later:
Place it in configuration.
Avoid burying gameplay values inside logic.
Examples:
- Hunger rates
- Shift timing
- Road multipliers
- Caravan intervals
- Affinity gains
Should all be configurable.
=================================================================
FAIL SAFE NOT FAIL DEAD
=================================================================
When unexpected conditions occur:
Prefer graceful degradation.
Example:
Incorrect
Crash.
Correct
Fallback behavior.
Warning logged.
System continues running.
=================================================================
NULL SAFETY
=================================================================
Before accessing:
Objects
Entities
Villages
Companions
Road nodes
Chunk references
Verify existence.
Never assume references exist.
=================================================================
DEFENSIVE SYSTEM BOUNDARIES
=================================================================
Managers should validate incoming data.
Do not trust external callers.
Validate:
Types
Ranges
Expected state
Required properties
=================================================================
FUTURE SYSTEM RULE
=================================================================
Before implementing ask:
Could a planned future system interact with this?
Examples:
- Arcane Door Network
- Property Ownership
- Noble Houses
- Romance
- Businesses
- Multiplayer
- Career Systems
- Crow Narrator
- Epoch Shifts
Avoid solutions that block future expansion.
=================================================================
EXPLICIT OWNERSHIP
=================================================================
Every system should clearly own its data.
Avoid:
Shared mutable ownership.
Always identify:
Who creates it?
Who updates it?
Who consumes it?
Who destroys it?
=================================================================
NO SILENT BEHAVIOR
=================================================================
Unexpected behavior should log.
Important state transitions should log.
Examples:
Epoch shift.
Village relocation.
Road regeneration.
Caravan destruction.
Barrier collapse.
Do not silently fail.
=================================================================
SINGLE RESPONSIBILITY RULE
=================================================================
Functions should ideally have one purpose.
If a function:
Loads data
Calculates paths
Moves a village
Updates UI
It is doing too much.
Document concerns before expanding it further.
=================================================================
REPEATED LOGIC DETECTION
=================================================================
Before adding logic:
Search for existing implementation.
Never duplicate:
Pathfinding
Inventory logic
Village ownership
Road generation
Relationship calculations
Extend existing systems instead.
=================================================================
TESTABILITY RULE
=================================================================
Every fix or enhancement should answer:
How can a tester verify this?
Provide:
Expected outcome.
Testing steps.
Success condition.
=================================================================
TECHNICAL DEBT WARNING
=================================================================
If a solution is temporary:
Clearly label it.
Examples:
TODO
TEMP FIX
REVISIT AFTER PHASE X
Never hide known debt.
=================================================================
HARDENING CHECKLIST
=================================================================
Before completion verify:
[ ] No magic values introduced
[ ] Configurable where appropriate
[ ] Null-safe
[ ] Defensive validation present
[ ] Clear ownership maintained
[ ] No duplicated logic
[ ] No silent failure paths
[ ] Future systems considered
[ ] Testing instructions provided
[ ] Technical debt documented
=================================================================
DARK FOREST ENGINE HARDENING PRINCIPLE
=================================================================
Build systems as if:
- More careers will be added.
- More villages will be added.
- More factions will be added.
- More businesses will be added.
- More AI will be added.
- More content will be added.
The solution should survive growth.
Optimize for future expansion without introducing unnecessary complexity.
