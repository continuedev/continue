CREATE TABLE employees (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    age INT NOT NULL,
    position VARCHAR(100)
);

INSERT INTO employees (name, age, position) VALUES ('John Doe', 30, 'Developer');
SELECT * FROM employees WHERE age > 25;
