import { describe, expect, it } from 'vitest';
import type { Node } from '../../../data/types';
import { getRouteDisplay } from '../routeDisplay';

function node(id: string, floor: number, x = 0, y = 0, buildingId?: string): Node {
	return { id, floor, x, y, buildingId };
}

function display(nodes: Node[]) {
	return getRouteDisplay(
		nodes.map((node) => node.id),
		nodes
	);
}

describe('getRouteDisplay', () => {
	it.each([true, false])(
		'階の異なる接続でも階段アイコンはエッジの階段フラグに従う (%s)',
		(isStairs) => {
			const path = [node('outside', 0, 0, 0, 'outdoor'), node('bridge', 1, 10, 0, 'skybridge')];
			const result = getRouteDisplay(
				path.map(({ id }) => id),
				path,
				[{ fromNode: 'outside', toNode: 'bridge', isStairs }]
			);
			expect(result.transitions[0].icon).toBe(isStairs ? 'stairs' : 'building');
		}
	);
	it('エントランス・渡り廊下・中央階段・地上を表示名で案内する', () => {
		const nodes = [
			node('gate', 0, 0, 0, 'outdoor'),
			node('ground', 0, 1, 0, 'entrance'),
			node('first', 1, 1, 0, 'entrance'),
			node('bridge', 1, 2, 0, 'skybridge'),
			node('stairs', 1, 3, 0, 'staircase')
		];
		expect(display(nodes).transitions.map(({ label }) => label)).toEqual([
			'エントランス 地上へ',
			'エントランス 1階へ',
			'渡り廊下 1階へ',
			'中央階段 1階へ'
		]);
	});
	it('同じ建物・階の経路には移動案内を追加しない', () => {
		const nodes = [node('node_la_f1_start', 1), node('node_la_f1_goal', 1, 10)];
		expect(display(nodes)).toEqual({ segments: [nodes], transitions: [] });
	});

	it('連続する階の移動は階段マークで案内し、通過階に出口を作らない', () => {
		const nodes = [
			node('node_la_f1_stair', 1),
			node('node_la_f2_stair', 2),
			node('node_la_f3_stair', 3)
		];
		const result = display(nodes);
		expect(result.segments).toEqual(nodes.map((node) => [node]));
		expect(result.transitions).toEqual([
			{ from: nodes[0], to: nodes[1], label: '教養棟 2階へ', icon: 'stairs', exit: null },
			{ from: nodes[1], to: nodes[2], label: '教養棟 3階へ', icon: 'stairs', exit: null }
		]);
	});

	it('下降でも同じ階段マークと移動先を示す', () => {
		const nodes = [node('node_la_f2_stair', 2), node('node_la_f1_stair', 1)];
		expect(display(nodes).transitions).toEqual([
			{ from: nodes[0], to: nodes[1], label: '教養棟 1階へ', icon: 'stairs', exit: null }
		]);
	});

	it.each([
		{ x: 10, y: 0 },
		{ x: 0, y: 10 },
		{ x: -10, y: 0 },
		{ x: 0, y: -10 }
	])('同じ階の建物間移動には方向に依存しない建物マークを使う ($x, $y)', ({ x, y }) => {
		const nodes = [node('node_la_f1_exit', 1), node('node_ss1_f1_entrance', 1, x, y)];
		const result = display(nodes);
		expect(result.segments).toEqual([nodes]);
		expect(result.transitions).toEqual([
			{ from: nodes[0], to: nodes[1], label: '専門棟1 1階へ', icon: 'building', exit: null }
		]);
	});

	it('建物と階を同時にまたぐ場合にも移動先を示す', () => {
		const nodes = [node('node_la_f1_exit', 1), node('node_ss1_f2_entrance', 2)];
		expect(display(nodes).transitions).toEqual([
			{ from: nodes[0], to: nodes[1], label: '専門棟1 2階へ', icon: 'stairs', exit: null }
		]);
	});

	it('明示された建物IDを優先し、地下階を案内する', () => {
		const nodes = [node('start', 1, 0, 0, 'la'), node('goal', -1, 0, 0, 'ss1')];
		expect(display(nodes).transitions).toEqual([
			{
				from: nodes[0],
				to: nodes[1],
				label: '専門棟1 地下1階へ',
				icon: 'stairs',
				exit: null
			}
		]);
	});

	it('入口・出口は経路の進行方向にかかわらず同じ階段マークを使う', () => {
		const nodes = [
			node('node_la_f1_hall', 1, -10, 0),
			node('node_la_f1_stair', 1),
			node('node_la_f2_stair', 2),
			node('node_la_f2_hall', 2, 0, -10)
		];
		expect(display(nodes).transitions).toEqual([
			{
				from: nodes[1],
				to: nodes[2],
				label: '教養棟 2階へ',
				icon: 'stairs',
				exit: { label: '教養棟 1階から進む' }
			}
		]);
		expect(display([...nodes].reverse()).transitions).toEqual([
			{
				from: nodes[2],
				to: nodes[1],
				label: '教養棟 1階へ',
				icon: 'stairs',
				exit: { label: '教養棟 2階から進む' }
			}
		]);
	});

	it('同じ階の建物間移動でも出口に建物マークを表示する', () => {
		const nodes = [
			node('node_la_f1_exit', 1),
			node('node_ss1_f1_entrance', 1, 10, 0),
			node('node_ss1_f1_hall', 1, 10, 10)
		];
		expect(display(nodes).transitions).toEqual([
			{
				from: nodes[0],
				to: nodes[1],
				label: '専門棟1 1階へ',
				icon: 'building',
				exit: { label: '教養棟 1階から進む' }
			}
		]);
	});

	it('出口付近に同じ座標が並んでも、その先に経路が続けば出口を案内する', () => {
		const nodes = [
			node('node_la_f1_hall', 1, 10, 0),
			node('node_la_f1_landing', 1),
			node('node_la_f1_stair', 1),
			node('node_la_f2_stair', 2),
			node('node_la_f2_landing', 2),
			node('node_la_f2_hall', 2, -10, 0)
		];
		expect(display(nodes).transitions).toEqual([
			{
				from: nodes[2],
				to: nodes[3],
				label: '教養棟 2階へ',
				icon: 'stairs',
				exit: { label: '教養棟 1階から進む' }
			}
		]);
	});

	it('空の経路には表示内容がなく、単一ノードには案内を追加しない', () => {
		expect(display([])).toEqual({ segments: [], transitions: [] });
		const nodes = [node('node_la_f1_goal', 1)];
		expect(display(nodes)).toEqual({ segments: [nodes], transitions: [] });
	});

	it('存在しないノードを含む経路はエラーにする', () => {
		expect(() => getRouteDisplay(['missing'], [])).toThrow(
			'経路上のノードが見つかりません: missing'
		);
	});
});
