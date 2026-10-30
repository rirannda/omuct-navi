import { describe, expect, it } from 'vitest';
import { aStar } from '../aStar';
import type { EnhancedEdge, Node } from '../../../data/types';

const nodes: Node[] = [
	{ id: 'start', floor: 1, x: 0, y: 0 },
	{ id: 'stairs', floor: 2, x: 0, y: 1 },
	{ id: 'ramp', floor: 1, x: 10, y: 0 },
	{ id: 'goal', floor: 2, x: 0, y: 2 },
	{ id: 'isolated', floor: 1, x: 20, y: 20 }
];
const edges: EnhancedEdge[] = [
	{ id: 's-st', fromNode: 'start', toNode: 'stairs', isStairs: true, weight: 1 },
	{ id: 'st-g', fromNode: 'stairs', toNode: 'goal', isStairs: false, weight: 1 },
	{ id: 's-r', fromNode: 'start', toNode: 'ramp', isStairs: false, weight: 10 },
	{ id: 'r-g', fromNode: 'ramp', toNode: 'goal', isStairs: false, weight: 11 }
];

describe('aStar accessibility', () => {
	it('通常は短い階段経路を使い、階段除外時は長い迂回路を使う', () => {
		expect(aStar({ nodes, edges }, 'start', 'goal')).toEqual(['start', 'stairs', 'goal']);
		expect(aStar({ nodes, edges }, 'start', 'goal', { avoidStairs: true })).toEqual([
			'start',
			'ramp',
			'goal'
		]);
		expect(aStar({ nodes, edges }, 'goal', 'start', { avoidStairs: true })).toEqual([
			'goal',
			'ramp',
			'start'
		]);
		expect(edges).toHaveLength(4);
	});
	it('階段でしか届かない場合・不明ノード・到達不能を正しく扱う', () => {
		expect(
			aStar({ nodes, edges: edges.slice(0, 2) }, 'start', 'goal', { avoidStairs: true })
		).toBeNull();
		expect(aStar({ nodes, edges }, 'missing', 'goal', { avoidStairs: true })).toBeNull();
		expect(aStar({ nodes, edges }, 'start', 'isolated', { avoidStairs: true })).toBeNull();
		expect(aStar({ nodes, edges }, 'start', 'start', { avoidStairs: true })).toEqual(['start']);
	});
});
