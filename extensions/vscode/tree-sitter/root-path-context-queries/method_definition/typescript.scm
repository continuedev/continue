; Pattern for return type with direct type_identifier
(
  (method_definition
    (type_annotation
      (type_identifier) @return_type
    )
  )
)

; Pattern for return type with one level of nesting
(
  (method_definition
    (type_annotation
      (_
        (type_identifier) @param_type
      )
    )
  )
)

; Pattern for return type with two levels of nesting
(
  (method_definition
    (type_annotation
      (_
        (_
          (type_identifier) @param_type
        )
      )
    )
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

; Pattern for parameters with two levels of nesting
(
  (method_definition
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