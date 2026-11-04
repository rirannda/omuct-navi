import type { MapMarker, ToiletType } from '../../data/types';
import type { MapPosition } from './geolocationProjection';

export type FacilityCategory = 'toilet' | 'trash';
export type FacilitySearch = {
	category: FacilityCategory;
	toiletType?: ToiletType;
	buildingId?: string;
};

/** GPSの緯度・経度を校内地図の座標へ変換してから渡します。 */
export type GpsLocation = { enabled: false } | { enabled: true; position: MapPosition | null };

export type FacilityOrigin =
	{ kind: 'gps'; x: number; y: number } | { kind: 'building'; buildingId: string };

export const MAX_NEARBY_FACILITIES = 5;

/** GPSでは直線距離の近い5件、建物指定ではその建物の全件を返します。 */
export function findNearbyFacilities(
	markers: readonly MapMarker[],
	search: Pick<FacilitySearch, 'category' | 'toiletType'>,
	origin: FacilityOrigin
): MapMarker[] {
	const candidates = markers.filter(
		(marker) =>
			marker.categoryId === search.category &&
			(search.category !== 'toilet' ||
				!search.toiletType ||
				marker.toiletType === search.toiletType) &&
			Number.isFinite(marker.x) &&
			Number.isFinite(marker.y)
	);
	const compareNames = (a: MapMarker, b: MapMarker) =>
		a.name.localeCompare(b.name, 'ja', { numeric: true }) || a.id.localeCompare(b.id);
	if (origin.kind === 'building') {
		return candidates
			.filter(({ buildingId }) => buildingId === origin.buildingId)
			.sort(compareNames);
	}
	if (!Number.isFinite(origin.x) || !Number.isFinite(origin.y)) return [];
	const distance = (marker: MapMarker) => Math.hypot(marker.x - origin.x, marker.y - origin.y);
	return candidates
		.sort((a, b) => distance(a) - distance(b) || compareNames(a, b))
		.slice(0, MAX_NEARBY_FACILITIES);
}
