# Security Policy

For a technical deep-dive into this project's security design (authentication, cache, injection defenses, etc.), see [docs/SECURITY.md](docs/SECURITY.md).

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please **do not** open a public GitHub issue.

Instead, report it privately via one of these channels:

- **GitHub Security Advisories**: use the ["Report a vulnerability"](https://github.com/adityathakur-09/url-shortener/security/advisories/new) button on this repo's Security tab (preferred).
- Open a private discussion with the maintainer via their GitHub profile: [@adityathakur-09](https://github.com/adityathakur-09).

Please include:
- A description of the vulnerability and its potential impact.
- Steps to reproduce (a minimal example if possible).
- Any suggested remediation, if you have one.

## Response

This is a learning/portfolio project maintained by one person, so response times aren't guaranteed on a fixed SLA, but reports will be acknowledged and addressed as promptly as possible.

## Supported Versions

| Version | Supported |
|---|---|
| `main` (latest) | ✅ |

There are no released/tagged versions yet — `main` is the only actively maintained line. See [CHANGELOG.md](CHANGELOG.md) for release history once versioned releases begin.

## Known Limitations

This project documents its own security trade-offs openly rather than hiding them — see [docs/SECURITY.md § Known limitations](docs/SECURITY.md#known-limitations) (e.g. no JWT revocation mechanism, single admin role). These are acknowledged design trade-offs for the project's current scope, not overlooked bugs — but if you believe one of them constitutes an actual exploitable vulnerability given the project's threat model, please report it as above.
