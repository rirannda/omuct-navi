import { describe, expect, it } from 'vitest';
import type { MapMarker } from '../../../data/types';
import { findNearbyFacilities } from '../nearbyFacilities';

const marker = (id: string, x: number, overrides: Partial<MapMarker> = {}): MapMarker => ({
	id,
	name: id,
	x,
	y: 0,
	categoryId: 'toilet',
	toiletType: 'men',
	buildingId: 'la',
	floor: 1,
	visibility: 'floor',
	nodeId: 'entrance',
	icon: '/toilet.svg',
	description: '',
	...overrides
});

describe('nearby facilities', () => {
	it('GPS座標からの直線距離で近い5件を選び、入力データは変更しない', () => {
		const markers = Array.from({ length: 8 }, (_, index) => marker(`toilet-${index}`, 8 - index));
		const before = [...markers];
		const results = findNearbyFacilities(
			markers,
			{ category: 'toilet' },
			{ kind: 'gps', x: 0, y: 0 }
		);
		expect(results.map(({ x }) => x)).toEqual([1, 2, 3, 4, 5]);
		expect(markers).toEqual(before);
	});

	it('建物指定では距離によらずその建物の施設を全件返し、種類はアイコン名に依存しない', () => {
		const markers = [
			marker('men', 5),
			marker('women', 20, { toiletType: 'women', floor: 2, icon: '/custom-image.png' }),
			marker('accessible', 10, { buildingId: 'admin', toiletType: 'accessible' }),
			marker('unspecified', 1, { toiletType: undefined }),
			marker('trash', 0, { categoryId: 'trash', toiletType: undefined })
		];
		const origin = { kind: 'building', buildingId: 'la' } as const;
		expect(
			findNearbyFacilities(markers, { category: 'toilet' }, origin).map(({ id }) => id)
		).toEqual(['men', 'unspecified', 'women']);
		expect(
			findNearbyFacilities(markers, { category: 'toilet', toiletType: 'women' }, origin).map(
				({ id }) => id
			)
		).toEqual(['women']);
		expect(
			findNearbyFacilities(markers, { category: 'toilet', toiletType: 'accessible' }, origin)
		).toEqual([]);
		expect(
			findNearbyFacilities(markers, { category: 'trash' }, origin).map(({ id }) => id)
		).toEqual(['trash']);
	});

	it('不明な建物や不正な座標で近さを推測しない', () => {
		const markers = [marker('valid', 10), marker('invalid', NaN)];
		expect(
			findNearbyFacilities(markers, { category: 'toilet' }, { kind: 'gps', x: Infinity, y: 0 })
		).toEqual([]);
		expect(
			findNearbyFacilities(
				markers,
				{ category: 'toilet' },
				{ kind: 'building', buildingId: 'missing' }
			)
		).toEqual([]);
		expect(
			findNearbyFacilities(markers, { category: 'toilet' }, { kind: 'gps', x: 0, y: 0 }).map(
				({ id }) => id
			)
		).toEqual(['valid']);
	});
});
