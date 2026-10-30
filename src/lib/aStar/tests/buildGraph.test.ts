import { describe, expect, it } from 'vitest';
import type { Edge, Node } from '../../../data/types';
import { nodes as campusNodes } from '../../../data/nodes';
import { edges as campusEdges } from '../../../data/edges';
import { edgeStairs } from '../../../data/edge_stair';
import { buildGraph } from '../buildGraph';
import { aStar } from '../aStar';

const nodes: Node[] = [
	{ id: 'start', x: 0, y: 0, floor: 1 },
	{ id: 'goal', x: 3, y: 4, floor: 1 },
	{ id: 'upstairs', x: 0, y: 0, floor: 2 },
	{ id: 'far-stairs', x: 100, y: 0, floor: 2 }
];

describe('buildGraph', () => {
	it('通常の接続は平面距離をコストにし、ノードと接続を保持する', () => {
		const graph = buildGraph(nodes, [{ fromNode: 'start', toNode: 'goal', isStairs: false }], []);
		expect(graph.nodes).toEqual(nodes);
		expect(graph.edges).toEqual([
			{ id: 'start_to_goal', fromNode: 'start', toNode: 'goal', isStairs: false, weight: 5 }
		]);
	});

	it('階段は同じ座標でも離れた座標でも固定コスト30にする', () => {
		const graph = buildGraph(
			nodes,
			[{ fromNode: 'start', toNode: 'far-stairs', isStairs: true }],
			[{ fromNode: 'start', toNode: 'upstairs', isStairs: true }]
		);
		expect(graph.edges.map(({ weight }) => weight)).toEqual([30, 30]);
		expect(aStar(graph, 'start', 'upstairs')).toEqual(['start', 'upstairs']);
	});

	it('配列の種類ではなくisStairsでコストを決める', () => {
		const graph = buildGraph(nodes, [], [{ fromNode: 'start', toNode: 'goal', isStairs: false }]);
		expect(graph.edges[0].weight).toBe(5);
	});

	it.each([
		{ fromNode: 'missing', toNode: 'goal', isStairs: false },
		{ fromNode: 'start', toNode: 'missing', isStairs: true }
	] satisfies Edge[])('不明なノードへの接続を拒否する: $fromNode → $toNode', (edge) => {
		expect(() => buildGraph(nodes, [edge], [])).toThrow(
			`Node not found: ${edge.fromNode} -> ${edge.toNode}`
		);
	});

	it('実データの全階段に、1-1HR〜1-2HRのコストを丸めた代用コストを使う', () => {
		const graph = buildGraph(campusNodes, campusEdges, edgeStairs);
		const reference = graph.edges.find(
			({ fromNode, toNode }) => fromNode === 'node_la_f1_hr_1-1' && toNode === 'node_la_f1_hr_1-2'
		)!;
		expect(reference.weight).toBe(33.5);
		const stairs = graph.edges.filter(({ isStairs }) => isStairs);
		expect(stairs.length).toBeGreaterThan(0);
		expect(stairs.every(({ weight }) => weight === 30)).toBe(true);
	});

	it('平面距離より安い階段を経由する場合も、最小コストの経路を返す', () => {
		const nodes: Node[] = [
			{ id: 'start', x: 0, y: 0, floor: 1 },
			{ id: 'stairs', x: 100, y: 0, floor: 2 },
			{ id: 'goal', x: 70, y: 0, floor: 1 }
		];
		const graph = buildGraph(
			nodes,
			[{ fromNode: 'start', toNode: 'goal', isStairs: false }],
			[
				{ fromNode: 'start', toNode: 'stairs', isStairs: true },
				{ fromNode: 'stairs', toNode: 'goal', isStairs: true }
			]
		);
		expect(aStar(graph, 'start', 'goal')).toEqual(['start', 'stairs', 'goal']);
	});
});
