; Local augment on top of upstream tree-sitter-typescript tags.scm.
; Adds enum, type-alias, and namespace (internal_module) captures.

(enum_declaration
  name: (identifier) @name) @definition.enum

(type_alias_declaration
  name: (type_identifier) @name) @definition.type_alias

(internal_module
  name: (identifier) @name) @definition.module
