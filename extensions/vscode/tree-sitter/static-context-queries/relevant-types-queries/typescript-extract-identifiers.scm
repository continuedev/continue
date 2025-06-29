;; Capture the type alias name (left-hand side)
; (type_alias_declaration
;   name: (type_identifier) @type.name)

;; Capture all identifiers on the right-hand side (value), recursively
; (type_alias_declaration
;   value: (_) @type.value)

;; Match all identifiers inside the type value — deeply nested
(type_identifier) @type.identifier
