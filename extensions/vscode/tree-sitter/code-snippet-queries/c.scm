(function_definition declarator: (function_declarator (identifier) @name)) @definition.function

(struct_specifier name: (type_identifier) @name.definition.class body:(_)) @definition.class

(declaration type: (union_specifier name: (type_identifier) @name.definition.class)) @definition.class

(type_definition declarator: (type_identifier) @name ) @definition

(enum_specifier name: (type_identifier) @name.definition.type) @definition.type
