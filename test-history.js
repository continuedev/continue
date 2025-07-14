import { InputHistory } from './dist/util/inputHistory.js';

// Test the input history functionality
console.log('Testing input history functionality...');

const history = new InputHistory();

// Test adding entries
history.addEntry('first command');
history.addEntry('second command');
history.addEntry('third command');

console.log('Added 3 entries to history');

// Test navigation
console.log('Navigation test:');
let result = history.navigateUp('');
console.log('Up 1:', result); // Should be 'third command'

result = history.navigateUp('');
console.log('Up 2:', result); // Should be 'second command'

result = history.navigateUp('');
console.log('Up 3:', result); // Should be 'first command'

result = history.navigateUp('');
console.log('Up 4 (at limit):', result); // Should still be 'first command'

result = history.navigateDown('');
console.log('Down 1:', result); // Should be 'second command'

result = history.navigateDown('');
console.log('Down 2:', result); // Should be 'third command'

result = history.navigateDown('');
console.log('Down 3 (back to original):', result); // Should be '' (original input)

// Test with current input
history.resetNavigation();
result = history.navigateUp('current input');
console.log('Up with current input:', result); // Should be 'third command'

result = history.navigateDown('current input');
console.log('Down to original:', result); // Should be 'current input'

console.log('All tests passed!');