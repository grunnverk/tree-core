import { describe, it, expect } from 'vitest';
import {
    buildReverseGraph,
    topologicalSort,
    findAllDependents,
    validateGraph,
    serializeGraph,
    deserializeGraph
} from '../src/dependencyGraph.js';
import type { DependencyGraph, PackageInfo } from '../src/types.js';

// Helper to create mock graphs for testing
function createMockGraph(structure: Record<string, string[]>): DependencyGraph {
    const packages = new Map<string, PackageInfo>();
    const edges = new Map<string, Set<string>>();
    
    // Create packages
    for (const name of Object.keys(structure)) {
        packages.set(name, {
            name,
            version: '1.0.0',
            path: `/fake/path/${name}`,
            dependencies: new Set(structure[name]),
            devDependencies: new Set(),
            localDependencies: new Set(structure[name])
        });
        edges.set(name, new Set(structure[name]));
    }
    
    // Build reverse edges
    const reverseEdges = buildReverseGraph(edges);
    
    return { packages, edges, reverseEdges };
}

// Mock graph patterns for testing
const MockGraphPatterns = {
    independent: (count: number): DependencyGraph => {
        const structure: Record<string, string[]> = {};
        for (let i = 0; i < count; i++) {
            structure[`package-${i}`] = [];
        }
        return createMockGraph(structure);
    },
    
    linear: (count: number = 3): DependencyGraph => {
        const structure: Record<string, string[]> = {};
        structure['package-0'] = [];
        for (let i = 1; i < count; i++) {
            structure[`package-${i}`] = [`package-${i-1}`];
        }
        return createMockGraph(structure);
    },
    
    diamond: (): DependencyGraph => {
        return createMockGraph({
            'package-a': [],
            'package-b': ['package-a'],
            'package-c': ['package-a'],
            'package-d': ['package-b', 'package-c']
        });
    },
    
    circular: (): DependencyGraph => {
        return createMockGraph({
            'package-a': ['package-b'],
            'package-b': ['package-c'],
            'package-c': ['package-a']
        });
    },
    
    complex: (): DependencyGraph => {
        return createMockGraph({
            'package-a': [],
            'package-b': ['package-a'],
            'package-c': ['package-a'],
            'package-d': ['package-b'],
            'package-e': ['package-c'],
            'package-f': ['package-d', 'package-e']
        });
    }
};

describe('dependencyGraph', () => {
    describe('topologicalSort', () => {
        it('should sort packages in dependency order', () => {
            const graph = createMockGraph({
                'a': [],
                'b': ['a'],
                'c': ['a', 'b']
            });

            const result = topologicalSort(graph);

            expect(result.indexOf('a')).toBeLessThan(result.indexOf('b'));
            expect(result.indexOf('b')).toBeLessThan(result.indexOf('c'));
        });

        it('should handle independent packages', () => {
            const graph = MockGraphPatterns.independent(3);

            const result = topologicalSort(graph);

            expect(result).toHaveLength(3);
            expect(result).toContain('package-0');
            expect(result).toContain('package-1');
            expect(result).toContain('package-2');
        });

        it('should handle diamond dependencies', () => {
            const graph = MockGraphPatterns.diamond();

            const result = topologicalSort(graph);

            // 'a' must come before 'b' and 'c'
            expect(result.indexOf('package-a')).toBeLessThan(result.indexOf('package-b'));
            expect(result.indexOf('package-a')).toBeLessThan(result.indexOf('package-c'));
            // 'b' and 'c' must come before 'd'
            expect(result.indexOf('package-b')).toBeLessThan(result.indexOf('package-d'));
            expect(result.indexOf('package-c')).toBeLessThan(result.indexOf('package-d'));
        });

        it('should detect circular dependencies', () => {
            const graph = createMockGraph({
                'a': ['b'],
                'b': ['a']
            });

            expect(() => topologicalSort(graph)).toThrow('Circular dependency');
        });
    });

    describe('buildReverseGraph', () => {
        it('should build reverse dependency graph', () => {
            const edges = new Map([
                ['a', new Set<string>()],
                ['b', new Set(['a'])],
                ['c', new Set(['a', 'b'])]
            ]);

            const reverse = buildReverseGraph(edges);

            expect(reverse.get('a')).toEqual(new Set(['b', 'c']));
            expect(reverse.get('b')).toEqual(new Set(['c']));
            expect(reverse.get('c')).toBeUndefined();
        });
    });

    describe('findAllDependents', () => {
        it('should find all transitive dependents', () => {
            const graph = createMockGraph({
                'a': [],
                'b': ['a'],
                'c': ['b'],
                'd': ['c']
            });

            const dependents = findAllDependents('a', graph);

            expect(dependents).toContain('b');
            expect(dependents).toContain('c');
            expect(dependents).toContain('d');
            expect(dependents.size).toBe(3);
        });

        it('should return empty set for packages with no dependents', () => {
            const graph = MockGraphPatterns.linear();

            const dependents = findAllDependents('package-d', graph);

            expect(dependents.size).toBe(0);
        });
    });

    describe('serializeGraph and deserializeGraph', () => {
        it('should round-trip correctly', () => {
            const original = createMockGraph({
                'pkg-a': [],
                'pkg-b': ['pkg-a'],
                'pkg-c': ['pkg-a', 'pkg-b']
            });

            const serialized = serializeGraph(original);
            const deserialized = deserializeGraph(serialized);

            expect(deserialized.packages.size).toBe(original.packages.size);
            expect(deserialized.edges.size).toBe(original.edges.size);
            expect(deserialized.reverseEdges.size).toBe(original.reverseEdges.size);

            // Check package names match
            for (const [name, pkg] of original.packages) {
                expect(deserialized.packages.has(name)).toBe(true);
                const deserializedPkg = deserialized.packages.get(name)!;
                expect(deserializedPkg.name).toBe(pkg.name);
                expect(deserializedPkg.version).toBe(pkg.version);
                expect(deserializedPkg.path).toBe(pkg.path);
            }
        });
    });

    describe('validateGraph', () => {
        it('should validate correct graph', () => {
            const graph = createMockGraph({
                'a': [],
                'b': ['a']
            });

            const result = validateGraph(graph);

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should detect missing dependencies', () => {
            const graph = createMockGraph({
                'a': ['nonexistent']
            });

            const result = validateGraph(graph);

            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0]).toContain('nonexistent');
        });

        it('should detect circular dependencies', () => {
            const graph = createMockGraph({
                'a': ['b'],
                'b': ['a']
            });

            const result = validateGraph(graph);

            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0]).toContain('Circular dependency');
        });
    });

    describe('MockGraphPatterns', () => {
        it('should create linear pattern', () => {
            const graph = MockGraphPatterns.linear(4);

            expect(graph.packages.size).toBe(4);
            const order = topologicalSort(graph);
            expect(order[0]).toBe('package-0');
            expect(order[3]).toBe('package-3');
        });

        it('should create diamond pattern', () => {
            const graph = MockGraphPatterns.diamond();

            expect(graph.packages.size).toBe(4);
            const order = topologicalSort(graph);
            expect(order[0]).toBe('package-a');
            expect(order[3]).toBe('package-d');
        });

        it('should create independent pattern', () => {
            const graph = MockGraphPatterns.independent(5);

            expect(graph.packages.size).toBe(5);
            // All packages should have no dependencies
            for (const [, edges] of graph.edges) {
                expect(edges.size).toBe(0);
            }
        });

        it('should create complex pattern', () => {
            const graph = MockGraphPatterns.complex();

            expect(graph.packages.size).toBe(6);
            const order = topologicalSort(graph);
            // package-a should be first
            expect(order[0]).toBe('package-a');
            // package-f should be last
            expect(order[order.length - 1]).toBe('package-f');
        });
    });
});
