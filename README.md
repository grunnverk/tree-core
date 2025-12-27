# @eldrforge/tree-core

A powerful TypeScript library for analyzing and managing dependencies in monorepo workspaces. Build dependency graphs, perform topological sorting, detect circular dependencies, and determine optimal build orders for complex package ecosystems.

[![Test Coverage](https://img.shields.io/badge/coverage-94.11%25-brightgreen.svg)](./coverage)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org)

## Features

- 📦 **Package Discovery** - Recursively scan directories for package.json files
- 🔍 **Dependency Analysis** - Build comprehensive dependency graphs with local and external dependencies
- 📊 **Topological Sort** - Determine optimal build/execution order respecting dependencies
- ⚠️ **Circular Detection** - Identify and report circular dependencies with clear error messages
- 🎯 **Pattern Filtering** - Exclude packages using glob patterns (e.g., node_modules, test fixtures)
- 🔄 **Reverse Dependencies** - Find all packages that depend on a given package
- 💾 **Serialization** - Save and restore graphs for checkpointing and caching
- ✅ **Graph Validation** - Comprehensive integrity checks for dependency graphs
- 🪵 **Custom Logging** - Configurable logger interface for integration with any logging system
- 📝 **TypeScript First** - Full type safety with comprehensive TypeScript definitions

## Installation

```bash
npm install @eldrforge/tree-core
```

**Requirements:**
- Node.js >= 18.0.0
- TypeScript >= 5.0 (if using TypeScript)

## Quick Start

```typescript
import {
  scanForPackageJsonFiles,
  buildDependencyGraph,
  topologicalSort,
  validateGraph
} from '@eldrforge/tree-core';

// 1. Scan your monorepo for packages
const packagePaths = await scanForPackageJsonFiles('/path/to/monorepo', [
  '**/node_modules/**',
  '**/dist/**'
]);

// 2. Build the dependency graph
const graph = await buildDependencyGraph(packagePaths);

// 3. Validate the graph (optional but recommended)
const validation = validateGraph(graph);
if (!validation.valid) {
  console.error('Graph validation errors:', validation.errors);
  process.exit(1);
}

// 4. Get the correct build order
const buildOrder = topologicalSort(graph);

console.log('Build packages in this order:', buildOrder);

// 5. Execute builds in order
for (const packageName of buildOrder) {
  const pkg = graph.packages.get(packageName);
  console.log(`Building ${packageName} at ${pkg.path}`);
  // Run your build command here
}
```

## Core Concepts

### PackageInfo

Represents information about a single package in your workspace:

```typescript
interface PackageInfo {
  name: string;                    // Package name from package.json
  version: string;                 // Package version
  path: string;                    // Absolute path to package directory
  dependencies: Set<string>;       // All dependencies (including dev, peer, optional)
  devDependencies: Set<string>;    // Development dependencies only
  localDependencies: Set<string>;  // Dependencies on other workspace packages
}
```

### DependencyGraph

The core data structure representing package relationships:

```typescript
interface DependencyGraph {
  packages: Map<string, PackageInfo>;    // All packages by name
  edges: Map<string, Set<string>>;       // Package -> Dependencies
  reverseEdges: Map<string, Set<string>>; // Package -> Dependents
}
```

## Detailed Usage Examples

### Example 1: Basic Monorepo Analysis

```typescript
import {
  scanForPackageJsonFiles,
  buildDependencyGraph,
  topologicalSort
} from '@eldrforge/tree-core';

async function analyzeMonorepo(workspaceRoot: string) {
  // Find all packages, excluding common directories
  const packagePaths = await scanForPackageJsonFiles(workspaceRoot, [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/.git/**'
  ]);

  console.log(`Found ${packagePaths.length} packages`);

  // Build dependency graph
  const graph = await buildDependencyGraph(packagePaths);

  // Get build order
  const buildOrder = topologicalSort(graph);

  // Display results
  console.log('\nBuild Order:');
  buildOrder.forEach((pkg, index) => {
    const info = graph.packages.get(pkg);
    const localDeps = Array.from(info.localDependencies);
    console.log(`${index + 1}. ${pkg} (${localDeps.length} local deps)`);
    if (localDeps.length > 0) {
      console.log(`   Depends on: ${localDeps.join(', ')}`);
    }
  });

  return { graph, buildOrder };
}

// Usage
analyzeMonorepo('/path/to/my-monorepo');
```

### Example 2: Finding Affected Packages

When you change a package, find all packages that need to be rebuilt:

```typescript
import {
  buildDependencyGraph,
  findAllDependents,
  scanForPackageJsonFiles
} from '@eldrforge/tree-core';

async function findAffectedPackages(
  workspaceRoot: string,
  changedPackageName: string
): Promise<string[]> {
  const packagePaths = await scanForPackageJsonFiles(workspaceRoot);
  const graph = await buildDependencyGraph(packagePaths);

  // Find all packages that depend on the changed package
  const dependents = findAllDependents(changedPackageName, graph);

  // Include the changed package itself
  const affected = [changedPackageName, ...Array.from(dependents)];

  console.log(`Package ${changedPackageName} affects:`);
  affected.forEach(pkg => {
    const info = graph.packages.get(pkg);
    console.log(`  - ${pkg} (${info.path})`);
  });

  return affected;
}

// Usage
const affected = await findAffectedPackages(
  '/path/to/monorepo',
  '@myorg/core-utils'
);
```

### Example 3: Detecting Circular Dependencies

```typescript
import {
  buildDependencyGraph,
  topologicalSort,
  validateGraph,
  scanForPackageJsonFiles
} from '@eldrforge/tree-core';

async function checkForCircularDependencies(workspaceRoot: string) {
  const packagePaths = await scanForPackageJsonFiles(workspaceRoot);
  const graph = await buildDependencyGraph(packagePaths);

  // Method 1: Use validateGraph
  const validation = validateGraph(graph);
  if (!validation.valid) {
    console.error('❌ Graph validation failed:');
    validation.errors.forEach(error => console.error(`  - ${error}`));
    return false;
  }

  // Method 2: Use topologicalSort (throws on circular deps)
  try {
    const buildOrder = topologicalSort(graph);
    console.log('✅ No circular dependencies detected');
    console.log(`   ${buildOrder.length} packages can be built in order`);
    return true;
  } catch (error) {
    console.error('❌ Circular dependency detected:', error.message);
    return false;
  }
}

// Usage
const isValid = await checkForCircularDependencies('/path/to/monorepo');
```

### Example 4: Parallel Build Planning

Determine which packages can be built in parallel:

```typescript
import {
  buildDependencyGraph,
  topologicalSort,
  scanForPackageJsonFiles,
  type DependencyGraph
} from '@eldrforge/tree-core';

function planParallelBuilds(graph: DependencyGraph): string[][] {
  const buildOrder = topologicalSort(graph);
  const levels: string[][] = [];
  const packageLevel = new Map<string, number>();

  // Assign each package to a build level
  for (const pkg of buildOrder) {
    const deps = graph.edges.get(pkg) || new Set();
    const maxDepLevel = Math.max(
      -1,
      ...Array.from(deps).map(dep => packageLevel.get(dep) ?? -1)
    );
    const level = maxDepLevel + 1;

    packageLevel.set(pkg, level);

    // Ensure level array exists
    while (levels.length <= level) {
      levels.push([]);
    }

    levels[level].push(pkg);
  }

  return levels;
}

async function parallelBuild(workspaceRoot: string) {
  const packagePaths = await scanForPackageJsonFiles(workspaceRoot);
  const graph = await buildDependencyGraph(packagePaths);
  const buildLevels = planParallelBuilds(graph);

  console.log(`Build plan with ${buildLevels.length} parallel stages:\n`);

  for (let i = 0; i < buildLevels.length; i++) {
    const level = buildLevels[i];
    console.log(`Stage ${i + 1} (${level.length} packages in parallel):`);
    level.forEach(pkg => console.log(`  - ${pkg}`));
    console.log();

    // Build all packages in this level in parallel
    await Promise.all(
      level.map(async (pkg) => {
        const info = graph.packages.get(pkg);
        console.log(`Building ${pkg}...`);
        // Execute build command here
      })
    );
  }
}

// Usage
await parallelBuild('/path/to/monorepo');
```

### Example 5: Graph Serialization for Caching

Save and restore dependency graphs to avoid rescanning:

```typescript
import {
  buildDependencyGraph,
  serializeGraph,
  deserializeGraph,
  scanForPackageJsonFiles,
  type SerializedGraph
} from '@eldrforge/tree-core';
import fs from 'fs/promises';

async function getCachedGraph(
  workspaceRoot: string,
  cacheFile: string
): Promise<DependencyGraph> {
  try {
    // Try to load from cache
    const cached = await fs.readFile(cacheFile, 'utf-8');
    const serialized: SerializedGraph = JSON.parse(cached);
    console.log('✅ Loaded graph from cache');
    return deserializeGraph(serialized);
  } catch {
    // Cache miss - build and save
    console.log('📊 Building dependency graph...');
    const packagePaths = await scanForPackageJsonFiles(workspaceRoot);
    const graph = await buildDependencyGraph(packagePaths);

    // Save to cache
    const serialized = serializeGraph(graph);
    await fs.writeFile(cacheFile, JSON.stringify(serialized, null, 2));
    console.log('💾 Saved graph to cache');

    return graph;
  }
}

// Usage
const graph = await getCachedGraph(
  '/path/to/monorepo',
  '.cache/dependency-graph.json'
);
```

### Example 6: Custom Logging Integration

Integrate with your logging system:

```typescript
import { setLogger, buildDependencyGraph } from '@eldrforge/tree-core';
import winston from 'winston'; // or any other logger

// Create your logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()]
});

// Configure tree-core to use your logger
setLogger({
  info: (msg, ...args) => logger.info(msg, ...args),
  error: (msg, ...args) => logger.error(msg, ...args),
  warn: (msg, ...args) => logger.warn(msg, ...args),
  verbose: (msg, ...args) => logger.verbose(msg, ...args),
  debug: (msg, ...args) => logger.debug(msg, ...args)
});

// Now all tree-core operations will log through your logger
const graph = await buildDependencyGraph(packagePaths);
```

### Example 7: Selective Package Analysis

Analyze only specific packages or patterns:

```typescript
import {
  scanForPackageJsonFiles,
  buildDependencyGraph,
  type DependencyGraph
} from '@eldrforge/tree-core';

async function analyzePackageSubset(
  workspaceRoot: string,
  includePatterns: string[]
): Promise<DependencyGraph> {
  // Scan for all packages
  const allPackages = await scanForPackageJsonFiles(workspaceRoot);

  // Filter to matching packages
  const selectedPackages = allPackages.filter(pkgPath =>
    includePatterns.some(pattern => pkgPath.includes(pattern))
  );

  console.log(`Analyzing ${selectedPackages.length} packages`);

  // Build graph for selected packages only
  const graph = await buildDependencyGraph(selectedPackages);

  return graph;
}

// Usage: Analyze only packages in the 'services' directory
const graph = await analyzePackageSubset(
  '/path/to/monorepo',
  ['packages/services/']
);
```

### Example 8: Dependency Report Generation

Generate a comprehensive dependency report:

```typescript
import {
  scanForPackageJsonFiles,
  buildDependencyGraph,
  type DependencyGraph
} from '@eldrforge/tree-core';

interface DependencyReport {
  totalPackages: number;
  totalLocalDependencies: number;
  packagesWithNoDependencies: string[];
  packagesWithNoDependents: string[];
  mostDependedOn: Array<{ name: string; dependents: number }>;
  mostDependencies: Array<{ name: string; dependencies: number }>;
}

function generateReport(graph: DependencyGraph): DependencyReport {
  const packages = Array.from(graph.packages.values());

  // Find packages with no dependencies
  const noDeps = packages
    .filter(pkg => pkg.localDependencies.size === 0)
    .map(pkg => pkg.name);

  // Find packages with no dependents
  const noDependents = packages
    .filter(pkg => {
      const dependents = graph.reverseEdges.get(pkg.name);
      return !dependents || dependents.size === 0;
    })
    .map(pkg => pkg.name);

  // Find most depended-on packages
  const mostDependedOn = packages
    .map(pkg => ({
      name: pkg.name,
      dependents: (graph.reverseEdges.get(pkg.name) || new Set()).size
    }))
    .sort((a, b) => b.dependents - a.dependents)
    .slice(0, 5);

  // Find packages with most dependencies
  const mostDeps = packages
    .map(pkg => ({
      name: pkg.name,
      dependencies: pkg.localDependencies.size
    }))
    .sort((a, b) => b.dependencies - a.dependencies)
    .slice(0, 5);

  // Calculate total local dependencies
  const totalLocalDeps = packages.reduce(
    (sum, pkg) => sum + pkg.localDependencies.size,
    0
  );

  return {
    totalPackages: packages.length,
    totalLocalDependencies: totalLocalDeps,
    packagesWithNoDependencies: noDeps,
    packagesWithNoDependents: noDependents,
    mostDependedOn,
    mostDependencies: mostDeps
  };
}

async function printDependencyReport(workspaceRoot: string) {
  const packagePaths = await scanForPackageJsonFiles(workspaceRoot);
  const graph = await buildDependencyGraph(packagePaths);
  const report = generateReport(graph);

  console.log('📊 Dependency Report\n');
  console.log(`Total Packages: ${report.totalPackages}`);
  console.log(`Total Local Dependencies: ${report.totalLocalDependencies}`);
  console.log(`Average Dependencies per Package: ${(
    report.totalLocalDependencies / report.totalPackages
  ).toFixed(2)}\n`);

  console.log('📦 Leaf Packages (no dependencies):');
  report.packagesWithNoDependencies.forEach(pkg => console.log(`  - ${pkg}`));

  console.log('\n🌲 Root Packages (no dependents):');
  report.packagesWithNoDependents.forEach(pkg => console.log(`  - ${pkg}`));

  console.log('\n⭐ Most Depended-On Packages:');
  report.mostDependedOn.forEach(({ name, dependents }) => {
    console.log(`  - ${name} (${dependents} packages depend on it)`);
  });

  console.log('\n🔗 Packages with Most Dependencies:');
  report.mostDependencies.forEach(({ name, dependencies }) => {
    console.log(`  - ${name} (depends on ${dependencies} packages)`);
  });
}

// Usage
await printDependencyReport('/path/to/monorepo');
```

## API Reference

### Package Discovery

#### `scanForPackageJsonFiles(directory, excludedPatterns?)`

Recursively scans a directory for package.json files.

```typescript
async function scanForPackageJsonFiles(
  directory: string,
  excludedPatterns?: string[]
): Promise<string[]>
```

**Parameters:**
- `directory` - Root directory to scan
- `excludedPatterns` - Optional glob patterns to exclude (e.g., `**/node_modules/**`)

**Returns:** Array of absolute paths to package.json files

**Example:**
```typescript
const packages = await scanForPackageJsonFiles('/workspace', [
  '**/node_modules/**',
  '**/dist/**',
  '**/.git/**'
]);
```

#### `parsePackageJson(packageJsonPath)`

Parses and validates a single package.json file.

```typescript
async function parsePackageJson(packageJsonPath: string): Promise<PackageInfo>
```

**Parameters:**
- `packageJsonPath` - Absolute path to package.json file

**Returns:** `PackageInfo` object

**Throws:** Error if file doesn't exist, is invalid JSON, or missing required fields

**Example:**
```typescript
const pkg = await parsePackageJson('/workspace/packages/core/package.json');
console.log(`Package: ${pkg.name}@${pkg.version}`);
console.log(`Dependencies: ${Array.from(pkg.dependencies).join(', ')}`);
```

#### `shouldExclude(packagePath, excludedPatterns)`

Checks if a package path matches exclusion patterns.

```typescript
function shouldExclude(
  packageJsonPath: string,
  excludedPatterns: string[]
): boolean
```

**Parameters:**
- `packageJsonPath` - Path to check
- `excludedPatterns` - Array of glob patterns

**Returns:** `true` if path should be excluded

**Example:**
```typescript
const shouldSkip = shouldExclude(
  '/workspace/node_modules/pkg/package.json',
  ['**/node_modules/**']
); // true
```

### Graph Building

#### `buildDependencyGraph(packageJsonPaths)`

Builds a complete dependency graph from package.json files.

```typescript
async function buildDependencyGraph(
  packageJsonPaths: string[]
): Promise<DependencyGraph>
```

**Parameters:**
- `packageJsonPaths` - Array of paths to package.json files (from `scanForPackageJsonFiles`)

**Returns:** Complete `DependencyGraph` with packages, edges, and reverse edges

**Example:**
```typescript
const paths = await scanForPackageJsonFiles('/workspace');
const graph = await buildDependencyGraph(paths);

// Access packages
for (const [name, info] of graph.packages) {
  console.log(`${name}: ${info.localDependencies.size} local deps`);
}
```

#### `buildReverseGraph(edges)`

Creates a reverse dependency map (package -> dependents).

```typescript
function buildReverseGraph(
  edges: Map<string, Set<string>>
): Map<string, Set<string>>
```

**Parameters:**
- `edges` - Forward dependency edges (package -> dependencies)

**Returns:** Reverse edges (package -> dependents)

**Example:**
```typescript
const reverseEdges = buildReverseGraph(graph.edges);
const dependents = reverseEdges.get('@myorg/core') || new Set();
console.log(`Packages that depend on @myorg/core: ${Array.from(dependents)}`);
```

### Graph Analysis

#### `topologicalSort(graph)`

Performs topological sort to determine build order.

```typescript
function topologicalSort(graph: DependencyGraph): string[]
```

**Parameters:**
- `graph` - Dependency graph

**Returns:** Array of package names in dependency order (dependencies first)

**Throws:** Error if circular dependencies detected

**Example:**
```typescript
try {
  const buildOrder = topologicalSort(graph);
  console.log('Build order:', buildOrder);
} catch (error) {
  console.error('Circular dependency:', error.message);
}
```

#### `findAllDependents(packageName, graph)`

Finds all packages that depend on a given package (transitively).

```typescript
function findAllDependents(
  packageName: string,
  graph: DependencyGraph
): Set<string>
```

**Parameters:**
- `packageName` - Package to find dependents for
- `graph` - Dependency graph

**Returns:** Set of package names that depend on the given package

**Example:**
```typescript
const dependents = findAllDependents('@myorg/utils', graph);
console.log(`${dependents.size} packages depend on @myorg/utils:`);
for (const dep of dependents) {
  console.log(`  - ${dep}`);
}
```

#### `validateGraph(graph)`

Validates graph integrity and detects issues.

```typescript
function validateGraph(graph: DependencyGraph): {
  valid: boolean;
  errors: string[];
}
```

**Parameters:**
- `graph` - Dependency graph to validate

**Returns:** Object with `valid` boolean and array of error messages

**Example:**
```typescript
const result = validateGraph(graph);
if (!result.valid) {
  console.error('Graph validation failed:');
  result.errors.forEach(err => console.error(`  - ${err}`));
  process.exit(1);
}
```

### Serialization

#### `serializeGraph(graph)`

Converts graph to JSON-serializable format.

```typescript
function serializeGraph(graph: DependencyGraph): SerializedGraph
```

**Parameters:**
- `graph` - Dependency graph

**Returns:** Serialized graph object (can be JSON.stringify'd)

**Example:**
```typescript
const serialized = serializeGraph(graph);
await fs.writeFile('graph.json', JSON.stringify(serialized, null, 2));
```

#### `deserializeGraph(serialized)`

Restores graph from serialized format.

```typescript
function deserializeGraph(serialized: SerializedGraph): DependencyGraph
```

**Parameters:**
- `serialized` - Serialized graph object

**Returns:** Restored dependency graph

**Example:**
```typescript
const data = await fs.readFile('graph.json', 'utf-8');
const serialized = JSON.parse(data);
const graph = deserializeGraph(serialized);
```

### Configuration

#### `setLogger(logger)`

Configures custom logger for all tree-core operations.

```typescript
function setLogger(logger: Logger): void

interface Logger {
  info(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  verbose(message: string, ...args: any[]): void;
  debug(message: string, ...args: any[]): void;
}
```

**Parameters:**
- `logger` - Logger implementation matching the Logger interface

**Example:**
```typescript
setLogger({
  info: (msg) => console.log(`[INFO] ${msg}`),
  error: (msg) => console.error(`[ERROR] ${msg}`),
  warn: (msg) => console.warn(`[WARN] ${msg}`),
  verbose: (msg) => process.env.VERBOSE && console.log(`[VERBOSE] ${msg}`),
  debug: (msg) => process.env.DEBUG && console.log(`[DEBUG] ${msg}`)
});
```

## TypeScript Types

### PackageInfo

```typescript
interface PackageInfo {
  name: string;                    // Package name from package.json
  version: string;                 // Semantic version
  path: string;                    // Absolute path to package directory
  dependencies: Set<string>;       // All dependencies
  devDependencies: Set<string>;    // Dev dependencies only
  localDependencies: Set<string>;  // Workspace packages only
}
```

### DependencyGraph

```typescript
interface DependencyGraph {
  packages: Map<string, PackageInfo>;     // Package name -> info
  edges: Map<string, Set<string>>;        // Package -> dependencies
  reverseEdges: Map<string, Set<string>>; // Package -> dependents
}
```

### SerializedGraph

```typescript
interface SerializedGraph {
  packages: Array<{
    name: string;
    version: string;
    path: string;
    dependencies: string[];
  }>;
  edges: Array<[string, string[]]>;
}
```

## Common Patterns

### Incremental Builds

Only rebuild affected packages:

```typescript
import { findAllDependents, topologicalSort } from '@eldrforge/tree-core';

async function incrementalBuild(
  graph: DependencyGraph,
  changedPackages: string[]
) {
  // Find all affected packages
  const affected = new Set(changedPackages);
  for (const changed of changedPackages) {
    const dependents = findAllDependents(changed, graph);
    dependents.forEach(dep => affected.add(dep));
  }

  // Get full build order
  const fullOrder = topologicalSort(graph);

  // Filter to only affected packages, preserving order
  const buildOrder = fullOrder.filter(pkg => affected.has(pkg));

  console.log(`Building ${buildOrder.length} affected packages`);
  return buildOrder;
}
```

### Workspace Validation

Validate workspace before operations:

```typescript
async function validateWorkspace(workspaceRoot: string): Promise<boolean> {
  try {
    const packages = await scanForPackageJsonFiles(workspaceRoot);

    if (packages.length === 0) {
      console.error('No packages found in workspace');
      return false;
    }

    const graph = await buildDependencyGraph(packages);
    const validation = validateGraph(graph);

    if (!validation.valid) {
      console.error('Workspace validation failed:');
      validation.errors.forEach(err => console.error(`  - ${err}`));
      return false;
    }

    console.log(`✅ Workspace valid: ${packages.length} packages`);
    return true;
  } catch (error) {
    console.error('Validation error:', error);
    return false;
  }
}
```

### Dependency Visualization

Generate visualization data:

```typescript
function generateGraphviz(graph: DependencyGraph): string {
  let dot = 'digraph dependencies {\n';
  dot += '  rankdir=LR;\n';
  dot += '  node [shape=box];\n\n';

  for (const [pkg, deps] of graph.edges) {
    for (const dep of deps) {
      dot += `  "${pkg}" -> "${dep}";\n`;
    }
  }

  dot += '}\n';
  return dot;
}

// Save to file and visualize with graphviz:
// dot -Tpng deps.dot > deps.png
```

## Error Handling

All async functions may throw errors. Recommended error handling:

```typescript
import {
  scanForPackageJsonFiles,
  buildDependencyGraph,
  topologicalSort
} from '@eldrforge/tree-core';

async function safeBuildOrder(workspaceRoot: string): Promise<string[] | null> {
  try {
    const packages = await scanForPackageJsonFiles(workspaceRoot);
    const graph = await buildDependencyGraph(packages);
    const buildOrder = topologicalSort(graph);
    return buildOrder;
  } catch (error) {
    if (error.message.includes('Circular dependency')) {
      console.error('❌ Circular dependency detected:', error.message);
      console.error('   Fix the circular dependency and try again');
    } else if (error.message.includes('no name field')) {
      console.error('❌ Invalid package.json:', error.message);
      console.error('   Ensure all package.json files have a "name" field');
    } else if (error.code === 'ENOENT') {
      console.error('❌ Directory not found:', error.path);
    } else {
      console.error('❌ Unexpected error:', error.message);
    }
    return null;
  }
}
```

## Performance Considerations

- **Caching**: Use `serializeGraph`/`deserializeGraph` to cache graph builds
- **Exclusion Patterns**: Always exclude `node_modules`, `dist`, and other large directories
- **Parallel Processing**: Use the parallel build pattern for better performance
- **Incremental Updates**: Only rebuild affected packages when possible

## Test Coverage

The library maintains **94.11% test coverage** with comprehensive unit and integration tests:

```
File               | % Stmts | % Branch | % Funcs | % Lines
-------------------|---------|----------|---------|--------
dependencyGraph.ts |   94.11 |    90.76 |      80 |   94.11
```

## Dependencies

This library depends on:

- `@eldrforge/git-tools` - Git validation and JSON parsing utilities
- `@eldrforge/shared` - Storage and filesystem abstractions

## Development

### Building

```bash
npm run build
```

### Testing

```bash
# Run tests
npm test

# Watch mode
npm run test:watch

# With coverage
npm run test:coverage
```

### Linting

```bash
npm run lint
```

## Use Cases

This library is ideal for:

- **Monorepo Build Systems** - Determine optimal build order
- **CI/CD Pipelines** - Incremental builds based on changes
- **Package Publishing** - Publish in dependency order
- **Workspace Analysis** - Understand package relationships
- **Refactoring Tools** - Find impact of changes
- **Documentation Generation** - Create dependency diagrams
- **Testing Frameworks** - Run tests in correct order
- **Migration Scripts** - Update packages in safe order

## Real-World Example: Build System

Complete example of a build system using tree-core:

```typescript
import {
  scanForPackageJsonFiles,
  buildDependencyGraph,
  topologicalSort,
  validateGraph,
  findAllDependents,
  setLogger
} from '@eldrforge/tree-core';
import { execSync } from 'child_process';
import path from 'path';

// Configure logging
setLogger({
  info: console.log,
  error: console.error,
  warn: console.warn,
  verbose: () => {}, // Disable verbose
  debug: () => {}    // Disable debug
});

async function buildWorkspace(
  workspaceRoot: string,
  options: {
    incremental?: boolean;
    changedPackages?: string[];
    parallel?: boolean;
  } = {}
) {
  console.log('🔍 Scanning workspace...');
  const packages = await scanForPackageJsonFiles(workspaceRoot, [
    '**/node_modules/**',
    '**/dist/**'
  ]);

  console.log(`📦 Found ${packages.length} packages`);

  console.log('📊 Building dependency graph...');
  const graph = await buildDependencyGraph(packages);

  console.log('✅ Validating graph...');
  const validation = validateGraph(graph);
  if (!validation.valid) {
    console.error('❌ Validation failed:');
    validation.errors.forEach(err => console.error(`   ${err}`));
    process.exit(1);
  }

  // Determine what to build
  let buildOrder = topologicalSort(graph);

  if (options.incremental && options.changedPackages) {
    console.log(`🔄 Incremental build for ${options.changedPackages.length} changed packages`);
    const affected = new Set(options.changedPackages);
    for (const changed of options.changedPackages) {
      const dependents = findAllDependents(changed, graph);
      dependents.forEach(dep => affected.add(dep));
    }
    buildOrder = buildOrder.filter(pkg => affected.has(pkg));
    console.log(`   Building ${buildOrder.length} affected packages`);
  }

  // Build packages
  console.log('🔨 Starting build...\n');
  let succeeded = 0;
  let failed = 0;

  for (const pkgName of buildOrder) {
    const pkg = graph.packages.get(pkgName)!;
    const pkgDir = pkg.path;

    console.log(`📦 Building ${pkgName}...`);

    try {
      execSync('npm run build', {
        cwd: pkgDir,
        stdio: 'pipe',
        encoding: 'utf-8'
      });
      console.log(`   ✅ ${pkgName} built successfully\n`);
      succeeded++;
    } catch (error) {
      console.error(`   ❌ ${pkgName} build failed`);
      console.error(`   ${error.message}\n`);
      failed++;

      if (!options.incremental) {
        console.error('💥 Build failed, stopping...');
        process.exit(1);
      }
    }
  }

  console.log('\n📊 Build Summary');
  console.log(`   Total: ${buildOrder.length} packages`);
  console.log(`   ✅ Succeeded: ${succeeded}`);
  console.log(`   ❌ Failed: ${failed}`);

  return { succeeded, failed };
}

// Run it
const args = process.argv.slice(2);
const workspaceRoot = args[0] || process.cwd();

buildWorkspace(workspaceRoot, {
  incremental: process.env.INCREMENTAL === 'true',
  changedPackages: process.env.CHANGED?.split(','),
  parallel: false
})
  .then(({ succeeded, failed }) => {
    process.exit(failed > 0 ? 1 : 0);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
```

Save as `build.ts` and run:

```bash
# Full build
npx tsx build.ts /path/to/workspace

# Incremental build
INCREMENTAL=true CHANGED="@myorg/core,@myorg/utils" npx tsx build.ts /path/to/workspace
```

## Contributing

Contributions are welcome! Please ensure:

1. All tests pass (`npm test`)
2. Code coverage remains above 90% (`npm run test:coverage`)
3. Code passes linting (`npm run lint`)
4. TypeScript compiles without errors (`npm run build`)

## License

MIT © Calen Varek

## Links

- [GitHub Repository](https://github.com/calenvarek/tree-core)
- [Issue Tracker](https://github.com/calenvarek/tree-core/issues)
- [npm Package](https://www.npmjs.com/package/@eldrforge/tree-core)

## Support

For questions, issues, or feature requests, please [open an issue](https://github.com/calenvarek/tree-core/issues) on GitHub.

---

Made with ❤️ for the monorepo community
