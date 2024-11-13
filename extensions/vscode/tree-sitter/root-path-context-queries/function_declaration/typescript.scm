; Pattern for capturing the return type
(
  (function_declaration
    (type_annotation) @return_type
  )
)

; Pattern for parameters with direct type_identifier
(
  (function_declaration
    (formal_parameters
      (_
        (type_annotation
          (type_identifier) @param_type
        )
      )
    )
  )
)

; Pattern for parameters with one level of nesting
(
  (function_declaration
    (formal_parameters
      (_
        (type_annotation
          (_
            (type_identifier) @param_type
          )
        )
      )
    )
  )
)