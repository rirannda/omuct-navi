import type * as L from 'leaflet';
import type { MapMarker } from '../../data/types';
import type { BuildingMap } from '../../data/maps';
import { buildingNames } from '../../data/buildings';
import type { PoiHighlights } from '../states/navigation.svelte';
import { highlightRoles } from './highlightColors';
import { formatFloorLabel } from './floorDisplay';

/** 静的SVGとは独立した、選択可能な施設アイコンを管理します。 */
export function createMarkerLayer(
	leaflet: typeof L,
	map: L.Map,
	markers: readonly MapMarker[],
	buildings: readonly BuildingMap[],
	getView: () => {
		activeFloors: Readonly<Record<string, number>>;
		visibleBuildings: readonly BuildingMap[];
	},
	onSelect: (id: string) => void
) {
	const byBuilding = new Map(buildings.map((building) => [building.id, building]));
	let highlights: PoiHighlights = {};
	let visibleMarkerIds: Set<string> | null = null;
	let disposed = false;
	const entries = markers.map((data) => {
		const symbol = document.createElement('span');
		symbol.className = 'facility-marker-symbol';
		symbol.setAttribute('aria-hidden', 'true');
		const image = document.createElement('img');
		image.src = data.icon;
		image.alt = '';
		image.draggable = false;
		symbol.appendChild(image);
		const label = document.createElement('span');
		const buildingName = byBuilding.get(data.buildingId)?.name ?? buildingNames[data.buildingId];
		label.textContent =
			data.buildingId === 'outdoor'
				? data.name
				: `${data.name}（${[buildingName, formatFloorLabel(data.buildingId, data.floor)].filter(Boolean).join(' ')}）`;
		const layer = leaflet.marker([data.y, data.x], {
			icon: leaflet.divIcon({
				html: symbol,
				className: 'facility-marker',
				iconSize: [44, 44],
				iconAnchor: [22, 22]
			}),
			title: label.textContent,
			keyboard: true,
			bubblingMouseEvents: false,
			riseOnHover: true
		});
		layer.bindTooltip(label, {
			direction: 'top',
			offset: [0, -18],
			opacity: 1,
			className: 'poi-name-tooltip facility-marker-tooltip'
		});
		const select = () => {
			if (map.hasLayer(layer)) onSelect(data.id);
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				event.stopPropagation();
				select();
			}
		};
		layer.on('click', select);
		layer.on('add', () => {
			const element = layer.getElement()!;
			element.setAttribute('data-marker-id', data.id);
			element.setAttribute('aria-label', data.name);
			element.addEventListener('keydown', onKeyDown);
		});
		return { data, layer, onKeyDown };
	});
	const byId = new Map(entries.map((entry) => [entry.data.id, entry]));

	function updateVisible() {
		if (disposed) return;
		const { activeFloors, visibleBuildings } = getView();
		const displayedBuildings = new Set(visibleBuildings.map(({ id }) => id));
		for (const { data, layer } of entries) {
			const role = highlightRoles.findLast((role) => highlights[role] === data.id);
			// 階の選択履歴だけでなく、現在その建物の詳細図を表示しているかも確認します。
			const visible =
				data.buildingId === 'outdoor' ||
				data.visibility === 'always' ||
				(displayedBuildings.has(data.buildingId) && data.floor === activeFloors[data.buildingId]);
			if (!visible || (visibleMarkerIds && !visibleMarkerIds.has(data.id) && !role)) {
				layer.remove();
				continue;
			}
			if (!map.hasLayer(layer)) layer.addTo(map);
			const element = layer.getElement()!;
			for (const color of highlightRoles) element.classList.remove(`poi-color-${color}`);
			element.classList.toggle('facility-marker-highlight', !!role);
			if (role) element.classList.add(`poi-color-${role}`);
			const tooltip = layer.getTooltip()!;
			const className = `poi-name-tooltip facility-marker-tooltip${role ? ` poi-color-${role}` : ''}`;
			tooltip.options.className = className;
			tooltip.options.permanent = !!role;
			const tooltipElement = tooltip.getElement();
			if (tooltipElement) {
				for (const color of highlightRoles) tooltipElement.classList.remove(`poi-color-${color}`);
				if (role) tooltipElement.classList.add(`poi-color-${role}`);
			}
			if (role) layer.openTooltip();
			else layer.closeTooltip();
		}
	}

	return {
		has: (id: string) => byId.has(id),
		render: (next: PoiHighlights, markerIds: readonly string[] | null = null) => {
			highlights = next;
			visibleMarkerIds = markerIds ? new Set(markerIds) : null;
			updateVisible();
		},
		updateVisible,
		dispose: () => {
			disposed = true;
			for (const { layer, onKeyDown } of entries) {
				layer.getElement()?.removeEventListener('keydown', onKeyDown);
				layer.unbindTooltip();
				layer.remove();
				layer.off();
			}
		}
	};
}
