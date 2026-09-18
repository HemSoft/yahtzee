# Lint policy

Run `bun run lint` from the repository root after a frozen install. ESLint and its TypeScript and React Hooks plugins are exact direct development dependencies. Errors and warnings fail the command.

The flat configuration checks TypeScript, TSX and ESM configuration files. It uses ESLint's and typescript-eslint's recommended rules, plus React's rules-of-hooks and exhaustive-deps checks. React Compiler-specific rules are not enabled because this project does not run the React Compiler. Leading underscores identify intentionally unused callback parameters, not unused production variables.

Exclusions are compiler-owned Convex bindings and generated dependency/build/coverage/Expo directories. Repository maintainers own this configuration; review exclusions when generator or output paths change. Handwritten backend code, applications, shared packages and TypeScript tests are not excluded.

`bun run typecheck` remains a separate gate. ESLint does not replace workflow, Markdown or native-platform validation.

To prove enforcement in a disposable checkout, add `export const probe: any = 1;` to a temporary production `.ts` file. `bun run lint` must fail on `no-explicit-any`. Remove the probe and confirm the command passes.
