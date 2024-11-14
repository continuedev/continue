(
  (function_declaration
    (parameter_list
      (parameter_declaration
        type: (_) @param_type
      )*
    )
    ; Optional return type node before the block
    ([_] @return_type)?
    (block)
  )
)