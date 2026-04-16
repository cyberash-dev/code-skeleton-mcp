; Local augment on top of upstream tree-sitter-javascript tags.scm.
; Captures the constructor method that upstream tags.scm excludes via #not-eq?.

(method_definition
  name: (property_identifier) @name
  (#eq? @name "constructor")) @definition.method
