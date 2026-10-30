import { describe, expect, it } from 'vitest';
import type { BuildingMap } from '../../../data/maps';
import { buildingMaps } from '../../../data/maps';
import { nodes } from '../../../data/nodes';
import { edges } from '../../../data/edges';
import { edgeStairs } from '../../../data/edge_stair';
import { createConnectedFloorLookup } from '../connectedFloors';
import { createBuildingConnections, getFocusedBuildings } from '../focusedBuildings';
import { getVisibleBuildings } from '../visibleBuildings';

const building = (id: string, bounds: BuildingMap['bounds']): BuildingMap => ({
	id,
	name: id,
	bounds,
	floors: { 1: `${id}.svg` }
});
const ids = (buildings: readonly BuildingMap[]) => buildings.map(({ id }) => id);

describe('getFocusedBuildings', () => {
	it('中心に近い一部表示の棟より、全体が見える棟を近い順に優先する', () => {
		const buildings = [
			building('partial-center', [395, -10, 410, 410]),
			building('full-far', [650, 600, 700, 650]),
			building('full-near', [500, 400, 510, 410])
		];
		expect(
			ids(
				getFocusedBuildings(
					buildings,
					{ x: 400, y: 400 },
					new Map(),
					new Map(),
					2,
					120,
					[0, 0, 800, 800]
				)
			)
		).toEqual(['full-near', 'full-far']);
	});

	it('全体が見える棟、中心範囲の棟、接続先の順で枠を埋める', () => {
		const buildings = [
			building('partial-near-center', [395, -10, 410, 410]),
			building('full-far', [650, 600, 700, 650]),
			building('partial-connected', [-20, 600, 50, 650]),
			building('partial-unconnected', [650, 750, 700, 820])
		];
		const connections = new Map([['full-far', new Set(['partial-connected'])]]);
		expect(
			ids(
				getFocusedBuildings(
					buildings,
					{ x: 400, y: 400 },
					connections,
					new Map(),
					3,
					120,
					[0, 0, 800, 800]
				)
			)
		).toEqual(['full-far', 'partial-near-center', 'partial-connected']);
	});

	it('表示領域の境界まで輪郭が収まっていれば全体表示と判定する', () => {
		const buildings = [
			building('partial-center', [49, -1, 51, 51]),
			building('full-boundary', [0, 10, 20, 20])
		];
		expect(
			ids(
				getFocusedBuildings(
					buildings,
					{ x: 50, y: 50 },
					new Map(),
					new Map(),
					1,
					10,
					[0, 0, 100, 100]
				)
			)
		).toEqual(['full-boundary']);
	});

	it('中心から最も近い実際の輪郭を起点にし、L字の空白を建物内と判定しない', () => {
		const buildings = [building('corridor', [0, 0, 100, 100]), building('room', [52, 45, 62, 55])];
		const outlines = new Map([
			[
				'corridor',
				[
					{ x: 0, y: 0 },
					{ x: 10, y: 0 },
					{ x: 10, y: 90 },
					{ x: 100, y: 90 },
					{ x: 100, y: 100 },
					{ x: 0, y: 100 }
				]
			]
		]);
		expect(ids(getFocusedBuildings(buildings, { x: 50, y: 50 }, new Map(), outlines, 1))).toEqual([
			'room'
		]);
	});

	it('中心範囲の外は、建物の中心点同士ではなく起点の枠から近い順で補う', () => {
		const buildings = [
			building('root', [0, 0, 200, 10]),
			building('near-center', [0, 15, 10, 25]),
			building('touching-edge', [190, 10, 210, 20])
		];
		expect(ids(getFocusedBuildings(buildings, { x: 1, y: 5 }, new Map(), new Map(), 6, 0))).toEqual(
			['root', 'touching-edge', 'near-center']
		);
	});

	it('中心範囲の未接続棟を先に選び、空いた枠を接続先で補う', () => {
		const buildings = [
			building('root', [0, 0, 10, 10]),
			building('unconnected', [12, 0, 18, 10]),
			building('destination', [20, 0, 30, 10]),
			building('bridge', [100, 0, 110, 10])
		];
		const connections = new Map([
			['root', new Set(['bridge'])],
			['bridge', new Set(['root', 'destination'])],
			['destination', new Set(['bridge'])]
		]);
		expect(
			ids(getFocusedBuildings(buildings, { x: 5, y: 5 }, connections, new Map(), 3, 10))
		).toEqual(['root', 'unconnected', 'bridge']);
	});

	it('中心範囲を選んだ後は、接続の続く候補を順に補う', () => {
		const buildings = [
			building('root', [0, 0, 10, 10]),
			building('unconnected', [12, 0, 18, 10]),
			building('destination', [20, 0, 30, 10]),
			building('bridge', [100, 0, 110, 10])
		];
		const connections = new Map([
			['root', new Set(['bridge'])],
			['bridge', new Set(['root', 'destination'])],
			['destination', new Set(['bridge'])]
		]);
		expect(
			ids(getFocusedBuildings(buildings, { x: 5, y: 5 }, connections, new Map(), 3, 0))
		).toEqual(['root', 'bridge', 'destination']);
	});

	it('中心範囲だけで上限に達したら遠方の接続棟を追加しない', () => {
		const buildings = [
			building('root', [0, 0, 10, 10]),
			building('near', [12, 0, 18, 10]),
			building('far-connected', [100, 0, 110, 10])
		];
		const connections = new Map([['root', new Set(['far-connected'])]]);
		expect(
			ids(getFocusedBuildings(buildings, { x: 5, y: 5 }, connections, new Map(), 2, 10))
		).toEqual(['root', 'near']);
	});

	it('中心範囲にかかる細長い建物も輪郭で判定し、半径ちょうどの棟を含める', () => {
		const buildings = [
			building('root', [-5, -5, 5, 5]),
			building('boundary', [10, -2, 300, 2]),
			building('outside', [11, -2, 12, 2])
		];
		const connections = new Map([['root', new Set(['outside'])]]);
		expect(
			ids(getFocusedBuildings(buildings, { x: 0, y: 0 }, connections, new Map(), 2, 10))
		).toEqual(['root', 'boundary']);
	});

	it('中心範囲に建物がなければ最寄りの棟を起点にして接続先を補う', () => {
		const buildings = [
			building('root', [20, 0, 30, 10]),
			building('unconnected', [32, 0, 38, 10]),
			building('connected', [100, 0, 110, 10])
		];
		const connections = new Map([['root', new Set(['connected'])]]);
		expect(
			ids(getFocusedBuildings(buildings, { x: 0, y: 5 }, connections, new Map(), 2, 10))
		).toEqual(['root', 'connected']);
	});

	it('最大6棟に抑え、候補が少なければ無関係な建物を追加しない', () => {
		const buildings = Array.from({ length: 9 }, (_, index) =>
			building(`b${index}`, [index * 20, 0, index * 20 + 10, 10])
		);
		expect(ids(getFocusedBuildings(buildings, { x: 5, y: 5 }, new Map()))).toEqual([
			'b0',
			'b1',
			'b2',
			'b3',
			'b4',
			'b5'
		]);
		expect(getFocusedBuildings(buildings.slice(0, 2), { x: 5, y: 5 }, new Map()).length).toBe(2);
		expect(getFocusedBuildings([], { x: 0, y: 0 }, new Map())).toEqual([]);
		expect(getFocusedBuildings(buildings, { x: 0, y: 0 }, new Map(), new Map(), 0)).toEqual([]);
	});

	it.each<BuildingMap['bounds']>([
		[0, 350, 48, 450],
		[752, 350, 800, 450],
		[350, 0, 450, 48],
		[350, 752, 450, 800]
	])('端48pxだけ見える接続先%sを除き、次に近い建物で表示枠を埋める', (...bounds) => {
		const buildings = [
			building('root', [350, 350, 450, 450]),
			building('connected-edge', bounds),
			building('next-nearest', [460, 350, 500, 450]),
			building('farther', [510, 350, 550, 450])
		];
		const connections = new Map([
			['root', new Set(['connected-edge'])],
			['connected-edge', new Set(['root'])]
		]);
		const center = { x: 400, y: 400 };
		expect(ids(getFocusedBuildings(buildings, center, connections, new Map(), 3, 0))).toEqual([
			'root',
			'connected-edge',
			'next-nearest'
		]);
		const candidates = getVisibleBuildings(buildings, [48, 48, 752, 752]);
		expect(ids(getFocusedBuildings(candidates, center, connections, new Map(), 3))).toEqual([
			'root',
			'next-nearest',
			'farther'
		]);
	});

	it('同距離の候補はデータの入力順を変えても同じ順序で選ぶ', () => {
		const buildings = [
			building('root', [0, 0, 10, 10]),
			building('alpha', [-20, 0, -10, 10]),
			building('beta', [20, 0, 30, 10])
		];
		expect(ids(getFocusedBuildings(buildings, { x: 5, y: 5 }, new Map()))).toEqual(
			ids(getFocusedBuildings(buildings.toReversed(), { x: 5, y: 5 }, new Map()))
		);
	});
});

describe('createBuildingConnections', () => {
	it('既存の経路から棟の接続を得て、屋外経由で全棟を接続扱いにしない', () => {
		const connections = createBuildingConnections(
			buildingMaps,
			createConnectedFloorLookup(nodes, [...edges, ...edgeStairs])
		);
		expect(connections.get('la')?.has('skybridge')).toBe(true);
		expect(connections.get('skybridge')?.has('la')).toBe(true);
		expect(connections.get('staircase')?.has('ss1')).toBe(true);
		expect(connections.get('staircase')?.has('ss2')).toBe(true);
		expect(connections.get('cepc')?.has('ss1')).toBe(true);
		expect(connections.get('gym')?.size).toBe(0);
		expect(connections.has('outdoor')).toBe(false);
	});

	it('非公開の階にしか接続しない建物同士は接続扱いにしない', () => {
		const buildings = [building('alpha', [0, 0, 10, 10]), building('beta', [20, 0, 30, 10])];
		const lookup = createConnectedFloorLookup(
			[
				{ id: 'a', buildingId: 'alpha', floor: 1, x: 0, y: 0 },
				{ id: 'b', buildingId: 'beta', floor: 2, x: 0, y: 0 }
			],
			[{ fromNode: 'a', toNode: 'b', isStairs: false }]
		);
		expect(createBuildingConnections(buildings, lookup).get('alpha')?.size).toBe(0);
	});
});
