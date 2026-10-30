import { describe, expect, it } from 'vitest';
import { markers } from '../markers';
import { nodes } from '../nodes';
import { pois } from '../pois';

describe('marker data', () => {
	it('POIとマーカーのIDは重複せず、表示位置と経路ノードが有効である', () => {
		const ids = [...pois, ...markers].map(({ id }) => id);
		expect(new Set(ids).size).toBe(ids.length);
		const nodeIds = new Set(nodes.map(({ id }) => id));
		for (const marker of markers) {
			expect(marker.icon.trim(), marker.id).not.toBe('');
			expect(nodeIds.has(marker.nodeId), `${marker.id}: 経路ノードが存在しません`).toBe(true);
			expect(Number.isFinite(marker.x) && Number.isFinite(marker.y), marker.id).toBe(true);
			expect(Number.isInteger(marker.floor), marker.id).toBe(true);
			expect(marker.buildingId.trim(), marker.id).not.toBe('');
		}
	});
});
