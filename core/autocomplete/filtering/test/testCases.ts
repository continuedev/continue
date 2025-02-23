import { dedent } from "../../../util";

import { AutocompleteFileringTestInput } from "./util";

export const TEST_CASES_WITH_DIFF: AutocompleteFileringTestInput[] = [
  {
    description: "Should handle python multi-line string",
    filename: "test.py",
    input: `def create_greeting(name):
  greeting = """Hello, """ + name + """!
Welcome to our community. We hope you have a great time here.
If you have any questions, feel free to reach out."""
  return greeting

message = create_greeting("Alice")
print(message)

multi_line_message = """<|fim|>
print(multi_line_message)
`,
    llmOutput: `This is a multi-line message.
It continues across multiple lines,
which allows for easy reading and formatting.
"""
`,
    expectedCompletion: `This is a multi-line message.
It continues across multiple lines,
which allows for easy reading and formatting.
"""`,
  },
  {
    description: "Should autocomplete Rust match arms",
    filename: "main.rs",
    input: `
fn get_status_code_description(code: u16) -> &'static str {
    match code {
        200 => "OK",
        404 => "Not Found",
        500 => "Internal Server Error",
        <|fim|>
    }
}
`,
    llmOutput: `403 => "Forbidden",
        401 => "Unauthorized",
        _ => "Unknown Status",
`,
    expectedCompletion: `403 => "Forbidden",
        401 => "Unauthorized",
        _ => "Unknown Status",`,
  },
  {
    description: "Should complete a Markdown code block",
    filename: "test.md",
    input: `
Here is a sample JavaScript function:

\`\`\`javascript
function sayHello() {
  console.log("Hello, <|fim|>
}
\`\`\`
`,
    llmOutput: `world!");
`,
    expectedCompletion: 'world!");',
  },
  {
    description: "Should autocomplete Java when inside a block",
    filename: "Main.java",
    input: `
public class Main {
    public static void main(String[] args) {
        for (int i = 0; i < 10; i++) {
            if (i % 2 == 0) {
                System.out.println("Even: " + i);
            } else {
<|fim|>
            }
        }
    }
}`,
    llmOutput: `
                System.out.println("Odd: " + i);
`,
    expectedCompletion: `
                System.out.println("Odd: " + i);`,
  },
  {
    description:
      "Should autocomplete a Markdown heading and preserve formatting",
    filename: "test.md",
    input: `# My Document

## Introduction
This is a sample document for testing.

## <|fim|>
### Conclusion
Thank you for reading.
`,
    llmOutput: `Features
Here is a list of features:
- Feature 1
- Feature 2
`,
    expectedCompletion: `Features
Here is a list of features:
- Feature 1
- Feature 2`,
  },
  {
    // options: { only: true },
    description: "Should autocomplete a Java method within a class",
    filename: "Calculator.java",
    input: `
public class Calculator {
    private double result;

    public Calculator() {
        this.result = 0.0;
    }

    public void add(double number) {
        result += number;
<|fim|>`,
    llmOutput: `
    }

    public void subtract(double number) {
        result -= number;
    }
`,
    expectedCompletion: `
    }`,
  },
  {
    description: "Should filter out consecutive, repeated YAML keys",
    filename: "test.yaml",
    input: `
      version: '3'
      services:
        db:
          image: postgres
          environment:
            POSTGRES_USER: user
            POSTGRES_PASSWORD: pass<|fim|>
    `,
    llmOutput: `
            POSTGRES_DB: mydb
            POSTGRES_DB: mydb
    `,
    expectedCompletion: `
            POSTGRES_DB: mydb`,
  },
  {
    description: "Should enforce bracket matching in JSON files",
    filename: "test.json",
    input: `{
  "active": true,
  "department": "Product Development",
  "location": {
    "country": "USA",
    "state": "California",
    "city": "San BERNARDINO",
    "coordinates": {
      <|fim|>
    }
  },
  "employees": [
    {
      "name": "John Doe",
      "age": 30,
      "position": "Developer",
      "skills": ["JavaScript", "React", "Node.js"],
      "remote": false,
      "salary": {
        "currency": "USD",
        "amount": 95000
      }
    },
    {
      "name": "Jane Smith",
      "age": 25,
      "position": "Designer",
      "skills": ["Photoshop", "Illustrator"],
      "remote": true,
      "salary": {
        "currency": "USD",
        "amount": 70000
      }
    },
    {
      "name": "Emily Johnson",
      "age": 35,
      "position": "Manager",
      "teamSize": 8,
      "remote": true,
      "skills": ["Leadership", "Project Management"],`,
    llmOutput: `"latitude": 34.10834,
      "longitude": -117.28977
    }
  },
  "employeeCount": 2,
  "averageAge": 30,
  "remoteFriendly": true,
  "salaryRange": {
    "min": 70000,
    "max": 95000,
    "currency": "USD"
  },
  "skills": {
    "required": ["JavaScript", "React", "Node.js", "Leadership", "Project Management"],
    "optional": ["Photoshop", "Illustrator"]`,
    expectedCompletion: `"latitude": 34.10834,
      "longitude": -117.28977`,
  },
  {
    description:
      "Should return nothing when output is duplicated lines in TypeScript",
    filename: "file.ts",
    input: `
async getContextForPath(
    filepath: string,
    astPath: AstPatt,
    language: LanguageName,
    options: ContextOptions = {},
<|fim|>
  ): Promise<AutocompleteCodeSnippet[]> {
    const snippets: AutocompleteCodeSnippet[] = [];
    let parentKey = filepath;
`,
    llmOutput: `  ): Promise<AutocompleteCodeSnippet[]> {
    const snippets: AutocompleteCodeSnippet[] = [];
    `,
    expectedCompletion: undefined,
  },
  {
    description:
      "Should return partial result when output is duplicated lines in TypeScript",
    filename: "file.ts",
    input: `
async getContextForPath(
    filepath: string,
    astPath: AstPatt,
    language: LanguageName,
    options: ContextOptions = {},
<|fim|>
  ): Promise<AutocompleteCodeSnippet[]> {
    const snippets: AutocompleteCodeSnippet[] = [];
    let parentKey = filepath;
`,
    llmOutput: `console.log('TEST');
      ): Promise<AutocompleteCodeSnippet[]> {
    const snippets: AutocompleteCodeSnippet[] = [];
    `,
    expectedCompletion: `console.log('TEST');`,
  },
  {
    description: "Should autocomplete React effect hook",
    input: `import React, { useState, useEffect } from "react";

export const Timer = () => {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds(seconds + 1);
    }, 1000);

    <|fim|>;

    return () => clearInterval(interval);
  }, [seconds]);

  return (
    <div>
      <p>{seconds} seconds have passed.</p>
    </div>
  );
};`,
    llmOutput: "return () => clearInterval(interval);",
    expectedCompletion: undefined,
    filename: "Timer.tsx",
  },
  {
    description: "Should autocomplete simple return statement in TypeScript",
    filename: "file.ts",
    input: `
  multiply(number) {
    this.result *= number;
    return <|fim|>
  }

  divide(number) {
    if (number === 0) {
      throw new Error("Cannot divide by zero");
    }
    this.result /= number;
    return this;
  }
`,
    llmOutput: ` this;`,
    expectedCompletion: `this;`,
  },
  {
    description: "Should complete YAML list item and preserve structure",
    filename: "test.yaml",
    input: `
      services:
        - name: web
          image: nginx
        - name: app<|fim|>
      volumes:
        - volume1
        - volume2
    `,
    llmOutput: `
          image: node
    `,
    expectedCompletion: `
          image: node`,
  },
  {
    description:
      "Should complete YAML key-value pair inside a nested structure",
    filename: "test.yaml",
    input: `
      version: '3'
      services:
        db:
          image: postgres
          environment:
            POSTGRES_USER: user
            POSTGRES_PASSWORD: pass
            POSTGRES_DB: mydb<|fim|>
    `,
    llmOutput: `
            PGDATA: /var/lib/postgresql/data/pgdata
    `,
    expectedCompletion: `
            PGDATA: /var/lib/postgresql/data/pgdata`,
  },
  {
    description: "Should complete YAML block within an existing block",
    filename: "test.yaml",
    input: `
      pipelines:
        branches:
          master:
            - step:
                name: Build and Test
                script:
                  - npm install
                  - npm run test
            - step:
                name: Deploy<|fim|>
    `,
    llmOutput: `
                script:
                  - npm run deploy
    `,
    expectedCompletion: `
                script:
                  - npm run deploy`,
  },
  {
    description:
      "Should autocomplete SQL query with subquery and alias in SELECT clause",
    filename: "complex_query.sql",
    input: `SELECT u.id, 
                  u.name, 
                  (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) AS order_count
          FROM users u
          WHERE u.active = 1
          <|fim|>`,
    llmOutput:
      " AND EXISTS (SELECT 1 FROM transactions t WHERE t.user_id = u.id AND t.amount > 100)",
    expectedCompletion:
      "AND EXISTS (SELECT 1 FROM transactions t WHERE t.user_id = u.id AND t.amount > 100)",
  },
];

export const TEST_CASES_WITHOUT_DIFF: AutocompleteFileringTestInput[] = [
  {
    description: "should pass",
    filename: "test.js",
    input: "console.log('Hello <|fim|>!');",
    llmOutput: "World",
    expectedCompletion: "World",
  },
  {
    description:
      "Should preserve closing brackets when the opening bracket is not a part of the completion.",
    filename: "test.js",
    input: dedent`
      class Calculator {
        constructor() {
          this.result = 0;
        }

        add(number) {
          this.result += number;
          return this;
        }

        subtract(number) {
          this.result -= number;
          return this;
        }

        multiply(number) {
          this.result *= number;
          return this;
        }

        divide(number) {
          <|fim|>

        getResult() {
          return this.result;
        }

        reset() {
          this.result = 0;
          return this;
        }
      }
    `,
    llmOutput: dedent`if (number === 0) {
            throw new Error("Cannot divide by zero");
        }
        this.result /= number;
        return this;
    }`,
    expectedCompletion: dedent`if (number === 0) {
            throw new Error("Cannot divide by zero");
        }
        this.result /= number;
        return this;
    }`,
  },
  {
    description: "Should multiline-autocomplete CSS blocks",
    input: `body {
  font-family: Arial, sans-serif;
  font-size: 16px;
  color: #333333;
}

h1 {
  font-size: 24px;
  font-weight: bold;
  color: #000000;
}

h4<|fim|>

a {
  text-decoration: none;
  color: #007bff;
}

.container {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.button {
  display: inline-block;
  padding: 10px 20px;
  background-color: #007bff;
  color: #ffffff;`,
    llmOutput: ` {
  font-size: 18px;
  font-weight: bold;
  color: #000000;
}`,
    expectedCompletion: ` {
  font-size: 18px;
  font-weight: bold;
  color: #000000;
}`,
    filename: "test.css",
  },
  {
    description: "Should complete CSS rules inside a nested selector",
    filename: "styles.css",
    input: `
.container {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100vh;
  
  .inner {
    <|fim|>
  }
}
`,
    llmOutput: `width: 50%;
    height: 50%;
    background-color: #f0f0f0;`,
    expectedCompletion: `width: 50%;
    height: 50%;
    background-color: #f0f0f0;`,
  },

  {
    description:
      "Should complete a CSS rule when the property is partially typed",
    filename: "styles.css",
    input: `
button {
  border: 2px solid #000;
  border-radius<|fim|>
}`,
    llmOutput: ": 5px;",
    expectedCompletion: ": 5px;",
  },

  {
    description: "Should handle CSS autocomplete with a single bracket present",
    filename: "styles.css",
    input: `
.card {
  box-shadow: 0 4px 8px rgba(0,0,0,0.2);
  transition: 0.3s;
  padding: 16px;
  border-bottom-left-radius: <|fim|>px;
  border-bottom-right-radius: 8px;
}
`,
    llmOutput: "8",
    expectedCompletion: "8",
  },

  {
    description: "Should autocomplete CSS pseudoclass",
    filename: "pseudoClass.css",
    input: `
input:focus {
  outline: none;
  border: 2px solid <|fim|>;
}
`,
    llmOutput: "#4CAF50;",
    expectedCompletion: "#4CAF50;",
  },

  {
    description: "Should handle CSS variable syntax",
    filename: "variables.css",
    input: `
:root {
  --primary-color: #3498db;
  --padding: 10px;
}

.section {
  background-color: var(<|fim|>);
  padding: var(--padding);
}
`,
    llmOutput: "--primary-color",
    expectedCompletion: "--primary-color",
  },
  {
    description: "Should complete CSS grid template columns",
    filename: "grid.css",
    input: `
.grid-container {
  display: grid;
  grid-template-columns: repeat(<|fim|>);
  grid-gap: 10px;
}
`,
    llmOutput: "3, 1fr",
    expectedCompletion: "3, 1fr",
  },

  {
    description: "Should complete PHP function inside a class with comments",
    input: `<?php

class User {
    private $name;
    private $email;

    public function __construct($name, $email) {
        $this->name = $name;
        $this->email = $email;
    }

    public function <|fim|>
    
    public function setEmail($email) {
        $this->email = $email;
    }
}`,
    llmOutput: `getDetails() {
        return "Name: " . $this->name . ", Email: " . $this->email;
    }`,
    expectedCompletion: `getDetails() {
        return "Name: " . $this->name . ", Email: " . $this->email;
    }`,
    filename: "User.php",
  },

  {
    description: "Should autocomplete PHP function with inline logic",
    input: `<?php

function calculateArea($length, $width) {
    <|fim|>
}

echo calculateArea(5, 3);`,
    llmOutput: "return $length * $width;",
    expectedCompletion: "return $length * $width;",
    filename: "areaCalculator.php",
  },

  {
    description: "Should handle PHP completion in the middle of an array",
    input: `<?php

$colors = array("Red", "Green", <|fim|>);

echo "First color is: " . $colors[0];`,
    llmOutput: '"Blue"',
    expectedCompletion: '"Blue"',
    filename: "colors.php",
  },
  {
    description: "Should autocomplete React return statements (jsx)",
    input: `import React from "react";

export const Button = ({
  onClick,
  children,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) => {
  return (
<|fim|>
  );
};`,
    llmOutput: `<button onClick={onClick} className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
      {children}
    </button>`,
    expectedCompletion: `<button onClick={onClick} className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
      {children}
    </button>`,
    filename: "Button.tsx",
  },
  {
    description: "Should autocomplete React state initialization",
    input: `import React, { useState } from "react";

export const Counter = () => {
  const [count, setCount] = useState(<|fim|>);

  return (
    <div>
      <p>You clicked {count} times</p>
      <button onClick={() => setCount(count + 1)}>Click me</button>
    </div>
  );
};`,
    llmOutput: "0",
    expectedCompletion: "0",
    filename: "Counter.tsx",
  },
  {
    description: "Should autocomplete React component methods",
    input: `import React from "react";

class Form extends React.Component {
  constructor(props) {
    super(props);
    this.state = { name: '' };
  }

  handleChange = (event) => {
    <|fim|>
  }

  handleSubmit = (event) => {
    event.preventDefault();
    alert('A name was submitted: ' + this.state.name);
  }

  render() {
    return (
      <form onSubmit={this.handleSubmit}>
        <label>
          Name:
          <input type="text" value={this.state.name} onChange={this.handleChange} />
        </label>
        <input type="submit" value="Submit" />
      </form>
    );
  }
}`,
    llmOutput: "this.setState({ name: event.target.value });",
    expectedCompletion: "this.setState({ name: event.target.value });",
    filename: "Form.tsx",
  },
  {
    description: "Should autocomplete Python function definition",
    filename: "test.py",
    input: `def calculate_area(length, width):
    area = length * width
    return area

def calculate_perimeter(length, width):
    <|fim|>
`,
    llmOutput: `perimeter = 2 * (length + width)
    return perimeter`,
    expectedCompletion: `perimeter = 2 * (length + width)
    return perimeter`,
  },
  {
    description: "Should complete Python class method with self",
    filename: "test.py",
    input: `class BankAccount:
    def __init__(self, owner, balance=0):
        self.owner = owner
        self.balance = balance

    def deposit(self, amount):
        self.balance += amount
        return self.balance

    def withdraw(self, amount):
        <|fim|>
`,
    llmOutput: `if amount > self.balance:
            return "Insufficient funds"
        self.balance -= amount
        return self.balance`,
    expectedCompletion: `if amount > self.balance:
            return "Insufficient funds"
        self.balance -= amount
        return self.balance`,
  },
  {
    description: "Should autocomplete Python list comprehension",
    filename: "test.py",
    input: `squares = [x**2 for x in range(10)]
even_squares = [x for x in squares if x % 2 == 0]
print(even_squares)

odd_squares = [<|fim|>
print(odd_squares)
`,
    llmOutput: "x for x in squares if x % 2 != 0",
    expectedCompletion: "x for x in squares if x % 2 != 0",
  },
  {
    description: "Should autocomplete a simple Go function declaration",
    filename: "simpleFunction.go",
    input: `package main

import (
	"fmt"
)

func main() {
	fmt.Println("Hello, World!")
}

func calculateArea<|fim|>`,
    llmOutput: `(length float64, width float64) float64 {
    return length * width
}`,
    expectedCompletion: `(length float64, width float64) float64 {
    return length * width
}`,
  },

  {
    description:
      "Should handle autocomplete in the middle of a Go struct definition",
    filename: "structDefinition.go",
    input: `package main

type Person struct {
    FirstName string
    LastName  string
    Age       int
    Address   Address
}

type Address struct {
    Street string
    City   <|fim|>
}

func main() {}`,
    llmOutput: `string
    State   string
    ZipCode string
}`,
    expectedCompletion: `string
    State   string
    ZipCode string`,
  },

  {
    description: "Should autocomplete a missing Go function body bracket",
    filename: "missingBracket.go",
    input: `package main

func add(a int, b int) int {
    return a + b<|fim|>

func multiply(a int, b int) int {
    return a * b
}

func main() {
    result1 := add(2, 3)
    result2 := multiply(4, 5)
    println(result1, result2)
}`,
    llmOutput: `
}`,
    expectedCompletion: `
}`,
  },
  {
    description:
      "Should autocomplete SQL query with nested functions and missing bracket",
    filename: "_nested_function.sql",
    input: `SELECT name, ROUND(AVG(rating), 2) as avg_rating
           FROM movies
           WHERE release_year > 2000 AND director = 'Christopher Nolan'
           GROUP BY name
           HAVING avg_rating > <|fim|>`,
    llmOutput: "8.5)",
    expectedCompletion: "8.5)",
  },
  {
    description:
      "Should autocomplete SQL script with employee and product tables",
    filename: "database.sql",
    input: `
  CREATE TABLE employees (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    age INT NOT NULL,
    position VARCHAR(100)
  );
  
  CREATE TABLE products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100),
    price DECIMAL(8,2) NOT NULL<|fim|> '0.00',
    quantity INT NOT NULL DEFAULT '0'
  );
  
  INSERT INTO employees (name, age, position) VALUES ('John Doe', 30, 'Developer');
  INSERT INTO products (name, price, quantity) VALUES ('Apple', '1.99', '47');
  
  SELECT * FROM products ORDER BY name DESC LIMIT 3;
  SELECT * FROM products WHERE price > '0';
  SELECT * FROM products WHERE quantity > '100';
  SELECT * FROM employees WHERE age > 25;
  `,
    llmOutput: " DEFAULT",
    expectedCompletion: " DEFAULT",
  },
  {
    description:
      "Should autocomplete multi-line SQL query with CASE statements",
    filename: "case_statement.sql",
    input: `SELECT order_id,
                  order_date,
                  CASE 
                    WHEN status = 'shipped' THEN 'Completed'
                    WHEN status = 'pending' THEN 'Pending Approval'
                    <|fim|>
                  ELSE 'Unknown'
                  END as order_status
           FROM orders`,
    llmOutput: "WHEN status = 'cancelled' THEN 'Cancelled'",
    expectedCompletion: "WHEN status = 'cancelled' THEN 'Cancelled'",
  },
  {
    description: "Should autocomplete HTML paragraph content",
    input: `<html>
<head>
  <title>Document</title>
</head>
<body>
  <p><|fim|></p>
</body>
</html>`,
    llmOutput: "This is a paragraph with some sample text.",
    expectedCompletion: "This is a paragraph with some sample text.",
    filename: "test.html",
  },
  {
    description: "Should autocomplete HTML attributes within a tag",
    input: `<div class="card">
  <img src="image.jpg" <|fim|>>
  <div class="container">
    <h4><b>Title</b></h4>
    <p>Description text.</p>
  </div>
</div>`,
    llmOutput: 'alt="Description of image"',
    expectedCompletion: 'alt="Description of image"',
    filename: "test.html",
  },
  {
    description: "Should autocomplete HTML nested tags",
    input: `<ul>
  <li>Item 1</li>
  <li>Item 2</li>
  <li>Item 3</li>
  <li<|fim|></ul>`,
    llmOutput: ">Item 4</li>",
    expectedCompletion: ">Item 4</li>",
    filename: "test.html",
  },

  {
    description: "Should complete a class method in Ruby",
    input: `
class Greeter
  def initialize(name)
    @name = name
  end

  def greet
    puts "Hello, <|fim|>
  end
end

g = Greeter.new("World")
g.greet
`,
    llmOutput: "#{@name}!",
    expectedCompletion: "#{@name}!",
    filename: "greeter.rb",
  },
  {
    description: "Should complete Ruby if-else block",
    input: `
number = 10

if number > 5
  puts "Number is greater than 5"
<|fim|>
end
`,
    llmOutput: `else
  puts "Number is 5 or less"`,
    expectedCompletion: `else
  puts "Number is 5 or less"`,
    filename: "conditional.rb",
  },
  {
    description: "Should complete Ruby array method",
    input: `
numbers = [1, 2, 3, 4, 5]
squared_numbers = numbers.<|fim|>
`,
    llmOutput: "map { |n| n ** 2 }",
    expectedCompletion: "map { |n| n ** 2 }",
    filename: "array_methods.rb",
  },
  {
    description: "Should autocomplete Java within a string",
    filename: "App.java",
    input: `
public class App {
    public static void main(String[] args) {
        String message = "Hello, <|fim|>";
        System.out.println(message);
    }
}`,
    llmOutput: "World",
    expectedCompletion: "World",
  },
  {
    description:
      "Should autocomplete a C++ class definition with a constructor",
    filename: "test.cpp",
    input: "class Vehicle { public: Vehicle(<|fim|>); };",
    llmOutput: "int wheels, double weight",
    expectedCompletion: "int wheels, double weight",
  },
  {
    description: "Should complete a C++ method declaration inside a class",
    filename: "test.cpp",
    input:
      "class Calculator { public: int add(int a, int b); int subtract(int a, int b);<|fim|> };",
    llmOutput: " int multiply(int a, int b);",
    expectedCompletion: " int multiply(int a, int b);",
  },
  {
    description: "Should autocomplete C++ for loop syntax",
    filename: "test.cpp",
    input: `
    int sum = 0;
    for (int i = 0; i < 10; <|fim|>) {
        sum += i;
    }
    `,
    llmOutput: "i++",
    expectedCompletion: "i++",
  },
  {
    description: "Should autocomplete JSON object inside an array",
    filename: "data.json",
    input: `{
  "users": [
    { "id": 1, "name": "Alice" },
    { "id": 2, "name": "Bob" }
    <|fim|>
  ]
}`,
    llmOutput: ', { "id": 3, "name": "Charlie" }',
    expectedCompletion: ', { "id": 3, "name": "Charlie" }',
  },
  {
    description: "Should autocomplete within a CSV record",
    filename: "test.csv",
    input: `Name, Age, City
John Doe, 30, New York
Jane Smith<|fim|>`,
    llmOutput: ", 25, Los Angeles",
    expectedCompletion: ", 25, Los Angeles",
  },
  {
    description:
      "Should complete CSV record when starting in the middle of a word",
    filename: "test.csv",
    input: `Product, Price, Quantity
Laptop, 1200, 5
Smart<|fim|>`,
    llmOutput: "phone, 800, 10",
    expectedCompletion: "phone, 800, 10",
  },
  {
    description: "Should complete CSV structure adding closing brackets",
    filename: "test.csv",
    input: `ID, Name, JoiningDate
1, Alice, 2023-01-10
2, B<|fim|>`,
    llmOutput: "ob, 2023-02-10",
    expectedCompletion: "ob, 2023-02-10",
  },
  {
    description:
      "Should autocomplete a Rust function implementation inside a struct",
    filename: "main.rs",
    input: `
struct Calculator {
    result: f64,
}

impl Calculator {
    fn new() -> Self {
        Calculator { result: 0.0 }
    }

    fn add(&mut self, number: f64) {
        self.result += number;
    }

    fn subtract(&mut self, number: f64) {
        self.result -= number;
    }

    fn multiply(&mut self, number: f64) {
        self.result *= number;
    }

    fn divide(&mut self, number: f64) {
        if number != 0.0 {
            self.result /= number;
        } else {
            println!("Cannot divide by zero.");
        }
    }

    fn reset(&mut self) {
        self.result = 0.0;
    }

    fn get_result(&self) -> f64 {
        self.result
    }

    fn<|fim|>
}
`,
    llmOutput: ` divide(&mut self, number: f64) {
    if number != 0.0 {
        self.result /= number;
    } else {
        println!("Cannot divide by zero.");
    }
}`,
    expectedCompletion: ` divide(&mut self, number: f64) {
    if number != 0.0 {
        self.result /= number;
    } else {
        println!("Cannot divide by zero.");
    }`,
  },
  {
    description: "Should autocomplete Rust struct definition",
    filename: "main.rs",
    input: `
struct User {
    id: u32,
    username: String,
    email: String,
    is_active: bool,
    <|fim|>
}

impl User {
    fn new(id: u32, username: String, email: String) -> Self {
        User {
            id,
            username,
            email,
            is_active: true,
        }
    }
}
`,
    llmOutput: `created_at: String,
    updated_at: String,`,
    expectedCompletion: `created_at: String,
    updated_at: String,`,
  },
  {
    description: "Haskell: Nested pattern matching with let bindings",
    filename: "NestedPattern.hs",
    input: `module NestedPattern where

data Tree a = Leaf a | Node (Tree a) (Tree a)

sumTree :: Num a => Tree a -> a
sumTree (Leaf x) = x
sumTree (Node left right) =
  let leftSum = <|fim|>
      rightSum = sumTree right
  in leftSum + rightSum`,
    llmOutput: "sumTree left",
    expectedCompletion: "sumTree left",
  },
  {
    description: "Haskell: Complex function with where clause and guards",
    filename: "QuadraticSolver.hs",
    input: `module QuadraticSolver where

solveQuadratic :: (Ord a, Floating a) => a -> a -> a -> Maybe (a, a)
solveQuadratic a b c
  | discriminant < 0 = Nothing
  | otherwise = Just (x1, x2)
  where
    discriminant = b^2 - 4*a*c
    sqrtD = sqrt discriminant
    x1 = (-b + sqrtD) / (2*a)
    <|fim|> = (-b - sqrtD) / (2*a)`,
    llmOutput: "x2",
    expectedCompletion: "x2",
  },
  {
    description: "Haskell: List comprehension with complex filter",
    filename: "PrimeNumbers.hs",
    input: `module PrimeNumbers where

primesUpTo :: Int -> [Int]
primesUpTo n = [x | x <- [2..n], isPrime x]
  where isPrime num = <|fim|> && all (\d -> num \`mod\` d /= 0) [2..(floor . sqrt $ fromIntegral num)]`,
    llmOutput: "num > 1",
    expectedCompletion: "num > 1",
  },
  {
    description: "Should autocomplete Dart class methods",
    filename: "calculator.dart",
    input: `
class Calculator {
  double result = 0.0;

  void add(double number) {
    result += number;
  }

  void multiply(double number) {
    result *= number;
  }

  <|fim|>

  double getResult() {
    return result;
  }
}`,
    llmOutput: `void subtract(double number) {
    result -= number;
  }`,
    expectedCompletion: `void subtract(double number) {
    result -= number;
  }`,
  },
  {
    description: "Should handle string interpolation in Dart",
    filename: "greetings.dart",
    input: `
void main() {
  var name = "World";
  print('Hello, <|fim|>!');
}`,
    llmOutput: "${name}",
    expectedCompletion: "${name}",
  },
  {
    description: "Should autocomplete within a Dart function body",
    filename: "counter.dart",
    input: `
class Counter {
  int count = 0;

  void increment() {
    count++;
  }

  void decrement() {
    <|fim|>

  void reset() {
    count = 0;
  }
}`,
    llmOutput: "count--;",
    expectedCompletion: "count--;",
  },
  {
    description:
      "Should autocomplete Clojure function definition with missing closing parenthesis",
    input: `(defn calculate-sum [a b]
  (let [sum (+ a b)]
    (println "The sum is" sum)
    sum<|fim|>`,
    llmOutput: "))",
    expectedCompletion: "))",
    filename: "test.clj",
  },
  {
    description:
      "Should autocomplete missing part of a Clojure map within a function",
    input: `(defn get-user []
  {:username "johndoe"
   :email "johndoe@example.com"
   :age 30
   <|fim|>
  (println "User information loaded"))`,
    llmOutput: ':location "Unknown"}',
    expectedCompletion: ':location "Unknown"}',
    filename: "test.clj",
  },
  {
    description:
      "Should autocomplete inside a Clojure vector within a looping construct",
    input: `(defn odd-numbers []
  (loop [nums [1 3 5<|fim|> 9 11]]
    (when (seq nums)
      (println (first nums))
      (recur (rest nums)))))`,
    llmOutput: " 7,",
    expectedCompletion: " 7,",
    filename: "test.clj",
  },
  {
    description: "Should autocomplete R function definition",
    filename: "calculate.R",
    input: `
calculate_mean <- function(numbers) {
  total <- sum(numbers)
  <|fim|>
}`,
    llmOutput: `mean_value <- total / length(numbers)
  return(mean_value)`,
    expectedCompletion: `mean_value <- total / length(numbers)
  return(mean_value)`,
  },
  {
    description: "Should complete R loop and print statement",
    filename: "loopPrint.R",
    input: `
numbers <- c(1, 2, 3, 4, 5)
for (number in numbers) {
  print(<|fim|>)
}`,
    llmOutput: "number)",
    expectedCompletion: "number)",
  },
  {
    description: "Should autocomplete R data frame creation",
    filename: "dataFrame.R",
    input: `
data <- data.frame(
  Name = c("Alice", "Bob", "Charlie"),
  Age = c(25, 30, 35),
  <|fim|>
)`,
    llmOutput: "Height = c(165, 180, 175)",
    expectedCompletion: "Height = c(165, 180, 175)",
  },
  {
    description: "Should autocomplete R if-else statement",
    filename: "condition.R",
    input: `
grade <- 85
if (grade >= 90) {
  print("A")
} else if (grade >= 80) {
  <|fim|>
} else {
  print("C")
}`,
    llmOutput: 'print("B")',
    expectedCompletion: 'print("B")',
  },
  {
    description: "Should autocomplete R ggplot2 plot structure",
    filename: "plot.R",
    input: `
library(ggplot2)

ggplot(data=mtcars, aes(x=wt, y=mpg)) +
  geom_point() +
  <|fim|>`,
    llmOutput: "geom_smooth(method='lm', se=FALSE)",
    expectedCompletion: "geom_smooth(method='lm', se=FALSE)",
  },
  {
    description: "Should autocomplete Scala class with a method",
    filename: "Person.scala",
    input: `class Person(val name: String, val age: Int) {
      def greet(): String = {
        <|fim|>
      }
  }`,
    llmOutput: 's"Hello, my name is $name and I am $age years old."',
    expectedCompletion: 's"Hello, my name is $name and I am $age years old."',
  },

  {
    description: "Should handle Scala case class with a missing field",
    filename: "Person.scala",
    input: `case class Address(city: String, postalCode: String)
  case class Person(name: String, age: Int, address: Address)
  
  val alice = Person("Alice", 30, Address("Wonderland", <|fim|>))`,
    llmOutput: '"12345")',
    expectedCompletion: '"12345")',
  },

  {
    description: "Should autocomplete Scala function with missing body bracket",
    filename: "Math.scala",
    input: `object MathUtils {
    def add(a: Int, b: Int): Int = {
      a + b<|fim|>
  
    def multiply(a: Int, b: Int): Int = {
      a * b
    }
  }
  
  object Main extends App {
    println(MathUtils.add(3, 5))
    println(MathUtils.multiply(4, 6))
  }`,
    llmOutput: `
  }`,
    expectedCompletion: `
  }`,
  },
  {
    description: "Should autocomplete C function definition",
    filename: "math_utils.c",
    input: `#include <stdio.h>

int add(int a, int b) {
    return a + b;
}

int multiply(int a, int b) {
    return a * b;
}

int subtract(int a, int b) {
    <|fim|>
}

int main() {
    printf("Result: %d", add(2, 3));
    return 0;
}`,
    llmOutput: "return a - b;",
    expectedCompletion: "return a - b;",
  },

  {
    description: "Should handle C struct with missing field initialization",
    filename: "person.c",
    input: `#include <stdio.h>

typedef struct {
    char name[50];
    int age;
    float height;
} Person;

int main() {
    Person alice = {"Alice", 30, <|fim|>};
    printf("Name: %s, Age: %d, Height: %.2f", alice.name, alice.age, alice.height);
    return 0;
}`,
    llmOutput: "5.5",
    expectedCompletion: "5.5",
  },

  {
    description: "Should autocomplete C function with missing body bracket",
    filename: "area.c",
    input: `#include <stdio.h>

double calculateCircleArea(double radius) {
    const double pi = 3.14159;
    return pi * radius * radius;<|fim|>

double calculateRectangleArea(double length, double width) {
    return length * width;
}

int main() {
    printf("Circle Area: %.2f", calculateCircleArea(5.0));
    printf("Rectangle Area: %.2f", calculateRectangleArea(4.0, 6.0));
    return 0;
}`,
    llmOutput: `
}`,
    expectedCompletion: `
}`,
  },
  {
    description: "Should autocomplete a simple Kotlin function declaration",
    filename: "simpleFunction.kt",
    input: `
fun main() {
    println("Hello, World!")
}

fun calculateArea(length: Double, width: Double): Double <|fim|>`,
    llmOutput: `{
    return length * width
}`,
    expectedCompletion: `{
    return length * width
}`,
  },
  {
    description: "Should handle autocomplete inside a Kotlin data class",
    filename: "dataClass.kt",
    input: `
data class User(
    val id: Int,
    val name: String,
    val email: String,
    <|fim|>
)`,
    llmOutput: "val age: Int",
    expectedCompletion: "val age: Int",
  },
  {
    description:
      "Should complete Kotlin if-else structure with missing brackets",
    filename: "controlStructure.kt",
    input: `
fun getMax(a: Int, b: Int): Int {
    if (a > b<|fim|>
    } else {
        return b
    }
}`,
    llmOutput: `) {
        return a`,
    expectedCompletion: `) {
        return a`,
  },
  {
    description: "Should autocomplete Solidity function definition",
    filename: "SimpleStorage.sol",
    input: `
pragma solidity ^0.8.0;

contract SimpleStorage {
    uint private data;
    
    function set(uint x) public {
        data = x;
    }

    function get() public view returns (uint) {
        <|fim|>
    }
}
  `,
    llmOutput: "return data;",
    expectedCompletion: "return data;",
  },

  {
    description: "Should autocomplete Solidity event with parameters",
    filename: "EventExample.sol",
    input: `
pragma solidity ^0.8.0;

contract EventExample {
    event DataStored(uint indexed id, string content);

    function storeData(uint id, string memory content) public {
        emit DataStored(<|fim|>);
    }
}
  `,
    llmOutput: "id, content",
    expectedCompletion: "id, content",
  },

  {
    description: "Should handle Solidity struct definition completion",
    filename: "StructDefinition.sol",
    input: `
pragma solidity ^0.8.0;

contract StructExample {
    struct Person {
        string name;
        uint age;
        address wallet;
    }

    Person[] private people;

    function addPerson(string memory name, uint age, address wallet) public {
        people.push(Person(name, age, wallet));
    }

    function getFirstPerson<|fim|>
}
  `,
    llmOutput: `() public view returns (string memory, uint, address) {
        if (people.length > 0) {
            Person storage person = people[0];
            return (person.name, person.age, person.wallet);
        }
        return ("", 0, address(0));
    }`,
    expectedCompletion: `() public view returns (string memory, uint, address) {
        if (people.length > 0) {
            Person storage person = people[0];
            return (person.name, person.age, person.wallet);
        }
        return ("", 0, address(0));
    }`,
  },
  {
    description: "Should autocomplete TypeScript interface properties",
    filename: "User.ts",
    input: `
interface User {
  id: number;
  name: string;
  e<|fim|>
}
`,
    llmOutput: `mail: string;
  age: number;
}`,
    expectedCompletion: `mail: string;
  age: number;`,
  },
  {
    description: "Should autocomplete TypeScript interface declarations",
    filename: "autocomplete.ts",
    input: `interface AutocompleteDiffSnippet extends BaseAutocompleteSnippet {}

interface AutocompleteCodeSnippet`,
    llmOutput: ` extends BaseAutocompleteSnippet {
  filepath: string;
}`,
    expectedCompletion: ` extends BaseAutocompleteSnippet {
  filepath: string;
}`,
  },
  {
    description:
      "Should autocomplete a TypeScript arrow function inside a variable assignment",
    filename: "mathOperations.ts",
    input: `
const addNumbers = (a: number, b: number): number => {
  return a + b;
};

const multiplyNumbers = (a: number, b: number): number => {
  re<|fim|>
}

console.log(multiplyNumbers(2, 3));
`,
    llmOutput: "turn a * b;",
    expectedCompletion: "turn a * b;",
  },

  // TODO
  //   {
  //     description:
  //       "Should handle autocomplete inside a nested TypeScript class method",
  //     filename: "Account.ts",
  //     input: `
  // class Account {
  //   private balance: number = 0;

  //   deposit(amount: number) {
  //     this.balance += amount;
  //     return this.balance;
  //   }

  //   withdraw(amount: number) {
  //     if (amount > this.balance) {
  //       throw new Error("Insufficient funds");
  //     }
  //     this.balance -= amount;
  //     return thi<|fim|>
  //   }
  // }
  // `,
  //     llmOutput: `s.balance;`,
  //     expectedCompletion: `s.balance;`,
  //   },

  // TODO
  //   {
  //     description: "Should autocomplete a TypeScript generic function",
  //     filename: "GenericFunction.ts",
  //     input: `
  // function identity<T>(arg: T): T {
  //   return ar<|fim|>
  // }

  // console.log(identity<number>(5));
  // `,
  //     llmOutput: `g;`,
  //     expectedCompletion: `g;`,
  //   },

  // TODO
  //   {
  //     description:
  //       "Should autocomplete a TypeScript promise within an asynchronous function",
  //     filename: "asyncFunction.ts",
  //     input: `
  // async function fetchData(url: string): Promise<unknown> {
  //   const response = await fetch(url);
  //   <|fim|>
  //   return data;
  // }

  // fetchData('https://api.example.com/data');
  // `,
  //     llmOutput: `const data = await response.json();`,
  //     expectedCompletion: `const data = await response.json();`,
  //   },

  {
    description:
      "Should autocomplete a C# class with a constructor and property",
    filename: "Person.cs",
    input: `using System;

public class Person
{
    public string Name { get; set; }
    public int Age { get; set; }

    public Person(string name, int <|fim|>
}`,
    llmOutput: `age)
    {
        Name = name;
        Age = age;
    }`,
    expectedCompletion: `age)
    {
        Name = name;
        Age = age;
    }`,
  },
  {
    description: "Should autocomplete a C# interface method",
    filename: "IGreetable.cs",
    input: `public interface IGreetable
{
    void <|fim|>
}`,
    llmOutput: "Greet();",
    expectedCompletion: "Greet();",
  },
  {
    description: "Should autocomplete inside C# method with if condition",
    filename: "Calculator.cs",
    input: `using System;

public class Calculator
{
    public int Add(int a, int b)
    {
        if(<|fim|>)
        {
            return a + b;
        }
        return 0;
    }
}`,
    llmOutput: "a > 0 && b > 0",
    expectedCompletion: "a > 0 && b > 0",
  },
  {
    description: "Should complete a simple Julia function",
    filename: "simpleFunction.jl",
    input: `function calculate_area(length, width)
    <|fim|>
end
`,
    llmOutput: "return length * width",
    expectedCompletion: "return length * width",
  },
  {
    description: "Should autocomplete Julia for loop",
    filename: "loop.jl",
    input: `numbers = [1, 2, 3, 4, 5]
squared_numbers = []

for num in numbers
  <|fim|>
end

println(squared_numbers)
`,
    llmOutput: "push!(squared_numbers, num^2)",
    expectedCompletion: "push!(squared_numbers, num^2)",
  },
  {
    description: "Should complete a Julia struct definition",
    filename: "structDefinition.jl",
    input: `struct Person
    first_name::String
    last_name::String
    age::Int
    address::Address
end

struct Address
    street::String
    city::String
    <|fim|>
end
`,
    llmOutput: `state::String
    zip_code::String`,
    expectedCompletion: `state::String
    zip_code::String`,
  },
  {
    description: "Should complete a Julia dictionary access",
    filename: "dictionary.jl",
    input: `grades = Dict("Alice" => 90, "Bob" => 85, "Eve" => 88)

function get_grade(student_name)
    return grades[<|fim|>]
end

println(get_grade("Alice")) # Should print 90
`,
    llmOutput: "student_name",
    expectedCompletion: "student_name",
  },
  {
    description: "Should complete a Julia module declaration",
    filename: "moduleDeclaration.jl",
    input: `module MathOperations

export add, subtract

function add(a, b)
    return a + b
end

function subtract(a, b)
    return a - b
end

<|fim|>
`,
    llmOutput: "end",
    expectedCompletion: "end",
  },
  {
    description: "Should complete F# let-binding with function definition",
    filename: "mathModule.fs",
    input: `module MathModule

let calculateArea length width =
    <|fim|>`,
    llmOutput: "length * width",
    expectedCompletion: "length * width",
  },

  {
    description: "Should complete incomplete F# type definition",
    filename: "personType.fs",
    input: `type Person = {
    FirstName: string
    LastName: string
    Age: int<|fim|>
}

let john = { FirstName = "John"; LastName = "Doe"; Age = 30 }`,
    llmOutput: `
    Address: string
}`,
    expectedCompletion: `
    Address: string`,
  },

  {
    description: "Should complete F# pattern matching expression",
    filename: "patternMatching.fs",
    input: `let describeNumber number =
    match number with
    | 0 -> "Zero"
    | 1 -> "One"
    | <|fim|>`,
    llmOutput: `2 -> "Two"
    | _ -> "Other"`,
    expectedCompletion: `2 -> "Two"
    | _ -> "Other"`,
  },

  {
    description: "Should complete F# list comprehension expression",
    filename: "listComprehension.fs",
    input: `let squares = [ for x in 1..10 -> x * x ]
let evenSquares = [ for x in squares do if x % 2 = 0 then yield x ]
let oddSquares = [<|fim|>]`,
    llmOutput: " for x in squares do if x % 2 <> 0 then yield x ]",
    expectedCompletion: " for x in squares do if x % 2 <> 0 then yield x ]",
  },
  {
    description: "Should complete an F# recursive function",
    filename: "recursiveFunctions.fs",
    input: `let rec factorial n =
    if n <= 1 then 1
    else n <|fim|> factorial (n - 1)`,
    llmOutput: "*",
    expectedCompletion: "*",
  },
  {
    description: "Should complete F# member method inside a class type",
    filename: "bankAccount.fs",
    input: `type BankAccount(owner: string, initialBalance: float) =
    let mutable balance = initialBalance
    
    member this.Deposit amount =
        balance <- balance + amount
        this
    <|fim|>`,
    llmOutput: `
    member this.Withdraw amount =
        if amount > balance then
            failwith "Insufficient funds"
        balance <- balance - amount
        this`,
    expectedCompletion: `
    member this.Withdraw amount =
        if amount > balance then
            failwith "Insufficient funds"
        balance <- balance - amount
        this`,
  },

  {
    description: "Should complete F# async workflow function",
    filename: "asyncWorkflow.fs",
    input: `let fetchDataAsync url =
    async {
        use client = new System.Net.Http.HttpClient()
        <|fim|>
    }`,
    llmOutput: `let! response = client.GetStringAsync(url)
        return response`,
    expectedCompletion: `let! response = client.GetStringAsync(url)
        return response`,
  },
  {
    description: "Should autocomplete SCSS nested class starting inside a rule",
    filename: "styles.scss",
    input: `nav {
  display: flex;
  justify-content: space-between;
  .logo {
    font-size: 1.5rem;
    color: #333;

    .brand<|fim|>
  }

  ul {
    list-style: none;
    display: flex;
    gap: 1rem;
  }
}`,
    llmOutput: `-name {
    font-weight: bold;
    text-transform: uppercase;
}`,
    expectedCompletion: `-name {
    font-weight: bold;
    text-transform: uppercase;
}`,
  },

  {
    description: "Should handle SCSS mixin within a class",
    filename: "styles.scss",
    input: `.card {
  border: 1px solid #ccc;
  padding: 10px;
  
  @include<|fim|>

  &:hover {
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  }
}`,
    llmOutput: " transition(all 0.3s ease);",
    expectedCompletion: " transition(all 0.3s ease);",
  },

  {
    description:
      "Should autocomplete SCSS variable in the middle of a statement",
    filename: "styles.scss",
    input: `$primary-color: #007bff;
$secondary-color: #6c757d;

.button {
  background-color: <|fim|> color;
  padding: 10px 15px;
  border: none;
  color: #fff;
  border-radius: 4px;
}`,
    llmOutput: "$primary-",
    expectedCompletion: "$primary-",
  },
  {
    description: "Should autocomplete Vue component method",
    filename: "MyComponent.vue",
    input: `<template>
  <div>
    <button @click="incrementCounter">Increment</button>
    <p>Count: {{ count }}</p>
  </div>
</template>

<script>
export default {
  data() {
    return {
      count: 0,
    };
  },
  methods: {
    incrementCounter() {
      this.count += 1;
    },
    resetCounter<|fim|>
  },
};
</script>
`,
    llmOutput: `() {
      this.count = 0;
    }`,
    expectedCompletion: `() {
      this.count = 0;
    }`,
  },
  {
    description: "Should autocomplete Vue computed property",
    filename: "UserComponent.vue",
    input: `<template>
  <div>
    <p>User Full Name: {{ fullName }}</p>
  </div>
</template>

<script>
export default {
  data() {
    return {
      firstName: 'John',
      lastName: 'Doe',
    };
  },
  computed: {
    fullName<|fim|>
  },
};
</script>
`,
    llmOutput: `() {
      return this.firstName + ' ' + this.lastName;
    }`,
    expectedCompletion: `() {
      return this.firstName + ' ' + this.lastName;
    }`,
  },
  {
    description: "Should autocomplete Vue method using props",
    filename: "TodoItem.vue",
    input: `<template>
  <li>
    <p>{{ title }}</p>
    <button @click="completeTodo">Complete</button>
  </li>
</template>

<script>
export default {
  props: {
    title: String,
    completed: Boolean,
  },
  methods: {
    completeTodo() {
      <|fim|> = true;
    }
  },
};
</script>
`,
    llmOutput: "this.completed",
    expectedCompletion: "this.completed",
  },
  {
    description: "Should autocomplete Svelte reactive statement",
    filename: "Counter.svelte",
    input: `
<script>
  let count = 0;

  $: <|fim|>

  function handleClick() {
    count += 1;
  }
</script>

<button on:click={handleClick}>
  Clicked {count} times
</button>
`,
    llmOutput: "doubledCount = count * 2",
    expectedCompletion: "doubledCount = count * 2",
  },

  {
    description: "Should autocomplete Svelte component inside HTML",
    filename: "NestedComponent.svelte",
    input: `
<script>
  import ChildComponent from './ChildComponent.svelte';
</script>

<main>
  <h1>Hello Svelte</h1>
  <ChildComponent <|fim|> />
</main>
`,
    llmOutput: 'name="World"',
    expectedCompletion: 'name="World"',
  },

  {
    description: "Should handle autocomplete in Svelte each block",
    filename: "List.svelte",
    input: `
<script>
  let items = ["Apple", "Banana", "Cherry"];
</script>

<ul>
  {#each items as item}
    <li>{item}</li>
  {/each<|fim|>
</ul>
`,
    llmOutput: "}",
    expectedCompletion: "}",
  },
  {
    description:
      "Should handle autocomplete in two similar TypeScript functions",
    filename: "List.svelte",
    input: `
import { createClient, RedisClientType } from "redis";
import { IKeyValueStore } from "./index.js";

export class RedisKeyValueStore implements IKeyValueStore {
  private client: RedisClientType;

  constructor(redisUrl: string) {
    this.client = createClient({
      url: redisUrl
        .replace("https://", "redis://")
        .replace("http://", "redis://"),
    });
    this.client.on("connect", () => console.log("Redis Connected"));
    this.client.on("error", (err) => console.log("Redis Client Error", err));
    this.client.connect();
  }
  public async has(tableName: string, key: string): Promise<boolean> {
    return (await this.client.exists(this._getKey(tableName, key))) > 0;
  }

  public async keys(tableName: string): Promise<string[]> {
    const keys = await this.client.keys(this._getTableKey(tableName));
    return keys.map((key) => key.split("::")[1]);
  }

  public async put(
    tableName: string,
    key: string,
    value: string,
  ): Promise<void> {
    await this.client.set(this._getKey(tableName, key), value);
  }

  public async get(
    tableName: string,
    key: string,
  ): Promise<string | undefined> {
    const value = await this.client.get(this._getKey(tableName, key));
    return value ?? undefined;
  }

  public async deleteAll(tableName: string): Promise<void> {
    await this.client.del(this._getTableKey(tableName));
  }

<|fim|>
  

  public async remove(tableName: string, key: string): Promise<boolean> {
    const result = await this.client.del(this._getKey(tableName, key));
    return result > 0;
  }
}
`,
    llmOutput: `  public async delete(tableName: string, key: string): Promise<void> {
    await this.client.del(this._getKey(tableName, key));
  }`,
    expectedCompletion: `  public async delete(tableName: string, key: string): Promise<void> {
    await this.client.del(this._getKey(tableName, key));
  }`,
  },
];
