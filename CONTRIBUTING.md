# Contributing to Turul

Thank you for your interest in contributing! This guide will help you get started.

## Reporting Bugs

Open a [GitHub Issue](https://github.com/FournineCS/turul-app/issues) with:
- Steps to reproduce
- Expected vs actual behavior
- OS and app version

## Suggesting Features

Open an issue with the **feature request** label describing your use case and proposed solution.

## Development Setup

```bash
# Clone the repo
git clone https://github.com/FournineCS/turul-app.git
cd turul-app

# Install dependencies
npm install

# Run in development mode
npm run dev:simple
```

### Build

```bash
npm run build              # Compile Vite + Electron
npm run package            # Package for current platform
npm run package:mac        # macOS
npm run package:win        # Windows
npm run package:linux      # Linux
```

## Pull Request Process

1. Fork the repository and create a branch from `main`
2. Make your changes, following existing code patterns
3. Test your changes locally with `npm run dev:simple`
4. Ensure the project builds cleanly with `npm run build`
5. Submit a pull request with a clear description of your changes

## Code Style

- TypeScript throughout (strict mode)
- Follow existing patterns in the codebase
- Electron main process code in `src/main/`
- React renderer code in `src/renderer/`
- Shared types in `src/shared/types/`

## License

By contributing, you agree that your contributions will be licensed under the [Apache License 2.0](LICENSE).
