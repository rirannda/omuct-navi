import type * as LType from 'leaflet';
import type { Edge, Node as MapNode } from '../../data/types';
import { getRouteDisplay } from '../route/routeDisplay';
import { layoutRouteLabels } from '../route/labelLayout';
import type { LabelBounds } from '../route/labelLayout';
import { highlightColors } from './highlightColors';
import { getNodeBuildingId } from './nodeBuilding';

type RouteLabelDisplay = {
	marker: LType.Marker;
	offset: [number, number];
	connector?: LType.Polyline;
};
type RouteLocation = { buildingId: string; floor: number };

/** 経路の描画資源だけを所有します。階やカメラの変更は呼び出し元に通知します。 */
export function createRouteLayer(
	leaflet: typeof LType,
	map: LType.Map,
	mapContainer: HTMLElement,
	mapNodes: MapNode[],
	getFloors: () => {
		activeFloors: Readonly<Record<string, number>>;
		activeFloor: number;
		visibleBuildings: readonly { id: string }[];
	},
	onTransition: (node: MapNode) => void,
	routeEdges?: readonly Edge[],
	getVisibleHeight = () => map.getSize().y
) {
	let routeLayersByFloor: Partial<Record<number, LType.Polyline[]>> = {};
	let routeMarkersByFloor: Partial<Record<number, LType.Marker[]>> = {};
	let routePointsByFloor: Partial<Record<number, LType.LatLngExpression[]>> = {};
	const routeLocationsByLayer = new WeakMap<LType.Layer, readonly RouteLocation[]>();
	const locationOf = (node: MapNode): RouteLocation => ({
		buildingId: getNodeBuildingId(node),
		floor: node.floor
	});
	let routeLabels: RouteLabelDisplay[] = [];
	function updateRouteLabels() {
		const L = leaflet;
		if (!routeLabels.length) return;
		const viewport = { x: map.getSize().x, y: getVisibleHeight() };
		const containerRect = mapContainer.getBoundingClientRect();
		mapContainer.style.setProperty(
			'--route-label-max-width',
			`${Math.max(80, Math.min(240, viewport.x - 16))}px`
		);
		const localBounds = (element: Element): LabelBounds => {
			const rect = element.getBoundingClientRect();
			return {
				x: rect.left - containerRect.left,
				y: rect.top - containerRect.top,
				width: rect.width,
				height: rect.height
			};
		};
		const obstacles: LabelBounds[] = Array.from(
			mapContainer.parentElement?.querySelectorAll(
				'.poi-name-tooltip, .custom-control-panel, .leaflet-control-zoom'
			) ?? []
		).map(localBounds);
		// アイコンは全て残し、見えている地図の中心に近い3件だけ吹き出しを開きます。
		const candidates = routeLabels.flatMap((display) => {
			if (!map.hasLayer(display.marker) || viewport.y <= 0) return [];
			const anchor = map.latLngToContainerPoint(display.marker.getLatLng());
			if (
				anchor.x < -24 ||
				anchor.x > viewport.x + 24 ||
				anchor.y < -24 ||
				anchor.y > viewport.y + 24
			)
				return [];
			obstacles.push({ x: anchor.x - 18, y: anchor.y - 18, width: 36, height: 36 });
			return [
				{
					display,
					anchor,
					distance: (anchor.x - viewport.x / 2) ** 2 + (anchor.y - viewport.y / 2) ** 2
				}
			];
		});
		const nearest = candidates.toSorted((a, b) => a.distance - b.distance).slice(0, 3);
		for (const display of routeLabels) {
			const selected = nearest.some((candidate) => candidate.display === display);
			if (selected) display.marker.openTooltip();
			else {
				display.marker.closeTooltip();
				display.connector?.remove();
			}
			// Leafletのフェード中も、対象外の吹き出しを同時に表示しません。
			display.marker
				.getTooltip()
				?.getElement()
				?.style.setProperty('visibility', selected ? 'visible' : 'hidden');
		}
		if (mapContainer.querySelector('.leaflet-zoom-anim')) return;
		const labels = nearest.flatMap(({ display, anchor }) => {
			const tooltip = display.marker.getTooltip();
			const element = tooltip?.getElement();
			if (!tooltip || !element) return [];
			tooltip.options.offset = display.offset;
			element.classList.remove('route-label-displaced');
			tooltip.update();
			return [{ display, tooltip, element, anchor, bounds: localBounds(element) }];
		});
		const placements = layoutRouteLabels(
			labels.map(({ bounds, anchor }) => ({ ...bounds, anchorX: anchor.x, anchorY: anchor.y })),
			{ width: viewport.x, height: viewport.y },
			obstacles
		);
		for (const [index, { display, tooltip, element, anchor, bounds }] of labels.entries()) {
			const target = placements[index];
			const dx = target.x - bounds.x;
			const dy = target.y - bounds.y;
			tooltip.options.offset = [display.offset[0] + dx, display.offset[1] + dy];
			tooltip.update();
			const moved = Math.abs(dx) > 1 || Math.abs(dy) > 1;
			element.classList.toggle('route-label-displaced', moved);
			if (moved) {
				const endpoint: LType.PointExpression = [
					Math.max(target.x, Math.min(anchor.x, target.x + target.width)),
					Math.max(target.y, Math.min(anchor.y, target.y + target.height))
				];
				const points = [map.containerPointToLatLng(anchor), map.containerPointToLatLng(endpoint)];
				display.connector ??= L.polyline(points, {
					pane: 'route-lines',
					className: 'route-label-connector',
					color: '#64748b',
					weight: 1.5,
					opacity: 0.65,
					dashArray: '3 3',
					interactive: false
				});
				display.connector.setLatLngs(points);
				if (!map.hasLayer(display.connector)) display.connector.addTo(map);
				display.connector.bringToBack();
			} else {
				display.connector?.remove();
			}
		}
	}

	function updateVisibleRoute() {
		if (!map) return;
		const view = getFloors();
		const visibleBuildings = new Set(view.visibleBuildings.map(({ id }) => id));
		const isVisible = (layer: LType.Layer) =>
			(routeLocationsByLayer.get(layer) ?? []).every(({ buildingId, floor }) => {
				if (buildingId === 'outdoor') return floor === 0;
				if (!visibleBuildings.has(buildingId)) return true;
				return (view.activeFloors[buildingId] ?? view.activeFloor) === floor;
			});

		for (const layers of Object.values(routeLayersByFloor)) {
			for (const layer of layers ?? []) {
				if (isVisible(layer)) {
					if (!map.hasLayer(layer)) layer.addTo(map);
					layer.bringToFront();
				} else {
					layer.remove();
				}
			}
		}
		for (const markers of Object.values(routeMarkersByFloor)) {
			for (const marker of markers ?? []) {
				if (isVisible(marker)) {
					if (!map.hasLayer(marker)) marker.addTo(map);
				} else {
					marker.remove();
				}
			}
		}
	}

	function fitCurrentFloorRoute(floor: number) {
		if (!map || !leaflet) return;

		const points = routePointsByFloor[floor];
		if (!points?.length) return;

		map.fitBounds(leaflet.latLngBounds(points), {
			padding: [56, 64],
			maxZoom: 2
		});
	}

	function drawRoute(pathIds: readonly string[]) {
		clearRoute();
		if (pathIds.length === 0) return;

		const { segments, transitions } = getRouteDisplay([...pathIds], mapNodes, routeEdges);
		function addLine(nodes: readonly MapNode[], locations: readonly RouteLocation[]) {
			if (nodes.length < 2) return;
			const floor = nodes[0].floor;
			const line = leaflet.polyline(
				nodes.map((node) => [node.y, node.x]),
				{
					pane: 'route-lines',
					className: 'route-path',
					interactive: false,
					color: '#2563eb',
					weight: 6,
					opacity: 0.9,
					lineCap: 'round',
					lineJoin: 'round'
				}
			);
			routeLocationsByLayer.set(line, locations);
			const layers = routeLayersByFloor[floor] ?? [];
			layers.push(line);
			routeLayersByFloor[floor] = layers;
		}

		for (const segment of segments) {
			const floor = segment[0].floor;
			const points: LType.LatLngExpression[] = segment.map((node) => [node.y, node.x]);
			const floorPoints = routePointsByFloor[floor] ?? [];
			floorPoints.push(...points);
			routePointsByFloor[floor] = floorPoints;

			let location = locationOf(segment[0]);
			let buildingNodes = [segment[0]];
			for (let index = 1; index < segment.length; index++) {
				const node = segment[index];
				const nextLocation = locationOf(node);
				if (nextLocation.buildingId === location.buildingId) {
					buildingNodes.push(node);
					continue;
				}
				addLine(buildingNodes, [location]);
				// 棟間の接続線は、両側の階が表示条件を満たすときに表示します。
				addLine([segment[index - 1], node], [location, nextLocation]);
				buildingNodes = [node];
				location = nextLocation;
			}
			addLine(buildingNodes, [location]);
		}

		function addTransitionMarker(
			node: MapNode,
			text: string,
			icon: 'stairs' | 'building',
			kind: 'entry' | 'exit',
			onClick: (() => void) | undefined = undefined
		) {
			if (!leaflet) return;
			const symbol = document.createElement('span');
			const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
			svg.classList.add('route-transition-icon', `route-transition-icon-${icon}`);
			svg.setAttribute('viewBox', '0 0 24 24');
			svg.setAttribute('aria-hidden', 'true');
			const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
			path.setAttribute(
				'd',
				icon === 'stairs' ? 'M3 20h5v-5h5v-5h5V5h3' : 'M6 21V3h12v18M3 21h18M14 12h.01'
			);
			svg.appendChild(path);
			symbol.appendChild(svg);
			const label = document.createElement('span');
			label.textContent = text;
			const marker = leaflet.marker([node.y, node.x], {
				icon: leaflet.divIcon({
					html: symbol,
					className: `route-transition-marker route-transition-${kind}`,
					iconSize: [32, 32],
					iconAnchor: [16, 16]
				}),
				title: text,
				alt: text,
				keyboard: !!onClick,
				interactive: !!onClick,
				zIndexOffset: 1000
			});
			routeLocationsByLayer.set(marker, [locationOf(node)]);
			marker.bindTooltip(label, {
				permanent: true,
				direction: 'right',
				offset: [20, 0],
				className: `route-transition-label route-transition-label-${kind}`,
				opacity: 1
			});
			if (onClick) marker.on('click', onClick);
			routeLabels.push({ marker, offset: [20, 0] });
			const markers = routeMarkersByFloor[node.floor] ?? [];
			markers.push(marker);
			routeMarkersByFloor[node.floor] = markers;
		}

		for (const transition of transitions) {
			addTransitionMarker(transition.from, transition.label, transition.icon, 'entry', () => {
				onTransition(transition.to);
			});
			if (transition.exit) {
				addTransitionMarker(transition.to, transition.exit.label, transition.icon, 'exit');
			}
		}

		function addEndpointMarker(node: MapNode, kind: 'start' | 'goal' | 'start-goal') {
			if (!leaflet) return;
			const label =
				kind === 'start' ? 'スタート' : kind === 'goal' ? 'ゴール' : 'スタート / ゴール';
			const symbol = document.createElement('span');
			symbol.className = 'route-endpoint-symbol';
			if (kind === 'start-goal') {
				symbol.style.background = `linear-gradient(135deg, ${highlightColors.start.stroke} 50%, ${highlightColors.goal.stroke} 50%)`;
				symbol.textContent = 'S/G';
			} else {
				symbol.style.backgroundColor = highlightColors[kind].stroke;
				if (kind === 'start') {
					symbol.textContent = 'S';
				} else {
					const flag = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
					flag.classList.add('route-transition-icon');
					flag.setAttribute('viewBox', '0 0 24 24');
					const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
					path.setAttribute('d', 'M5 21V3M5 4h14l-3 4 3 4H5');
					flag.appendChild(path);
					symbol.appendChild(flag);
				}
			}
			symbol.setAttribute('aria-hidden', 'true');
			const marker = leaflet.marker([node.y, node.x], {
				icon: leaflet.divIcon({
					html: symbol,
					className: `route-endpoint-marker route-endpoint-${kind}`,
					iconSize: [36, 36],
					iconAnchor: [18, 18]
				}),
				title: label,
				alt: label,
				keyboard: false,
				interactive: false,
				zIndexOffset: 2000
			});
			routeLocationsByLayer.set(marker, [locationOf(node)]);
			const text = document.createElement('span');
			text.textContent = label;
			marker.bindTooltip(text, {
				permanent: true,
				direction: 'top',
				offset: [0, -20],
				className: 'route-endpoint-label',
				opacity: 1
			});
			routeLabels.push({ marker, offset: [0, -20] });
			const markers = routeMarkersByFloor[node.floor] ?? [];
			markers.push(marker);
			routeMarkersByFloor[node.floor] = markers;
		}

		const start = segments[0][0];
		const goal = segments[segments.length - 1].at(-1)!;
		if (start.id === goal.id) {
			addEndpointMarker(start, 'start-goal');
		} else {
			addEndpointMarker(start, 'start');
			addEndpointMarker(goal, 'goal');
		}

		return start;
	}

	function clearRoute() {
		for (const label of routeLabels) {
			label.marker.getTooltip()?.getElement()?.style.setProperty('visibility', 'hidden');
			label.connector?.remove();
		}
		routeLabels = [];
		for (const layers of Object.values(routeLayersByFloor)) {
			for (const layer of layers ?? []) layer.remove();
		}
		for (const markers of Object.values(routeMarkersByFloor)) {
			for (const marker of markers ?? []) {
				marker.remove();
				marker.off();
			}
		}
		routeLayersByFloor = {};
		routeMarkersByFloor = {};
		routePointsByFloor = {};
	}

	return {
		draw: drawRoute,
		clear: clearRoute,
		updateVisible: updateVisibleRoute,
		updateLabels: updateRouteLabels,
		fitFloor: fitCurrentFloorRoute,
		dispose: clearRoute
	};
}
