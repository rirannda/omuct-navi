import { describe, expect, it } from 'vitest';
import type { Edge, Node } from '../../../data/types';
import { nodes } from '../../../data/nodes';
import { edges } from '../../../data/edges';
import { edgeStairs } from '../../../data/edge_stair';
import { createConnectedFloorLookup } from '../connectedFloors';

const node = (id: string, buildingId: string, floor: number): Node => ({
	id,
	buildingId,
	floor,
	x: 0,
	y: 0
});
const edge = (fromNode: string, toNode: string): Edge => ({ fromNode, toNode, isStairs: false });

describe('createConnectedFloorLookup', () => {
	it('異なる階番号を結ぶ接続も双方向に参照できる', () => {
		const lookup = createConnectedFloorLookup(
			[node('a', 'alpha', 4), node('b', 'beta', 2)],
			[edge('a', 'b'), edge('a', 'b')]
		);
		expect(lookup('alpha', 4, 'beta', 4)).toBe(2);
		expect(lookup('beta', 2, 'alpha', 1)).toBe(4);
		expect(lookup('alpha', 3, 'beta', 2)).toBeUndefined();
		expect(lookup('alpha', 4, 'unknown')).toBeUndefined();
	});

	it('0階や地下階を接続先として扱える', () => {
		const lookup = createConnectedFloorLookup(
			[node('a', 'alpha', 1), node('b', 'beta', 0), node('c', 'gamma', -1)],
			[edge('a', 'b'), edge('a', 'c')]
		);
		expect(lookup('alpha', 1, 'beta', 1)).toBe(0);
		expect(lookup('alpha', 1, 'gamma', 1)).toBe(-1);
	});

	it('接続先が複数なら現在の接続先の階を優先し、未接続なら同じ階番号を選ぶ', () => {
		const lookup = createConnectedFloorLookup(
			[node('a', 'alpha', 2), node('b', 'beta', 0), node('c', 'beta', 2)],
			[edge('a', 'b'), edge('a', 'c')]
		);
		expect(lookup('alpha', 2, 'beta', 0)).toBe(0);
		expect(lookup('alpha', 2, 'beta', 9)).toBe(2);
	});

	it('従来のノードIDでも判定し、同じ棟の階段経由や欠損ノードから接続を推測しない', () => {
		const lookup = createConnectedFloorLookup(
			[
				{ id: 'node_alpha_f1_entry', floor: 1, x: 0, y: 0 },
				{ id: 'node_alpha_f2_entry', floor: 2, x: 0, y: 0 },
				{ id: 'node_beta_f3_entry', floor: 3, x: 0, y: 0 }
			],
			[
				edge('node_alpha_f1_entry', 'node_alpha_f2_entry'),
				edge('node_alpha_f2_entry', 'node_beta_f3_entry'),
				edge('missing', 'node_alpha_f1_entry')
			]
		);
		expect(lookup('alpha', 2, 'beta')).toBe(3);
		expect(lookup('alpha', 1, 'beta')).toBeUndefined();
		expect(lookup('alpha', 1, 'alpha')).toBeUndefined();
	});

	it('既存の接続データで教養棟・渡り廊下と入口の対応を得る', () => {
		const lookup = createConnectedFloorLookup(nodes, [...edges, ...edgeStairs]);
		expect(lookup('la', 1, 'skybridge', 2)).toBe(1);
		expect(lookup('skybridge', 2, 'la', 3)).toBe(2);
		expect(lookup('la', 3, 'skybridge', 2)).toBeUndefined();
		expect(lookup('entrance', 0, 'skybridge', 1)).toBeUndefined();
		expect(lookup('skybridge', 2, 'entrance', 0)).toBe(2);
	});
});
