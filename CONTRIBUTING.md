# Contributing to TIWAT

Thank you for considering a contribution. This project values thoughtful design, correctness, security, clear documentation, and changes that solve real user problems.

## Before you begin

- Read the project overview and current limitations in [README.md](README.md).
- Follow the expectations in [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
- For security vulnerabilities, do not open a public issue; follow [SECURITY.md](SECURITY.md).
- For substantial changes, open or comment on an issue first so the scope can be discussed.

## Development setup

1. Install Node.js 22 or newer and npm.
2. Fork or clone the repository.
3. Install dependencies with **npm install** (use **npm ci** when installing against the committed lockfile).
4. Create **.env.local** from **.env.example** and configure the integrations needed for your change.
5. Start the app with **npm run dev**.

Do not commit **.env.local**, API keys, Firebase ID tokens, user data, or local build artifacts.

## Making a change

- Keep pull requests focused and reasonably small.
- Preserve existing architecture and established TypeScript conventions.
- Add or update tests when behavior changes.
- Validate external inputs and handle expected failures.
- Keep provider credentials on the server; never expose secret keys through **NEXT_PUBLIC_** variables.
- Update the README or relevant documentation if setup, behavior, environment variables, or limitations change.
- Do not claim a provider, model, integration, or feature works unless it has been verified.

## Quality checks

Run all of the following before opening a pull request:

~~~bash
npm run lint
npm run typecheck
npm test
npm run build
~~~

Include any checks you could not run and explain why.

## Pull requests

A good pull request includes:

- A clear description of the problem and the proposed solution.
- Scope and user-visible behavior changes.
- Tests or manual verification performed.
- Screenshots or recordings for UI changes when helpful.
- Configuration or migration notes, if applicable.
- Known limitations and follow-up work.

Keep commits focused. Be responsive to review feedback and update documentation when needed.

## Reporting bugs

Use GitHub Issues for non-sensitive reproducible bugs. Include the browser/runtime, relevant versions, reproduction steps, expected result, actual result, and sanitized error output. Redact secrets and private content.

## License

By submitting a contribution, you agree that your contribution is distributed under the repository’s [MIT License](LICENSE), unless a different written agreement is made with the project maintainer.
