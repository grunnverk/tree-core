import path from 'path';
import fs from 'fs/promises';
import { safeJsonParse, validatePackageJson } from '@grunnverk/git-tools';
import { createStorage } from '@grunnverk/shared';
import type { PackageInfo, DependencyGraph, SerializedGraph } from './types';

// Simple logger interface for tree-core
interface Logger {
    info(message: string, ...args: any[]): void;
    error(message: string, ...args: any[]): void;
    warn(message: string, ...args: any[]): void;
    verbose(message: string, ...args: any[]): void;
    debug(message: string, ...args: any[]): void;
}

let logger: Logger = {
    info: () => {},
    error: () => {},
    warn: () => {},
    verbose: () => {},
    debug: () => {}
};

export function setLogger(newLogger: Logger): void {
    logger = newLogger;
}

function getLogger(): Logger {
    return logger;
}

/**
 * Check if a file path matches a glob pattern
 */
const matchesPattern = (filePath: string, pattern: string): boolean => {
    // Convert simple glob patterns to regex
    // Use unique string placeholders to avoid escaping regex metacharacters we intentionally create
    const DOUBLE_STAR = '__DOUBLE_STAR__';
    const SINGLE_STAR = '__SINGLE_STAR__';
    const QUESTION = '__QUESTION__';

    const regexPattern = pattern
        .replace(/\\/g, '\\\\')           // Escape backslashes
        .replace(/\*\*/g, DOUBLE_STAR)    // Placeholder for ** (any path segments)
        .replace(/\*/g, SINGLE_STAR)      // Placeholder for * (any chars except /)
        .replace(/\?/g, QUESTION)         // Placeholder for ? (single char)
        .replace(/\./g, '\\.')            // Escape literal dots
        .replace(new RegExp(DOUBLE_STAR, 'g'), '.*')       // Replace ** placeholder with .*
        .replace(new RegExp(SINGLE_STAR, 'g'), '[^/]*')    // Replace * placeholder with [^/]*
        .replace(new RegExp(QUESTION, 'g'), '.');          // Replace ? placeholder with .

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(filePath) || regex.test(path.basename(filePath));
};

/**
 * Check if a package should be excluded based on patterns
 */
export function shouldExclude(packageJsonPath: string, excludedPatterns: string[]): boolean {
    if (!excludedPatterns || excludedPatterns.length === 0) {
        return false;
    }

    // Check both the full path and relative path patterns
    const relativePath = path.relative(process.cwd(), packageJsonPath);

    return excludedPatterns.some(pattern =>
        matchesPattern(packageJsonPath, pattern) ||
        matchesPattern(relativePath, pattern) ||
        matchesPattern(path.dirname(packageJsonPath), pattern) ||
        matchesPattern(path.dirname(relativePath), pattern)
    );
}

// Types are now imported from types.ts

function getWorkspaceGlobs(pkgJson: Record<string, unknown>): string[] {
    const w = pkgJson.workspaces;
    if (Array.isArray(w)) return w as string[];
    if (w && typeof w === 'object' && Array.isArray((w as { packages?: unknown }).packages)) {
        return (w as { packages: string[] }).packages;
    }
    return [];
}

/**
 * Scan a workspace root's package directories and add any non-excluded
 * package.json files to the results list.
 */
async function scanWorkspacePackages(
    rootDir: string,
    workspaceGlobs: string[],
    excludedPatterns: string[],
    results: string[]
): Promise<void> {
    const logger = getLogger();
    for (const pattern of workspaceGlobs) {
        const globPath = path.join(rootDir, pattern, 'package.json');
        try {
            for await (const absPath of fs.glob(globPath)) {
                if (shouldExclude(absPath, excludedPatterns)) {
                    logger.verbose(`Excluding workspace package.json at: ${absPath}`);
                    continue;
                }
                results.push(absPath);
                logger.verbose(`Found workspace package.json at: ${absPath}`);
            }
        } catch {
            // glob pattern didn't match anything
        }
    }
}

export interface ScanOptions {
    /**
     * When true, npm workspace roots are expanded to include their workspace
     * packages in the results. Use for `tree link` where cross-repo linking
     * needs to see inside monorepos. Default false — most tree operations
     * (precommit, publish, commit, pull) treat a monorepo as a single unit.
     */
    expandWorkspaces?: boolean;
}

/**
 * Scan directory for package.json files.
 * By default, treats npm workspace monorepos as single packages.
 * Pass `{ expandWorkspaces: true }` to also include workspace sub-packages
 * (useful for tree link where cross-repo linking needs the individual packages).
 */
export async function scanForPackageJsonFiles(
    directory: string,
    excludedPatterns: string[] = [],
    options: ScanOptions = {}
): Promise<string[]> {
    const expand = options.expandWorkspaces === true;
    const logger = getLogger();
    const packageJsonPaths: string[] = [];

    try {
        // First check if there's a package.json in the specified directory itself
        const directPackageJsonPath = path.join(directory, 'package.json');
        try {
            await fs.access(directPackageJsonPath);

            // Check if this package should be excluded
            if (!shouldExclude(directPackageJsonPath, excludedPatterns)) {
                packageJsonPaths.push(directPackageJsonPath);
                logger.verbose(`Found package.json at: ${directPackageJsonPath}`);

                if (expand) {
                    const raw = await fs.readFile(directPackageJsonPath, 'utf-8');
                    const pkgJson = JSON.parse(raw) as Record<string, unknown>;
                    const wsGlobs = getWorkspaceGlobs(pkgJson);
                    if (wsGlobs.length > 0) {
                        logger.verbose(`Workspace root detected at ${directory}, scanning workspace packages`);
                        await scanWorkspacePackages(directory, wsGlobs, excludedPatterns, packageJsonPaths);
                    }
                }
            } else {
                logger.verbose(`Excluding package.json at: ${directPackageJsonPath} (matches exclusion pattern)`);
            }
        } catch {
            // No package.json in the root of this directory, that's fine
        }

        // Then scan subdirectories for package.json files
        const entries = await fs.readdir(directory, { withFileTypes: true });

        for (const entry of entries) {
            if (entry.isDirectory()) {
                const subDirPath = path.join(directory, entry.name);
                const packageJsonPath = path.join(subDirPath, 'package.json');

                try {
                    await fs.access(packageJsonPath);

                    // Check if this package should be excluded
                    if (shouldExclude(packageJsonPath, excludedPatterns)) {
                        logger.verbose(`Excluding package.json at: ${packageJsonPath} (matches exclusion pattern)`);
                        continue;
                    }

                    packageJsonPaths.push(packageJsonPath);
                    logger.verbose(`Found package.json at: ${packageJsonPath}`);

                    if (expand) {
                        const raw = await fs.readFile(packageJsonPath, 'utf-8');
                        const pkgJson = JSON.parse(raw) as Record<string, unknown>;
                        const wsGlobs = getWorkspaceGlobs(pkgJson);
                        if (wsGlobs.length > 0) {
                            logger.verbose(`Workspace root detected at ${subDirPath}, scanning workspace packages`);
                            await scanWorkspacePackages(subDirPath, wsGlobs, excludedPatterns, packageJsonPaths);
                        }
                    }
                } catch {
                    // No package.json in this directory, continue
                }
            }
        }
    } catch (error) {
        logger.error(`DEPENDENCY_GRAPH_SCAN_FAILED: Failed to scan directory | Directory: ${directory} | Error: ${error}`);
        throw error;
    }

    return packageJsonPaths;
}

/**
 * Parse a single package.json file
 */
export async function parsePackageJson(packageJsonPath: string): Promise<PackageInfo> {
    const logger = getLogger();
    const storage = createStorage();

    try {
        const content = await storage.readFile(packageJsonPath, 'utf-8');
        const parsed = safeJsonParse(content, packageJsonPath);
        const packageJson = validatePackageJson(parsed, packageJsonPath);

        if (!packageJson.name) {
            throw new Error(`Package at ${packageJsonPath} has no name field`);
        }

        const dependencies = new Set<string>();
        const devDependencies = new Set<string>();

        // Collect all types of dependencies
        const depTypes = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
        for (const depType of depTypes) {
            if (packageJson[depType]) {
                Object.keys(packageJson[depType]).forEach(dep => {
                    dependencies.add(dep);
                    if (depType === 'devDependencies') {
                        devDependencies.add(dep);
                    }
                });
            }
        }

        return {
            name: packageJson.name,
            version: packageJson.version || '0.0.0',
            path: path.dirname(packageJsonPath),
            dependencies,
            devDependencies,
            localDependencies: new Set() // Will be populated later
        };
    } catch (error) {
        logger.error(`DEPENDENCY_GRAPH_PARSE_FAILED: Failed to parse package.json | Path: ${packageJsonPath} | Error: ${error}`);
        throw error;
    }
}

/**
 * Build dependency graph from package.json paths
 */
export async function buildDependencyGraph(
    packageJsonPaths: string[]
): Promise<DependencyGraph> {
    const logger = getLogger();
    const packages = new Map<string, PackageInfo>();
    const edges = new Map<string, Set<string>>();

    // First pass: parse all package.json files
    for (const packageJsonPath of packageJsonPaths) {
        const packageInfo = await parsePackageJson(packageJsonPath);
        packages.set(packageInfo.name, packageInfo);
        logger.verbose(`Parsed package: ${packageInfo.name} at ${packageInfo.path}`);
    }

    // Second pass: identify local dependencies and build edges
    for (const [packageName, packageInfo] of packages) {
        const localDeps = new Set<string>();
        const edgesSet = new Set<string>();

        for (const dep of packageInfo.dependencies) {
            if (packages.has(dep)) {
                localDeps.add(dep);
                edgesSet.add(dep);
                logger.verbose(`${packageName} depends on local package: ${dep}`);
            }
        }

        packageInfo.localDependencies = localDeps;
        edges.set(packageName, edgesSet);
    }

    // Build reverse edges (dependents)
    const reverseEdges = buildReverseGraph(edges);

    return { packages, edges, reverseEdges };
}

/**
 * Build reverse dependency graph (package -> dependents)
 */
export function buildReverseGraph(
    edges: Map<string, Set<string>>
): Map<string, Set<string>> {
    const reverse = new Map<string, Set<string>>();

    for (const [pkg, deps] of edges) {
        for (const dep of deps) {
            if (!reverse.has(dep)) {
                reverse.set(dep, new Set());
            }
            reverse.get(dep)!.add(pkg);
        }
    }

    return reverse;
}

/**
 * Perform topological sort on dependency graph
 */
export function topologicalSort(graph: DependencyGraph): string[] {
    const logger = getLogger();
    const { packages, edges } = graph;
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const result: string[] = [];

    const visit = (packageName: string): void => {
        if (visited.has(packageName)) {
            return;
        }

        if (visiting.has(packageName)) {
            throw new Error(`Circular dependency detected involving package: ${packageName}`);
        }

        visiting.add(packageName);

        // Visit all dependencies first
        const deps = edges.get(packageName) || new Set();
        for (const dep of deps) {
            visit(dep);
        }

        visiting.delete(packageName);
        visited.add(packageName);
        result.push(packageName);
    };

    // Visit all packages
    for (const packageName of packages.keys()) {
        if (!visited.has(packageName)) {
            visit(packageName);
        }
    }

    logger.verbose(`Topological sort completed. Build order determined for ${result.length} packages.`);
    return result;
}

/**
 * Find all dependents of a package (packages that depend on it)
 */
export function findAllDependents(
    packageName: string,
    graph: DependencyGraph
): Set<string> {
    const dependents = new Set<string>();
    const visited = new Set<string>();

    const traverse = (pkg: string) => {
        if (visited.has(pkg)) return;
        visited.add(pkg);

        const directDependents = graph.reverseEdges.get(pkg) || new Set();
        for (const dependent of directDependents) {
            dependents.add(dependent);
            traverse(dependent);
        }
    };

    traverse(packageName);
    return dependents;
}

/**
 * Serialize graph for checkpoint persistence
 */
export function serializeGraph(graph: DependencyGraph): SerializedGraph {
    return {
        packages: Array.from(graph.packages.values()).map(pkg => ({
            name: pkg.name,
            version: pkg.version,
            path: pkg.path,
            dependencies: Array.from(pkg.dependencies)
        })),
        edges: Array.from(graph.edges.entries()).map(([pkg, deps]) => [
            pkg,
            Array.from(deps)
        ])
    };
}

/**
 * Deserialize graph from checkpoint
 */
export function deserializeGraph(serialized: SerializedGraph): DependencyGraph {
    const packages = new Map<string, PackageInfo>();
    const edges = new Map<string, Set<string>>();

    // Restore packages
    for (const pkg of serialized.packages) {
        packages.set(pkg.name, {
            name: pkg.name,
            version: pkg.version,
            path: pkg.path,
            dependencies: new Set(pkg.dependencies),
            devDependencies: new Set(),
            localDependencies: new Set()
        });
    }

    // Restore edges
    for (const [pkg, deps] of serialized.edges) {
        edges.set(pkg, new Set(deps));
    }

    // Build reverse edges
    const reverseEdges = buildReverseGraph(edges);

    return { packages, edges, reverseEdges };
}

/**
 * Validate graph integrity
 */
export function validateGraph(graph: DependencyGraph): {
    valid: boolean;
    errors: string[];
} {
    const errors: string[] = [];

    // Check all edge targets exist
    for (const [pkg, deps] of graph.edges) {
        for (const dep of deps) {
            if (!graph.packages.has(dep)) {
                errors.push(`Package ${pkg} depends on ${dep} which doesn't exist`);
            }
        }
    }

    // Check for circular dependencies
    try {
        topologicalSort(graph);
    } catch (error: any) {
        errors.push(error.message);
    }

    return {
        valid: errors.length === 0,
        errors
    };
}
