# Security Policy

## Supported version

Security fixes are intended for the current code on the main branch. Older commits and forks may not receive fixes.

## Reporting a vulnerability

Please do **not** disclose exploitable vulnerabilities, credentials, session tokens, or detailed attack instructions in a public issue.

Preferred route:

1. If GitHub private vulnerability reporting is enabled for this repository, use **Security → Report a vulnerability**.
2. If that option is unavailable, contact the repository maintainer through the [GitHub profile](https://github.com/shivatmprakash9009-eng) and ask for a private reporting channel.

Please include, where possible:

- A concise description and potential impact.
- Affected paths, endpoints, or configurations.
- Reproduction steps or a minimal proof of concept.
- Any relevant logs with secrets and personal data removed.
- A suggested mitigation, if known.

Do not include real API keys, Firebase ID tokens, passwords, user conversations, or other private information in the report.

## Scope and deployment responsibility

Potentially relevant areas include authentication and token verification, authorization, secret handling, prompt/request processing, rate limits, exposed diagnostics, dependency vulnerabilities, and unsafe data handling.

TIWAT can be deployed with different providers and hosting configurations. Operators are responsible for securing their own secrets, configuring Firebase authorized domains and API restrictions, reviewing third-party data terms, choosing an appropriate rate limiter, and keeping deployments and dependencies updated.

A key being present in environment configuration does not prove that it is valid or that the deployment is secure. No particular response time or service-level commitment is promised by this policy.
