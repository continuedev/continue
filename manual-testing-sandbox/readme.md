# Manual Testing Sandbox

A collection of sample files in multiple languages used for manually testing IDE extensions and development tools.

## Purpose

This repository serves as a **test playground** for evaluating code editor features, LSP integrations, syntax highlighting, and extension behavior across a diverse set of programming languages and file formats.

## Contents

| File(s)            | Language         | Description                                                                 |
| ------------------ | ---------------- | --------------------------------------------------------------------------- |
| `app.py`           | Python           | Simple Flask web application with health check                              |
| `AdvancedPage.tsx` | React/TypeScript | Interactive UI component with dark mode toggle, counter, search, and select |
| `Calculator.java`  | Java             | Fluent-interface calculator with method chaining                            |
| `test.py`          | Python           | Fluent-interface calculator with type validation                            |
| `test.js`          | JavaScript       | Sample JS file                                                              |
| `test.ts`          | TypeScript       | Sample TS file                                                              |
| `test.kt`          | Kotlin           | Sample Kotlin file                                                          |
| `test.rs`          | Rust             | Sample Rust file                                                            |
| `test.rb`          | Ruby             | Sample Ruby file                                                            |
| `program.cs`       | C#               | Sample C# file                                                              |
| `test.php`         | PHP              | Sample PHP file                                                             |
| `test.sh`          | Bash             | Sample shell script                                                         |
| `test.css`         | CSS              | Sample stylesheet                                                           |
| `test.html`        | HTML             | Sample HTML file                                                            |
| `test.csv`         | CSV              | Sample CSV data                                                             |
| `query.sql`        | SQL              | Sample SQL query                                                            |
| `example.ipynb`    | Jupyter          | Sample notebook                                                             |
| `data.json`        | JSON             | Sample data file                                                            |
| `config.yaml`      | YAML             | Sample configuration                                                        |

## Notable Implementations

### Calculator

Both `test.py` and `Calculator.java` implement a **fluent-interface calculator** supporting:

- `add(number)`
- `subtract(number)`
- `multiply(number)`
- `divide(number)`
- `reset()`

All methods return `self` to enable chaining: `calc.add(10).subtract(5).multiply(2)`

### Flask App (`app.py`)

A lightweight REST API with:

- `GET /` — Returns a JSON welcome message
- `GET /health` — Health check endpoint (returns 200)
- Configurable port via `PORT` environment variable (default: 8080)

### React Component (`AdvancedPage.tsx`)

An interactive page featuring:

- Dark/light mode toggle with localStorage persistence
- Counter with increment button
- Search input
- Select dropdown

## Running Locally

```bash
# Start the Flask app
python app.py

# Or with Docker
docker build -t test-app .
docker run -p 8080:8080 test-app
```

## Contributing

Add new sample files to test additional language support or IDE features. Prefer self-contained examples that demonstrate common language patterns.
