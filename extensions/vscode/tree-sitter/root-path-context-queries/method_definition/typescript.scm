; Pattern for capturing the return type
(
  (method_definition
    (type_annotation) @return_type
  )
)

; Pattern for parameters with direct type_identifier
(
  (method_definition
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
  (method_definition
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
