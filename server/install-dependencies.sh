
#!/bin/bash

# Check if Poetry is installed
if ! command -v poetry &> /dev/null
then
    echo "Poetry not found, installing..."
    curl -sSL https://install.python-poetry.org | python3 -
fi

# Install or update dependencies & create .venv if it doesn't exist
echo "Installing dependencies..."
poetry install

echo "Running type generation..."
poetry run typegen

echo "Building Rust extension..."
poetry run maturin develop