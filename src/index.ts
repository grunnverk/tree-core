/**
 * @eldrforge/tree-core
 *
 * Dependency graph algorithms for monorepo package analysis.
 */

// Types
export type { PackageInfo, DependencyGraph, SerializedGraph } from './types.js';

// Package discovery
export {
    scanForPackageJsonFiles,
    parsePackageJson,
    shouldExclude
} from './dependencyGraph.js';

// Graph building
export {
    buildDependencyGraph,
    buildReverseGraph
} from './dependencyGraph.js';

// Graph analysis
export {
    topologicalSort,
    findAllDependents,
    validateGraph
} from './dependencyGraph.js';

// Serialization
export {
    serializeGraph,
    deserializeGraph
} from './dependencyGraph.js';

// Logger configuration
export { setLogger } from './dependencyGraph.js';
