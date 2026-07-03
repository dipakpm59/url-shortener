# Contributing to Snipr

Thanks for considering a contribution — this started as a learning/portfolio project, but PRs, issues, and suggestions are genuinely welcome.

## Getting started

1. Fork the repo and clone your fork.
2. Follow [README.md → Installation](README.md#installation) to get it running locally (Node 18+, MySQL 8+).
3. Create a branch off `main`: `git checkout -b feat/short-description` (or `fix/`, `docs/`, `chore/`).

## Project structure

Before making changes, skim [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — this project follows a strict layered MVC + service pattern (Router → Controller → Validator → Service → Model). Please keep changes within the layer they belong to rather than, for example, putting business logic in a controller.

## Making changes

- **Bug fixes**: include the smallest reproduction you can, and a test/verification note in your PR description of how you confirmed the fix (this project doesn't have an automated test suite yet — see [CHANGELOG.md](CHANGELOG.md)/Future Enhancements — so manual verification steps are appreciated).
- **New features**: open an issue first using the [Feature Request template](.github/ISSUE_TEMPLATE/feature_request.md) to discuss scope before investing time in a large PR.
- **Docs**: typo fixes and clarity improvements are always welcome without prior discussion.

## Code style

- Match the existing style in the file you're editing (this repo doesn't currently run a formatter/linter in CI — see Future Enhancements).
- No comments explaining *what* code does when the code itself is clear — comments should explain *why*, especially for non-obvious constraints (see existing code for examples).
- Don't introduce new dependencies for something a few lines of code can do.

## Commit messages

Keep them descriptive and focused on *why*, not just *what*. One logical change per commit where practical.

## Pull requests

- Fill out the [PR template](.github/PULL_REQUEST_TEMPLATE.md).
- Reference any related issue.
- Keep PRs focused — a PR that does one thing is much easier to review than one that mixes a refactor with a feature.
- CI (GitHub Actions) runs a syntax check and build verification on every PR — make sure it's green before requesting review.

## Reporting security issues

Please **do not** open a public issue for security vulnerabilities — see [SECURITY.md](SECURITY.md) for responsible disclosure instructions.

## Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). Be respectful.
