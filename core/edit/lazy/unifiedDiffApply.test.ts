import { applyUnifiedDiff, isUnifiedDiffFormat } from "./unifiedDiffApply";

describe("isUnifiedDiffFormat", () => {
  it("should return true for valid unified diff format", () => {
    const validDiff = `--- original.txt
+++ modified.txt
@@ -1,3 +1,4 @@
 line1
-line2
+newline2
+newline3
 line3`;
    expect(isUnifiedDiffFormat(validDiff)).toBe(true);
  });

  it("should return false for empty diff", () => {
    expect(isUnifiedDiffFormat("")).toBe(false);
  });

  it("should return false for diff without hunk header", () => {
    const invalidDiff = `--- original.txt
+++ modified.txt
+line1
-line2
+line3`;
    expect(isUnifiedDiffFormat(invalidDiff)).toBe(false);
  });

  it("should return false for diff without valid content", () => {
    const invalidDiff = `--- original.txt
+++ modified.txt
@@ -1,3 +1,4 @@`;
    expect(isUnifiedDiffFormat(invalidDiff)).toBe(false);
  });

  it("should return true even without file headers if hunk headers exist", () => {
    const diffWithoutFileHeaders = `@@ -1,3 +1,4 @@
 line1
-line2
+newline2
+newline3
 line3`;
    expect(isUnifiedDiffFormat(diffWithoutFileHeaders)).toBe(true);
  });

	it("should return true in case of empty lines", () => {
    const diffWithoutFileHeaders = `@@ -1,3 +1,4 @@
 line1
-line2
+newline2
 line3`;
    expect(isUnifiedDiffFormat(diffWithoutFileHeaders)).toBe(true);
  });
});

describe("applyUnifiedDiff", () => {
  it("should correctly apply a add line of unified diff", () => {
    const sourceCode = `func main() {
    scanner := bufio.NewScanner(os.Stdin)
    fmt.Println("Calculator started! Available operations:")
    fmt.Println("  +  : Addition")
    fmt.Println("  -  : Subtraction")
    fmt.Println("  *  : Multiplication")
    fmt.Println("  /  : Division")
    fmt.Println("  ^  : Power")
    fmt.Println("  √  : Square root (use only one number)")
}
// End of file`;

    const diffText = `--- original.go
+++ updated.go
@@ -30,6 +30,7 @@
     fmt.Println("  /  : Division")
     fmt.Println("  ^  : Power")
     fmt.Println("  √  : Square root (use only one number)")
+    fmt.Println("  log: Logarithm (use 'log base number')")
 }`;

    const result = applyUnifiedDiff(sourceCode, diffText);

    const expected = [
      { type: "same", line: "func main() {" },
      { type: "same", line: "    scanner := bufio.NewScanner(os.Stdin)" },
      { type: "same", line: "    fmt.Println(\"Calculator started! Available operations:\")" },
      { type: "same", line: "    fmt.Println(\"  +  : Addition\")" },
      { type: "same", line: "    fmt.Println(\"  -  : Subtraction\")" },
      { type: "same", line: "    fmt.Println(\"  *  : Multiplication\")" },
      { type: "same", line: "    fmt.Println(\"  /  : Division\")" },
      { type: "same", line: "    fmt.Println(\"  ^  : Power\")" },
      { type: "same", line: "    fmt.Println(\"  √  : Square root (use only one number)\")" },
      { type: "new", line: "    fmt.Println(\"  log: Logarithm (use 'log base number')\")" },
      { type: "same", line: "}" },
      { type: "same", line: "// End of file" }
    ];

    expect(result).toEqual(expected);
  });

  it("should correctly apply multiple insertions and deletions", () => {
    const sourceCode = `package main
import "fmt"
func main() {
  fmt.Println("Hello")
  fmt.Println("World")
}`;

    const diffText = `--- original.go
+++ updated.go
@@ -1,8 +1,11 @@
 package main
 
-import "fmt"
+import (
+  "fmt"
+  "time"
+)
 
 func main() {
-  fmt.Println("Hello")
+  fmt.Printf("The time is: %v\\n", time.Now())
-  fmt.Println("World")
+  fmt.Println("Goodbye!")
 }`;
    const result = applyUnifiedDiff(sourceCode, diffText);

    const expected = [
      { type: "same", line: "package main" },
      { type: "same", line: "" },
      { type: "old", line: "import \"fmt\"" },
      { type: "new", line: "import (" },
      { type: "new", line: "  \"fmt\"" },
      { type: "new", line: "  \"time\"" },
      { type: "new", line: ")" },
      { type: "same", line: "" },
      { type: "same", line: "func main() {" },
      { type: "old", line: "  fmt.Println(\"Hello\")" },
      { type: "new", line: "  fmt.Printf(\"The time is: %v\\n\", time.Now())" },
      { type: "old", line: "  fmt.Println(\"World\")" },
      { type: "new", line: "  fmt.Println(\"Goodbye!\")" },
      { type: "same", line: "}" }
    ];

    expect(result).toEqual(expected);
  });

  it("should correctly apply multiple diff blocks", () => {
    const sourceCode = `package main
import (
	"bufio"
	"fmt"
	"math"
	"os"
	"strconv"
	"strings"
	"testing"
)
func main() {
	scanner := bufio.NewScanner(os.Stdin)
	fmt.Println("Calculator started! Available operations:")
	fmt.Println("  +  : Addition")
	fmt.Println("  -  : Subtraction")
	fmt.Println("  *  : Multiplication")
	fmt.Println("  /  : Division")
	fmt.Println("  ^  : Power")
	fmt.Println("  √  : Square root (use only one number)")
	for {
		fmt.Print("Enter calculation (e.g., 5 + 3 or √ 16) or 'q' to quit: ")
		scanner.Scan()
		input := scanner.Text()
		if strings.ToLower(input) == "q" {
			fmt.Println("Goodbye!")
			break
		}
		result, err := calculate(input)
		if err != nil {
			fmt.Printf("Error: %v\n", err)
			continue
		}
		fmt.Printf("Result: %v\n", result)
	}
}
func calculate(input string) (float64, error) {
	parts := strings.Fields(input)
	if len(parts) < 2 {
		return 0, fmt.Errorf("invalid input format: please use 'number operator number' or '√ number'")
	}
	if parts[0] == "√" {
		if len(parts) != 2 {
			return 0, fmt.Errorf("square root operation requires exactly one number")
		}
		num, err := strconv.ParseFloat(parts[1], 64)
		if err != nil {
			return 0, fmt.Errorf("invalid number for square root: %v", err)
		}
		if num < 0 {
			return 0, fmt.Errorf("cannot calculate square root of a negative number")
		}
		return math.Sqrt(num), nil
	}
	if len(parts) != 3 {
		return 0, fmt.Errorf("invalid input format: please use 'number operator number'")
	}
	num1, err := strconv.ParseFloat(parts[0], 64)
	if err != nil {
		return 0, fmt.Errorf("invalid first number: %v", err)
	}
	operator := parts[1]
	num2, err := strconv.ParseFloat(parts[2], 64)
	if err != nil {
		return 0, fmt.Errorf("invalid second number: %v", err)
	}
	switch operator {
	case "+":
		return num1 + num2, nil
	case "-":
		return num1 - num2, nil
	case "*":
		return num1 * num2, nil
	case "/":
		if num2 == 0 {
			return 0, fmt.Errorf("division by zero is not allowed")
		}
		return num1 / num2, nil
	case "^":
		return math.Pow(num1, num2), nil
	default:
		return 0, fmt.Errorf("invalid operator: must be +, -, *, /, ^, or √")
	}
}
func TestCalculate(t *testing.T) {
	tests := []struct {
		input    string
		expected float64
		hasError bool
	}{
		{"2 + 3", 5, false},
		{"10 - 5", 5, false},
		{"4 * 3", 12, false},
		{"15 / 3", 5, false},
		{"2 ^ 3", 8, false},
		{"√ 16", 4, false},
		{"2 + a", 0, true},
		{"15 / 0", 0, true},
		{"√ -4", 0, true},
		{"3 $ 4", 0, true},
		{"", 0, true},
		{"1", 0, true},
		{"1 +", 0, true},
		{"+ 1", 0, true},
		{"√ 2 3", 0, true},
	}
	for _, test := range tests {
		result, err := calculate(test.input)
		if test.hasError && err == nil {
			t.Errorf("Expected error for input '%s', but got none", test.input)
			continue
		}
		if !test.hasError && err != nil {
			t.Errorf("Unexpected error for input '%s': %v", test.input, err)
			continue
		}
		if !test.hasError && result != test.expected {
			t.Errorf("For input '%s': expected %f, but got %f", test.input, test.expected, result)
		}
	}
}
func TestSpecialCases(t *testing.T) {
	result, err := calculate("2.5 + 2.5")
	if err != nil {
		t.Errorf("Unexpected error for floating point addition: %v", err)
	}
	if result != 5.0 {
		t.Errorf("Floating point addition failed: expected 5.0, got %f", result)
	}
	result, err = calculate("2.5 ^ 2")
	if err != nil {
		t.Errorf("Unexpected error for power operation: %v", err)
	}
	expected := 6.25
	if math.Abs(result-expected) > 0.0001 {
		t.Errorf("Power operation failed: expected %f, got %f", expected, result)
	}
	result, err = calculate("√ 2")
	if err != nil {
		t.Errorf("Unexpected error for square root: %v", err)
	}
	expected = math.Sqrt(2)
	if math.Abs(result-expected) > 0.0001 {
		t.Errorf("Square root operation failed: expected %f, got %f", expected, result)
	}
}
func TestLargeNumbers(t *testing.T) {
	result, err := calculate("1000000000 + 1000000000")
	if err != nil {
		t.Errorf("Unexpected error for adding large numbers: %v", err)
	}
	if result != 2000000000 {
		t.Errorf("Adding large numbers failed: expected 2000000000, got %f", result)
	}
	result, err = calculate("1000000 * 1000000")
	if err != nil {
		t.Errorf("Unexpected error for multiplying large numbers: %v", err)
	}
	if result != 1000000000000 {
		t.Errorf("Multiplying large numbers failed: expected 1000000000000, got %f", result)
	}
	result, err = calculate("2 ^ 30")
	if err != nil {
		t.Errorf("Unexpected error for large exponent operation: %v", err)
	}
	expected := math.Pow(2, 30)
	if result != expected {
		t.Errorf("Power operation with large exponent failed: expected %f, got %f", expected, result)
	}
	result, err = calculate("1000000000000 / 1000000")
	if err != nil {
		t.Errorf("Unexpected error for dividing large numbers: %v", err)
	}
	if result != 1000000 {
		t.Errorf("Dividing large numbers failed: expected 1000000, got %f", result)
	}
}`;

    const diffText = `--- original.go
+++ updated.go
@@ -30,6 +30,7 @@
   fmt.Println("  /  : Division")
 	 fmt.Println("  ^  : Power")
 	 fmt.Println("  √  : Square root (use only one number)")
+  fmt.Println("  log: Logarithm (use 'log base number')")
+  fmt.Println("       Base must be > 0 and != 1, number must be > 0")
   for {
	   fmt.Print("Enter calculation (e.g., 5 + 3 or √ 16) or 'q' to quit: ")
@@ -73,6 +74,8 @@
 	   }
 	   return math.Sqrt(num), nil
 	 }
+	
+	// Handle logarithmic operations
+	if parts[0] == "log" {
+		if len(parts) != 3 {
+			return 0, fmt.Errorf("logarithm operation requires exactly two arguments: 'log base number'")
+		}
+		base, err := strconv.ParseFloat(parts[1], 64)
+		if err != nil || base <= 0 || base == 1 {
+			return 0, fmt.Errorf("invalid base for logarithm: must be > 0 and != 1")
+		}
+		num, err := strconv.ParseFloat(parts[2], 64)
+		if err != nil || num <= 0 {
+			return 0, fmt.Errorf("invalid number for logarithm: must be > 0")
+		}
+		return math.Log(num) / math.Log(base), nil
+	}
+
 	if len(parts) != 3 {
 		return 0, fmt.Errorf("invalid input format: please use 'number operator number'")
@@ -155,6 +158,15 @@
 		}
 	}
 }
+
+func TestLogarithmicCases(t *testing.T) {
+	tests := []struct {
+		input    string
+		expected float64
+		hasError bool
+	}{
+		{"log 2 8", 3, false},
+		{"log 10 100", 2, false},
+		{"log 10 -5", 0, true},
+		{"log 1 100", 0, true},
+		{"log 0.5 0.25", 2, false},
+	}`;
    const result = applyUnifiedDiff(sourceCode, diffText);

    expect(result[0].line).toEqual("package main");
    // 1st block
		expect(result[21].line).toEqual("  fmt.Println(\"  log: Logarithm (use 'log base number')\")");
    expect(result[22].line).toEqual("  fmt.Println(\"       Base must be > 0 and != 1, number must be > 0\")");
		// 2nd block
		expect(result[60]).toEqual({type: "same", line: "\t}"});
		expect(result[61]).toEqual({type: "new", line: "\t"});
		expect(result[62]).toEqual({type: "new", line: "\t// Handle logarithmic operations"});
		expect(result[77]).toEqual({type: "new", line: ""});
		expect(result[78]).toEqual({type: "same", line: "\tif len(parts) != 3 {"});
		// 3rd block
		expect(result[145]).toEqual({type: "same", line: "}"});
		expect(result[146]).toEqual({type: "new", line: ""});
		expect(result[147]).toEqual({type: "new", line: "func TestLogarithmicCases(t *testing.T) {"});
		expect(result[158]).toEqual({type: "new", line: "\t}"});
		expect(result[159]).toEqual({type: "same", line: ""});
		expect(result[160]).toEqual({type: "same", line: "func TestSpecialCases(t *testing.T) {"});		

	});

	it("should throw error when hunk cannot be matched to source", () => {
		const sourceCode = `line1
line2 
line3`;

	const diffText = `--- a.txt
+++ b.txt
@@ -1,3 +1,4 @@
missing1
-missing2
+newline2
missing3`;

		expect(() => applyUnifiedDiff(sourceCode, diffText))
			.toThrow("Hunk could not be applied cleanly to source code.");
	});
});
