(
    (function_definition
        (parameters 
            (_ 
                (type) @a
                (#not-match? @a "^(str|int|float|bool|list|dict|tuple)$")
            )
        )
    )
)

(
    (function_definition
        (type) @b
        (#not-match? @b "^(str|int|float|bool|list|dict|tuple)$")
    )
)