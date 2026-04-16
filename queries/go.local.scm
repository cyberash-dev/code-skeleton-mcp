; Local augment on top of upstream tree-sitter-go tags.scm.
; Upstream captures `(const_spec name: ...)` but marks it only as @name, not as a
; definition. Re-capture here so constants and package-level vars show up.

(
  (comment)* @doc
  .
  (const_declaration
    (const_spec name: (identifier) @name)) @definition.constant
)

(
  (comment)* @doc
  .
  (var_declaration
    (var_spec name: (identifier) @name)) @definition.variable
)
