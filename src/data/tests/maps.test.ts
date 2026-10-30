import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { baseMapFiles, buildingMaps } from '../maps';
import { nodes } from '../nodes';
import { pois } from '../pois';

describe('map assets', () => {
	it('static/mapsの全SVGが読み込み対象に登録され、削除済みファイルを参照していない', () => {
		const registered = [
			...baseMapFiles,
			...buildingMaps.flatMap((building) => [
				...Object.values(building.floors),
				...(building.overview ? [building.overview] : [])
			])
		];
		const files = readdirSync('static/maps').filter((file) => file.endsWith('.svg'));
		expect([...new Set(registered)].toSorted()).toEqual(files.toSorted());
		expect(new Set(buildingMaps.map((building) => building.id)).size).toBe(buildingMaps.length);
	});

	it('食堂地下を0階として登録し、地下のPOIが対応するSVGの図形を参照できる', () => {
		const cafe = buildingMaps.find(({ id }) => id === 'cafe')!;
		expect(cafe.floors[0]).toBe('cafe_B1.svg');
		const nodeById = new Map(nodes.map((node) => [node.id, node]));
		const basementPois = pois.filter((poi) => {
			const node = nodeById.get(poi.nodeId);
			return node?.buildingId === 'cafe' && node.floor === 0;
		});
		expect(basementPois.length).toBeGreaterThan(0);
		const svg = readFileSync(`static/maps/${cafe.floors[0]}`, 'utf8');
		for (const poi of basementPois) {
			expect(svg).toContain(`id="${poi.svgId}"`);
		}
	});
});
