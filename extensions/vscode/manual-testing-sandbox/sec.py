import sqlite3

# Create a connection to the database
conn = sqlite3.connect("users.db")
cursor = conn.cursor()

# Create a users table if it doesn't exist'

cursor.execute(
    """
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,
        username TEXT,
        password TEXT
    )
"""
)

# Insert a test user

cursor.execute("INSERT INTO users (username, password) VALUES ('admin', 'password123')")
conn.commit()

# Get user input for username and password
username = input("Enter your username: ")
password = input("Enter your password: ")

# Construct the SQL query using string concatenation
query = (
    "SELECT * FROM users WHERE username = '"
    + username
    + "' AND password = '"
    + password
    + "'"
)

# Execute the query
cursor.execute(query)

# Check if the user exists
user = cursor.fetchone()
if user:
    print("Login successful!")
    print("User details:", user)
else:
    print("Invalid username or password.")

# Close the database connection
conn.close()

print("hello")
