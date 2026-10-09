# Project coding standards

Apply these standards to all changes in this repository. Follow the existing patterns and conventions in nearby code.

## Readability and naming

- Prefer clear, intention-revealing names for variables, functions, classes, and modules. Avoid generic names and unexplained acronyms, especially domain-specific ones.
- Use the data structure that best expresses the data, such as an object with named properties instead of an array of positional values.
- Keep code small and readable without comments where possible. Separate logic into well-named routines when that makes its intent clearer.
- When a comment is necessary, explain why the code or decision is needed, not how it works. Keep comments accurate and concise; do not leave commented-out code.

## Simplicity and structure

- Prefer the simplest solution that meets a confirmed need. Apply the rule of three before introducing abstractions for reuse.
- Keep the application together unless there is a confirmed need to split it. When reuse is needed, start with modules and namespaces; consider a package before a separate service.
- Follow the conventions of the language and frameworks already used in the project.

## JavaScript and frontend

- Use vanilla JavaScript by default. Do not add TypeScript or a frontend JavaScript framework without an approved exception.
- Build for progressive enhancement: core service functionality must remain usable without JavaScript.
- Prefer standard GOV.UK Design System patterns and GOV.UK Frontend components. Avoid custom CSS unless there is a clear need.
- Build accessible services to at least WCAG 2.2 AA. Check keyboard use, semantic markup, accessible names, focus behavior, and other relevant criteria when changing UI.

## Quality, security, and dependencies

- Keep changes maintainable and meet the repository's quality gate. Preserve or add appropriate tests for behavior changes.
- Every new or modified HTML form that submits a state-changing request must include CSRF protection. For Nunjucks forms, include a hidden `crumb` field with `{{ crumb }}`; rely on the server's `@hapi/crumb` validation and never disable it to make a form work. Add or update tests to verify the form includes its crumb and invalid or missing crumbs are rejected.
- Check dependencies for updates and known vulnerabilities when changing dependencies; do not introduce packages with known vulnerabilities.
- Do not commit secrets or sensitive configuration.

## Project commands and documentation

- Use the setup, run, build, test, formatting, linting, and security-audit instructions and scripts documented in [README.md](README.md) and [package.json](package.json).
- Document how developers or users build, run, deploy, or use project functionality in the appropriate project documentation. Keep that operational guidance separate from code comments.
