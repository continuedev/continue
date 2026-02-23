; Pattern for return type with direct type_identifier
(
  (function_declaration
    (type_annotation
      (type_identifier) @return_type
    )
  )
)

; Pattern for return type with one level of nesting
(
  (function_declaration
    (type_annotation
      (_
        (type_identifier) @param_type
      )
    )
  )
)

; Pattern for return type with two levels of nesting
(
  (function_declaration
    (type_annotation
      (_
        (_
          (type_identifier) @return_type
        )
      )
    )
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

; Pattern for parameters with two levels of nesting
(
  (function_declaration
    (formal_parameters
      (_
        (type_annotation
          (_
            (_
              (type_identifier) @param_type
            )
          )
        )
      )
    )
  )
)