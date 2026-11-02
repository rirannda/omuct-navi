import type * as L from 'leaflet';
import type { MapPosition } from './geolocationProjection';

/** 現在地と測位精度の表示だけを所有し、カメラや階の変更は行いません。 */
export function createLocationLayer(leaflet: typeof L, map: L.Map) {
	const accuracy = leaflet.circle([0, 0], {
		pane: 'current-location',
		radius: 0,
		color: '#2563eb',
		weight: 1,
		fillOpacity: 0.1,
		interactive: false
	});
	const marker = leaflet.circleMarker([0, 0], {
		pane: 'current-location',
		radius: 7,
		color: '#fff',
		weight: 3,
		fillColor: '#2563eb',
		fillOpacity: 1,
		className: 'current-location-marker',
		interactive: false
	});
	function clear() {
		accuracy.remove();
		marker.remove();
		accuracy.setLatLng([0, 0]).setRadius(0);
		marker.setLatLng([0, 0]);
	}
	return {
		update(position: MapPosition | null) {
			if (!position) return clear();
			const point: L.LatLngTuple = [position.y, position.x];
			if (position.accuracy && Number.isFinite(position.accuracy)) {
				accuracy.setLatLng(point).setRadius(position.accuracy);
				if (!map.hasLayer(accuracy)) accuracy.addTo(map);
			} else accuracy.remove();
			marker.setLatLng(point);
			if (!map.hasLayer(marker)) marker.addTo(map);
		},
		dispose: clear
	};
}
