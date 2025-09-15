import { describe, it, expect } from "vitest";
import { convertToolParametersToJsonSchema } from "./parameterConverter.js";

describe("convertToolParametersToJsonSchema", () => {
  it("should convert simple parameters to JSON schema", () => {
    const parameters = {
      name: {
        type: "string",
        description: "The name",
        required: true,
      },
      age: {
        type: "number",
        description: "The age",
        required: false,
      },
    };

    const result = convertToolParametersToJsonSchema(parameters);

    expect(result).toEqual({
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "The name",
        },
        age: {
          type: "number",
          description: "The age",
        },
      },
      required: ["name"],
    });
  });

  it("should handle parameters with no required fields", () => {
    const parameters = {
      optional1: {
        type: "string",
        description: "Optional field 1",
        required: false,
      },
      optional2: {
        type: "boolean",
        description: "Optional field 2",
        required: false,
      },
    };

    const result = convertToolParametersToJsonSchema(parameters);

    expect(result).toEqual({
      type: "object",
      properties: {
        optional1: {
          type: "string",
          description: "Optional field 1",
        },
        optional2: {
          type: "boolean",
          description: "Optional field 2",
        },
      },
    });
  });

  it("should handle array parameters with items", () => {
    const parameters = {
      tags: {
        type: "array",
        description: "List of tags",
        required: true,
        items: {
          type: "string",
        },
      },
    };

    const result = convertToolParametersToJsonSchema(parameters);

    expect(result).toEqual({
      type: "object",
      properties: {
        tags: {
          type: "array",
          description: "List of tags",
          items: {
            type: "string",
          },
        },
      },
      required: ["tags"],
    });
  });

  it("should handle nested object properties", () => {
    const parameters = {
      user: {
        type: "object",
        description: "User information",
        required: true,
        properties: {
          firstName: {
            type: "string",
            description: "First name",
            required: true,
          },
          lastName: {
            type: "string",
            description: "Last name",
            required: true,
          },
          email: {
            type: "string",
            description: "Email address",
            required: false,
          },
        },
      },
    };

    const result = convertToolParametersToJsonSchema(parameters);

    expect(result).toEqual({
      type: "object",
      properties: {
        user: {
          type: "object",
          description: "User information",
          properties: {
            firstName: {
              type: "string",
              description: "First name",
            },
            lastName: {
              type: "string",
              description: "Last name",
            },
            email: {
              type: "string",
              description: "Email address",
            },
          },
          required: ["firstName", "lastName"],
        },
      },
      required: ["user"],
    });
  });

  it("should handle arrays of objects with nested properties", () => {
    const parameters = {
      users: {
        type: "array",
        description: "List of users",
        required: true,
        items: {
          type: "object",
          properties: {
            id: {
              type: "number",
              description: "User ID",
              required: true,
            },
            name: {
              type: "string",
              description: "User name",
              required: true,
            },
            active: {
              type: "boolean",
              description: "Is active",
              required: false,
            },
          },
        },
      },
    };

    const result = convertToolParametersToJsonSchema(parameters);

    expect(result).toEqual({
      type: "object",
      properties: {
        users: {
          type: "array",
          description: "List of users",
          items: {
            type: "object",
            properties: {
              id: {
                type: "number",
                description: "User ID",
              },
              name: {
                type: "string",
                description: "User name",
              },
              active: {
                type: "boolean",
                description: "Is active",
              },
            },
            required: ["id", "name"],
          },
        },
      },
      required: ["users"],
    });
  });

  it("should handle deeply nested structures", () => {
    const parameters = {
      company: {
        type: "object",
        description: "Company info",
        required: true,
        properties: {
          name: {
            type: "string",
            description: "Company name",
            required: true,
          },
          departments: {
            type: "array",
            description: "Departments",
            required: false,
            items: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                  description: "Department name",
                  required: true,
                },
                employees: {
                  type: "array",
                  description: "Employees",
                  required: true,
                  items: {
                    type: "object",
                    properties: {
                      name: {
                        type: "string",
                        description: "Employee name",
                        required: true,
                      },
                      role: {
                        type: "string",
                        description: "Employee role",
                        required: false,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    const result = convertToolParametersToJsonSchema(parameters);

    expect(result).toEqual({
      type: "object",
      properties: {
        company: {
          type: "object",
          description: "Company info",
          properties: {
            name: {
              type: "string",
              description: "Company name",
            },
            departments: {
              type: "array",
              description: "Departments",
              items: {
                type: "object",
                properties: {
                  name: {
                    type: "string",
                    description: "Department name",
                  },
                  employees: {
                    type: "array",
                    description: "Employees",
                    items: {
                      type: "object",
                      properties: {
                        name: {
                          type: "string",
                          description: "Employee name",
                        },
                        role: {
                          type: "string",
                          description: "Employee role",
                        },
                      },
                      required: ["name"],
                    },
                  },
                },
                required: ["name", "employees"],
              },
            },
          },
          required: ["name"],
        },
      },
      required: ["company"],
    });
  });

  it("should handle arrays of arrays", () => {
    const parameters = {
      matrix: {
        type: "array",
        description: "2D matrix",
        required: true,
        items: {
          type: "array",
          items: {
            type: "number",
          },
        },
      },
    };

    const result = convertToolParametersToJsonSchema(parameters);

    expect(result).toEqual({
      type: "object",
      properties: {
        matrix: {
          type: "array",
          description: "2D matrix",
          items: {
            type: "array",
            items: {
              type: "number",
            },
          },
        },
      },
      required: ["matrix"],
    });
  });

  it("should handle empty parameters", () => {
    const parameters = {};

    const result = convertToolParametersToJsonSchema(parameters);

    expect(result).toEqual({
      type: "object",
      properties: {},
    });
  });

  it("should handle items with description", () => {
    const parameters = {
      codes: {
        type: "array",
        description: "List of codes",
        required: true,
        items: {
          type: "string",
          description: "A code value",
        },
      },
    };

    const result = convertToolParametersToJsonSchema(parameters);

    expect(result).toEqual({
      type: "object",
      properties: {
        codes: {
          type: "array",
          description: "List of codes",
          items: {
            type: "string",
            description: "A code value",
          },
        },
      },
      required: ["codes"],
    });
  });
});