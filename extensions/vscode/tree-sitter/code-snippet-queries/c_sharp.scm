(class_declaration
 name: (identifier) @name.definition.class
 ) @definition.class

(class_declaration
   bases: (base_list (_) @name.reference.class)
 ) @reference.class

(interface_declaration
 name: (identifier) @name.definition.interface
 ) @definition.interface

(interface_declaration
 bases: (base_list (_) @name.reference.interface)
 ) @reference.interface

(method_declaration
 name: (identifier) @name.definition.method
 ) @definition.method

(namespace_declaration
 name: (identifier) @name.definition.module
) @definition.module
