# @eldrforge/tree-core

Dependency graph algorithms for monorepo package analysis.

## Features

- 📦 **Package Discovery** - Scan workspace for package.json files
- 🔍 **Dependency Analysis** - Build dependency graphs
- 📊 **Topological Sort** - Determine build order
- ⚠️ **Circular Detection** - Identify circular dependencies
- 🎯 **Pattern Filtering** - Exclude packages by pattern
- 💾 **Serialization** - Save/load graphs for checkpointing

## Installation

```bash
npm install @eldrforge/tree-core
```

## Usage

```typescript
import {
  scanForPackageJsonFiles,
  buildDependencyGraph,
  topologicalSort
} from '@eldrforge/tree-core';

// Scan workspace for packages
const packagePaths = await scanForPackageJsonFiles('/path/to/workspace');

// Build dependency graph
const graph = await buildDependencyGraph(packagePaths);

// Get build order
const buildOrder = topologicalSort(graph);

console.log('Build order:', buildOrder);
```

## API

### Package Discovery

- `scanForPackageJsonFiles(directory, excludedPatterns?)` - Find all package.json files
- `parsePackageJson(packageJsonPath)` - Parse and validate a package.json
- `shouldExclude(packagePath, excludedPatterns)` - Check if package should be excluded

### Graph Building

- `buildDependencyGraph(packageJsonPaths)` - Build dependency graph from packages
- `buildReverseGraph(edges)` - Create reverse dependency map

### Graph Analysis

- `topologicalSort(graph)` - Determine execution order
- `findAllDependents(packageName, graph)` - Find all packages that depend on a package
- `validateGraph(graph)` - Check graph integrity

### Serialization

- `serializeGraph(graph)` - Convert graph to JSON-serializable format
- `deserializeGraph(serialized)` - Restore graph from serialized format

## Types

```typescript
interface PackageInfo {
  name: string;
  version: string;
  path: string;
  dependencies: Set<string>;
  devDependencies: Set<string>;
  localDependencies: Set<string>;
}

interface DependencyGraph {
  packages: Map<string, PackageInfo>;
  edges: Map<string, Set<string>>;
  reverseEdges: Map<string, Set<string>>;
}
```

## Dependencies

- `@eldrforge/git-tools` - Git operations and validation
- `@eldrforge/shared` - Shared utilities

## License

MIT © Calen Varek

