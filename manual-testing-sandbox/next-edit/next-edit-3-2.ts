// A poorly structured todo list manager
// Difficulty: 2 - Multiple issues to fix

// Global variables
let todos: {
  id: number;
  text: string;
  completed: boolean;
  priority: string;
}[] = [];
let lastId = 0;

// Add a new todo
function addTodo(text: string, priority = "medium") {
  const newTodo = {
    id: ++lastId,
    text: text,
    completed: false,
    priority: priority,
  };
  todos.push(newTodo);
  return newTodo;
}

// Delete a todo by id
function deleteTodo(id: number) {
  for (let i = 0; i < todos.length; i++) {
    if (todos[i].id === id) {
      todos.splice(i, 1);
      return true;
    }
  }
  return false;
}

// Toggle todo completion status
function toggleTodo(id: number) {
  for (let i = 0; i < todos.length; i++) {
    const todo = todos[i];
    if (todo.id === id) {
      todo.completed = !todo.completed;
      return todo;
    }
  }
  return null;
}

// Update todo text
function updateTodoText(id: number, newText: string) {
  for (let i = 0; i < todos.length; i++) {
    if (todos[i].id === id) {
      todos[i].text = newText;
      return todos[i];
    }
  }
  return null;
}

// Change todo priority
function changePriority(id: number, newPriority: string) {
  for (let i = 0; i < todos.length; i++) {
    if (todos[i].id === id) {
      todos[i].priority = newPriority;
      return todos[i];
    }
  }
  return null;
}

// Filter todos by status
function filterByStatus(completed: boolean) {
  const result = [];
  for (let i = 0; i < todos.length; i++) {
    if (todos[i].completed === completed) {
      result.push(todos[i]);
    }
  }
  return result;
}

// Filter todos by priority
function filterByPriority(priority: string) {
  const result = [];
  for (let i = 0; i < todos.length; i++) {
    if (todos[i].priority === priority) {
      result.push(todos[i]);
    }
  }
  return result;
}

// Example usage
addTodo("Buy groceries", "high");
addTodo("Clean house");
addTodo("Pay bills", "high");
toggleTodo(2);

console.log("All todos:", todos);
console.log("High priority todos:", filterByPriority("high"));
console.log("Completed todos:", filterByStatus(true));

export {
  addTodo,
  changePriority,
  deleteTodo,
  filterByPriority,
  filterByStatus,
  todos,
  toggleTodo,
  updateTodoText,
};
