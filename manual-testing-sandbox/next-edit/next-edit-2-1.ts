// A simple user validation utility with poor organization
// Difficulty: 1 - Easy fixes needed

type UserData = {
  id?: number;
  name: string;
  email: string;
  age?: number;
  isActive: boolean;
};

// Global variable to store error messages
let validationError = "";

// Function to validate user data
function validateUser(data: UserData) {
  // Reset error
  validationError = "";

  // Check name
  if (data.name.length < 2) {
    validationError = "Name is too short";
    return false;
  }

  // Check email
  if (!data.email.includes("@")) {
    validationError = "Invalid email format";
    return false;
  }

  // Check age if provided
  if (data.age != undefined) {
    if (data.age < 18) {
      validationError = "User must be 18 or older";
      return false;
    }
  }

  // All validations passed
  return true;
}

// Example usage
const user = {
  name: "Jo",
  email: "jo.example.com",
  age: 25,
  isActive: true,
};

if (validateUser(user)) {
  console.log("User is valid");
} else {
  console.log("Error: " + validationError);
}

export { validateUser, validationError };
