# npm-dependency-why

A command-line tool and web dashboard to instantly trace npm dependency chains and understand why packages exist in your `node_modules`.

## Features

- **Dependency Chain Tracing**: Visualizes the complete dependency chain from your project to any package
- **Size Impact Analysis**: Shows unpacked size and install footprint of packages
- **Package Metadata**: Displays version, repository, homepage, and maintainer information
- **Tree Depth Tracking**: Identifies whether a package is a direct or transitive dependency
- **Web Dashboard**: Beautiful UI for analyzing and storing query history
- **CLI Tool**: Fast command-line interface for quick lookups
- **JSON Output**: Machine-readable format for scripting and automation

## Installation

### As a CLI Tool

```bash
npm install -g npm-dependency-why
```

Or use with npx:

```bash
npx npm-dependency-why <package-name>
# Or use the shorter alias
npx ndw <package-name>
```

### Note on Alias

The package also provides a shorter alias `ndw` and `npmwhy` for easier typing when installed globally or used via `npx`.

```bash
ndw lodash
```

### As a Web Dashboard

Clone the repository and run:

```bash
git clone https://github.com/hyperdyn-ai/npm-dependency-why.git
cd npm-dependency-why
npm install
npm run dev
```

## Usage

### CLI Examples

You can use either `npm-dependency-why` or the shorter `ndw` alias:

```bash
# Basic usage
ndw lodash

# Output with package information
ndw react

# JSON output for automation
ndw express --json

# Scoped packages
ndw @radix-ui/react-dialog
```

### CLI Output

The CLI provides detailed information:

```
[PACKAGE] lodash
[VERSION] 4.17.21

[DEPENDENCY TREE]
lodash
└─ required by recharts
   └─ required by your-app

[DETAILS]
  Size Impact: 1378.58 KB
  Install Size: 200 files
  Depth in Tree: Level 2
  Reason: Installed because it is a dependency of recharts.
  Repository: https://github.com/lodash/lodash.git
  Homepage: https://lodash.com/
  Maintainers: jdalton, mathias, bnjmn, micmath, jashkenas
```

### JSON Output

```bash
ndw lodash --json
```

Returns:

```json
{
  "name": "lodash",
  "version": "4.17.21",
  "chain": "lodash\n└─ required by recharts\n   └─ required by your-app",
  "size": "1378.58 KB",
  "installSize": "200 files",
  "repository": "https://github.com/lodash/lodash.git",
  "homepage": "https://lodash.com/",
  "maintainers": "jdalton, mathias, bnjmn, micmath, jashkenas",
  "reason": "Installed because it is a dependency of recharts.",
  "depthInTree": 2
}
```

## Web Dashboard Features

The web dashboard provides:

- **Real-time Analysis**: Analyze packages with a beautiful interface
- **Query History**: Browse and re-examine previous analyses
- **Detailed Metrics**: View size impact, tree depth, and package metadata
- **Syntax Highlighting**: Color-coded dependency trees for easy reading
- **Responsive Design**: Works seamlessly on desktop and mobile devices

## What Can It Tell You?

### 1. Dependency Chain
Understand the complete path from your project to any package. Know whether it's a direct dependency or pulled in transitively.

### 2. Size Impact
See how much space a package consumes in your `node_modules`, helping identify bloat and optimization opportunities.

### 3. Tree Depth
Identify packages that are deeply nested (transitive) vs. direct dependencies, useful for understanding your dependency tree complexity.

### 4. Reason for Installation
Get a clear explanation of why a package exists - direct installation or pulled in by a specific dependency.

### 5. Package Metadata
Access version information, repository links, homepage, and maintainer details without leaving the tool.

## Use Cases

### Optimize Bundle Size

Identify large dependencies and understand if they're necessary:

```bash
npm-dependency-why lodash  # Decide if you can replace or remove it
npm-dependency-why moment  # Might be bloat - consider date-fns instead
```

### Audit Dependencies

Understand your entire dependency tree and catch unexpected packages:

```bash
npm-dependency-why some-mystery-package
# Learn which package pulled it in unexpectedly
```

### Track Dependency Evolution

Monitor how your dependencies change across versions:

```bash
# Before upgrade
npm-dependency-why package-name

# After upgrade
npm-dependency-why package-name
# Compare results
```

### Review Pull Requests

When reviewing a PR that adds a dependency:

```bash
npm-dependency-why new-package-from-pr
# Understand the impact and necessity
```

## How It Works

1. Runs `npm ls <package-name> --json` to build the dependency graph
2. Fetches package metadata from the npm registry
3. Calculates size information and package details
4. Displays results in human-readable or JSON format

## Requirements

- Node.js 12+
- npm 6+ (for CLI usage)
- For dashboard: PostgreSQL database (provided by Replit)

## Architecture

- **CLI Tool**: Standalone Node.js script, zero dependencies
- **Dashboard Backend**: Express.js with PostgreSQL
- **Dashboard Frontend**: React with TypeScript and Tailwind CSS
