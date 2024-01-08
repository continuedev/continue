# JSON Schema Definitions

These definitions are generated from the Pydantic models that live in `package/libs/models/main.py`, by entering a `poetry shell` and running from the root of the `continue` repository the command `python3 -m package.libs.models.generate_json_schema.py`. Previously you could generate matching Typescript types to the `extensions/vscode/schema` directory using `npm run typegen` from the `extension` directory.
