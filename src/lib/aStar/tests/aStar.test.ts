import { describe, expect, it } from 'vitest';
import type { EnhancedEdge, Node } from '../../../data/types';
import { aStar } from '../aStar';

const nodes: Node[] = [
	{ id: 'start', x: 0, y: 0, floor: 1 },
	{ id: 'middle', x: 4, y: 0, floor: 1 },
	{ id: 'goal', x: 10, y: 0, floor: 1 },
	{ id: 'isolated', x: 20, y: 0, floor: 1 }
];

function edge(fromNode: string, toNode: string, weight: number, isStairs = false): EnhancedEdge {
	return { id: `${fromNode}_to_${toNode}`, fromNode, toNode, weight, isStairs };
}

const graph = {
	nodes,
	edges: [edge('start', 'middle', 4), edge('middle', 'goal', 6)]
};

describe('aStar', () => {
	it('通常の接続を双方向に探索し、始点から終点までの経路を返す', () => {
		expect(aStar(graph, 'start', 'goal')).toEqual(['start', 'middle', 'goal']);
		expect(aStar(graph, 'goal', 'start')).toEqual(['goal', 'middle', 'start']);
	});

	it('始点と終点が同じ場合はそのノードだけを返す', () => {
		expect(aStar(graph, 'start', 'start')).toEqual(['start']);
	});

	it.each([
		['missing', 'goal'],
		['start', 'missing']
	])('不明なノードIDではnullを返す: %s → %s', (startId, goalId) => {
		expect(aStar(graph, startId, goalId)).toBeNull();
	});

	it('終点へ到達できない場合はnullを返す', () => {
		expect(aStar(graph, 'start', 'isolated')).toBeNull();
	});

	it('階段の固定コストが平面距離より小さくても、合計コストが最小の経路を選ぶ', () => {
		const graph = {
			nodes: [
				{ id: 'start', x: 0, y: 0, floor: 1 },
				{ id: 'stairs', x: 100, y: 0, floor: 2 },
				{ id: 'goal', x: 10, y: 0, floor: 1 }
			],
			edges: [
				edge('start', 'goal', 10),
				edge('start', 'stairs', 3, true),
				edge('stairs', 'goal', 3, true)
			]
		};
		expect(aStar(graph, 'start', 'goal')).toEqual(['start', 'stairs', 'goal']);
	});
});
