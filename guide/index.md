# @eldrforge/tree-core - Agentic Guide

## Purpose

Dependency graph algorithms for monorepo package analysis. Provides topological sorting, cycle detection, and dependency resolution.

## Key Features

- **Dependency Graph** - Build and analyze package dependency graphs
- **Topological Sort** - Order packages by dependencies
- **Cycle Detection** - Detect circular dependencies
- **Dependency Resolution** - Resolve package dependencies
- **Change Impact** - Determine affected packages

## Usage

```typescript
import { DependencyGraph, buildDependencyGraph } from '@eldrforge/tree-core';

// Build dependency graph
const graph = await buildDependencyGraph('/path/to/monorepo');

// Get topological order
const order = graph.getTopologicalOrder();

// Find affected packages
const affected = graph.getAffectedPackages(['package-a']);

// Check for cycles
const hasCycles = graph.hasCycles();
```

## Dependencies

- @eldrforge/git-tools - Git operations
- @eldrforge/shared - Shared utilities

## Package Structure

```
src/
├── dependencyGraph.ts  # Dependency graph implementation
├── types.ts            # Type definitions
└── index.ts
```

## Key Exports

- `DependencyGraph` - Dependency graph class
- `buildDependencyGraph()` - Build graph from filesystem
- `getTopologicalOrder()` - Get build order
- `getAffectedPackages()` - Find affected packages
- `hasCycles()` - Detect circular dependencies
- `getDependents()` - Get packages that depend on target
- `getDependencies()` - Get package dependencies

