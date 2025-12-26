/**
 * Information about a single package
 */
export interface PackageInfo {
    name: string;
    version: string;
    path: string;
    dependencies: Set<string>;
    devDependencies: Set<string>;
    localDependencies: Set<string>;
}

/**
 * Dependency graph structure
 */
export interface DependencyGraph {
    packages: Map<string, PackageInfo>;
    edges: Map<string, Set<string>>;
    reverseEdges: Map<string, Set<string>>;
}

/**
 * Serialized graph for checkpointing
 */
export interface SerializedGraph {
    packages: Array<{
        name: string;
        version: string;
        path: string;
        dependencies: string[];
    }>;
    edges: Array<[string, string[]]>;
}

