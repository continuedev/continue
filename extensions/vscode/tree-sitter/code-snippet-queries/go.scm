(
  (comment)* @comment
  .
  (function_declaration
    name: (identifier) @name.definition.function
    parameters: (_) @parameters
    result: (_)? @return_type
  ) @definition.function
  (#strip! @comment "^//\\s*")
  (#set-adjacent! @comment @definition.function)
)

(
  (comment)* @comment
  .
  (method_declaration
    receiver: (_) @receiver
    name: (field_identifier) @name.definition.method
    parameters: (_) @parameters
    result: (_)? @return_type
  ) @definition.method
  (#strip! @comment "^//\\s*")
  (#set-adjacent! @comment @definition.method)
)

(type_spec
  name: (type_identifier) @name.definition.type) @definition.type