// const exampleSchema = {
//   "type": "object",
//   "properties": {
//     "name": {
//       "type": ["string", "null"],
//       "description": "The name of the person, which may be null"
//     },
//     "age": {
//       "type": "number",
//       "minimum": 0,
//       "maximum": 150,
//       "description": "The age of the person"
//     },
//     "email": {
//       "type": "string",
//       "format": "email",
//       "description": "The email address (if provided)"
//     }
//   },
//   "required": ["name"]
// }

// const exampleSchema2 = {
//   "$id": "http://example.com/complex-object",
//   "type": "object",
//   "properties": {
//     "person": {
//       "type": "object",
//       "properties": {
//         "name": {
//           "type": "string",
//           "required": true,
//           "description": "The name of the person"
//         },
//         "age": {
//           "type": "number",
//           "min": 0,
//           "max": 150,
//           "description": "The age of the person"
//         }
//       },
//       "required": ["name", "age"]
//     },
//     "hobbies": {
//       "type": "array",
//       "items": {
//         "type": "string"
//       },
//       "description": "A list of hobbies"
//     }
//   },
//   "required": ["person", "hobbies"]
// }

// const exampleSchema3 = {
//   "type": "object",
//   "properties": {
//     "name": {
//       "type": "string",
//       "required": true,
//       "description": "The name of the person"
//     },
//     "age": {
//       "type": "number",
//       "min": 0,
//       "max": 150,
//       "description": "The age of the person"
//     }
//   },
//   "required": ["name", "age"]
// }

// function jsonSchemaObjectToCustomXmlSchema(schema: object) {

// }

// const a = `<tool_definition>
//     <name>This is a name</name>
//     <args>
//         <filepath required="true">

//     </args>
// </tool_definition>
// `

// const b = `<tool_call>

// </tool_call>`

// const EXAMPLE_TOOL2 = `<tool>
//     <name>example_tool</name>
//     <args>
//         <arg1>
//             <description>First argument</description>
//             <type>string</type>
//             <required>true</required>
//         </arg1>
//         <arg2>
//             <description>Second argument</description>
//             <type>number</type>
//             <required>false</required>
//         </arg2>
//     </args>
// </tool>`;
