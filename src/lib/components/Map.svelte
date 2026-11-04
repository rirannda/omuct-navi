<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import 'leaflet/dist/leaflet.css';
	import '../map/mapLayers.css';
	import type * as L from 'leaflet';
	import { baseMapFiles, buildingMaps } from '../../data/maps';
	import type { BuildingMap } from '../../data/maps';
	import type { Node } from '../../data/types';
	import type { NavigationState, PoiHighlights } from '../states/navigation.svelte';
	import { highlightColors, highlightRoles } from '../map/highlightColors';
	import { createConnectedFloorLookup } from '../map/connectedFloors';
	import { createMapViewState } from '../map/state/view.svelte';
	import { createSvgLayers, MAP_BOUNDS, MAP_MAX_BOUNDS } from '../map/svgLayers';
	import { createRouteLayer } from '../map/routeLayer';
	import { createPoiLayer } from '../map/poiLayer';
	import { createMarkerLayer } from '../map/markerLayer';
	import { getNodeBuildingId } from '../map/nodeBuilding';
	import { getRouteEntryFloors } from '../route/routeFloors';
	import { layoutFloorControls } from '../map/floorControlLayout';
	import type { FloorControlPlacement } from '../map/floorControlLayout';
	import type { LabelBounds } from '../route/labelLayout';
	import BuildingFloorControls from './BuildingFloorControls.svelte';
	import BottomSheet, { BOTTOM_SHEET_PEEK_HEIGHT } from './BottomSheet.svelte';
	import type { BottomSheetSnap } from './BottomSheet.svelte';
	import RouteSearchPanel from './layout/RouteSearchPanel.svelte';

	let { navigation }: { navigation: NavigationState } = $props();
	const initialNavigation = untrack(() => navigation);
	const getConnectedFloor = createConnectedFloorLookup(
		initialNavigation.graph.nodes,
		initialNavigation.graph.edges
	);
	const view = createMapViewState(buildingMaps, getConnectedFloor);
	let mapContainer: HTMLDivElement;
	let map: L.Map | undefined;
	let svgLayers: ReturnType<typeof createSvgLayers> | undefined;
	let routeLayer: ReturnType<typeof createRouteLayer> | undefined;
	let poiLayer: ReturnType<typeof createPoiLayer> | undefined;
	let markerLayer: ReturnType<typeof createMarkerLayer> | undefined;
	let svgLayersReady = $state(false);
	let disposed = false;
	let buildingControlsContainer = $state<HTMLDivElement>();
	let buildingControlFrame: number | undefined;
	let routeLabelFrame: number | undefined;
	let buildingControlPositions = $state<Record<string, FloorControlPlacement>>({});
	let bottomSheetSnap = $state<BottomSheetSnap>('bottom');
	let settledSheetSnap = $state<BottomSheetSnap>('bottom');
	let appliedFocusRequest: NavigationState['focusRequest'] = null;
	let sheetContentMinHeight = $state<number>();
	let bottomSheetHeight = $state(BOTTOM_SHEET_PEEK_HEIGHT);
	let previousSheetSnap: BottomSheetSnap = 'bottom';
	let previousSheetHeight = BOTTOM_SHEET_PEEK_HEIGHT;
	let sheetMapOffset = BOTTOM_SHEET_PEEK_HEIGHT / 2;
	let adjustingSheet = false;
	let selectedBuildingId: string | undefined;
	let controlBuildingId = $state<string>();
	const controlBuildings = $derived(
		bottomSheetSnap === 'top'
			? []
			: view.visibleBuildings.filter(({ id }) => id === controlBuildingId)
	);
	let routeBuildings: BuildingMap[] = [];
	let renderedRoute: readonly string[] | null | undefined;
	let renderedHighlights: PoiHighlights = {};

	$effect(() => {
		const attempt = navigation.routeErrorVersion;
		const error = navigation.routeError;
		if (!attempt || !error || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		const animation = mapContainer.parentElement!.animate(
			[0, -6, 6, -4, 4, 0].map((x) => ({ transform: `translateX(${x}px)` })),
			{ duration: 360, easing: 'ease-in-out' }
		);
		return () => animation.cancel();
	});

	$effect(() => {
		const path = navigation.routePath;
		const highlights = navigation.highlights;
		const ready = svgLayersReady;
		untrack(() => {
			if (ready) renderNavigation(path, highlights);
		});
	});
	$effect(() => {
		const snap = bottomSheetSnap;
		const height = bottomSheetHeight;
		const ready = svgLayersReady;
		untrack(() => {
			if (!ready || (height === previousSheetHeight && snap === previousSheetSnap)) return;
			previousSheetHeight = height;
			previousSheetSnap = snap;
			// 見えている地図の中心を保ち、上の状態では中央以上に地図を動かしません。
			const offset = Math.round(Math.min(height, map!.getSize().y / 2) / 2);
			const movement = offset - sheetMapOffset;
			sheetMapOffset = offset;
			adjustingSheet = true;
			try {
				if (movement) map!.panBy([0, movement], { animate: false });
				updateDisplays();
			} finally {
				adjustingSheet = false;
			}
		});
	});

	$effect(() => {
		const request = navigation.focusRequest;
		if (request && svgLayersReady && bottomSheetSnap === settledSheetSnap) {
			untrack(() => {
				if (request === appliedFocusRequest) return;
				appliedFocusRequest = request;
				focusOnPoiId(request.poiId);
				if (request.showFloor && !navigation.routePath) {
					const target = navigation.resolvePoi(request.poiId);
					if (target) {
						const { buildingId, floor } = target.location;
						if (
							'svgId' in target.poi ||
							buildingMaps.find(({ id }) => id === buildingId)?.floors[floor]
						)
							selectBuilding(buildingId);
					}
				}
			});
		}
	});

	function renderNavigation(path = navigation.routePath, highlights = navigation.highlights) {
		if (!svgLayersReady || disposed) return;
		const routeChanged = path !== renderedRoute;
		let routeStart: Node | undefined;
		if (routeChanged) {
			renderedRoute = path;
			controlBuildingId = path ? undefined : selectedBuildingId;
			const entryFloors = path ? getRouteEntryFloors(path, navigation.graph.nodes) : {};
			routeBuildings = buildingMaps.filter(({ id }) => entryFloors[id] !== undefined);
			if (path) {
				routeStart = routeLayer!.draw(path);
			} else routeLayer!.clear();
		}
		for (const role of highlightRoles) {
			const id = highlights[role];
			if (!id || id === renderedHighlights[role]) continue;
			const target = navigation.resolvePoi(id);
			if (target && (poiLayer!.findTarget(id) || markerLayer!.has(id))) {
				const { buildingId, floor } = target.location;
				if (view.visibleBuildings.some(({ id }) => id === buildingId)) {
					switchFloor(buildingId, floor);
				}
			}
		}
		if (routeChanged && path && routeStart) {
			view.selectRouteFloors(getRouteEntryFloors(path, navigation.graph.nodes));
		}
		if (routeChanged) {
			setVisibleBuildings();
			updateDisplays();
			if (routeStart) routeLayer!.fitFloor(routeStart.floor);
		}
		renderedHighlights = highlights;
		poiLayer!.render(highlights);
		markerLayer!.render(highlights);
		scheduleBuildingControls();
		scheduleRouteLabels();
	}

	function scheduleBuildingControls() {
		if (disposed || !svgLayersReady || buildingControlFrame !== undefined) return;
		buildingControlFrame = requestAnimationFrame(() => {
			buildingControlFrame = undefined;
			updateBuildingControls();
		});
	}
	function scheduleRouteLabels() {
		if (disposed || !svgLayersReady || routeLabelFrame !== undefined) return;
		routeLabelFrame = requestAnimationFrame(() => {
			routeLabelFrame = undefined;
			routeLayer?.updateLabels();
		});
	}
	function updateBuildingControls() {
		if (!map || !svgLayers || !buildingControlsContainer) return;
		const size = map.getSize();
		const visibleHeight = Math.max(0, size.y - bottomSheetHeight);
		const containerRect = mapContainer.getBoundingClientRect();
		const obstacles: LabelBounds[] = Array.from(
			mapContainer.querySelectorAll('.leaflet-control, .poi-name-tooltip')
		).map((element) => {
			const rect = element.getBoundingClientRect();
			return {
				x: rect.left - containerRect.left,
				y: rect.top - containerRect.top,
				width: rect.width,
				height: rect.height
			};
		});
		const buildings = svgLayers!.getControlBuildings(view.activeFloors);
		const controls = controlBuildings.flatMap(({ id }) => {
			const panel = buildingControlsContainer!.querySelector<HTMLElement>(
				`[data-building="${id}"]`
			);
			return panel && panel.offsetHeight + 16 <= visibleHeight
				? [
						{
							id,
							width: panel.offsetWidth,
							height: panel.offsetHeight,
							previousSide: buildingControlPositions[id]?.side
						}
					]
				: [];
		});
		const positions = layoutFloorControls(
			controls,
			buildings,
			{ width: size.x, height: visibleHeight },
			obstacles
		);
		buildingControlPositions = Object.fromEntries(
			positions.map((position) => [position.id, position])
		);
		scheduleRouteLabels();
	}

	function setVisibleBuildings() {
		const buildings = navigation.routePath
			? routeBuildings
			: buildingMaps.filter(({ id }) => id === selectedBuildingId);
		view.setVisibleBuildings(buildings, false);
		scheduleBuildingControls();
	}
	function selectBuilding(buildingId: string) {
		if (navigation.routePath) {
			if (!routeBuildings.some(({ id }) => id === buildingId)) return;
		} else selectedBuildingId = buildingId;
		controlBuildingId = buildingId;
		setVisibleBuildings();
		updateDisplays();
	}
	function onMapClick(event: L.LeafletMouseEvent) {
		const target = event.originalEvent.target;
		if (
			target instanceof Element &&
			target.closest('[data-map-building], .route-transition-marker, .facility-marker')
		)
			return;
		if (!navigation.routePath) selectedBuildingId = undefined;
		controlBuildingId = undefined;
		setVisibleBuildings();
		updateDisplays();
	}
	function updateDisplays() {
		if (disposed || !svgLayersReady) return;
		svgLayers!.updateVisible(view.visibleBuildings, view.activeFloors, view.buildingOutlineColors);
		poiLayer!.updateVisible();
		markerLayer!.updateVisible();
		routeLayer!.updateVisible();
		scheduleBuildingControls();
		scheduleRouteLabels();
	}
	function updateMapState() {
		if (disposed || !svgLayersReady || adjustingSheet) return;
		updateDisplays();
	}
	function switchFloor(buildingId: string, floor: number) {
		if (!map) return;
		view.selectFloor(buildingId, floor);
		view.synchronize(buildingId);
		updateDisplays();
	}
	function focusOnLocation(x: number, y: number, zoom = 3) {
		if (!map) {
			console.error('マップが初期化されていません');
			return;
		}
		const targetZoom = Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), zoom));
		const center = map.project([y, x], targetZoom).add([0, bottomSheetHeight / 2]);
		map.flyTo(map.unproject(center, targetZoom), targetZoom, { duration: 1 });
	}
	export function focusOnPoiId(poiId: string) {
		const target = navigation.resolvePoi(poiId);
		if (!target) {
			console.error(`POIまたはノードが見つかりません: ${poiId}`);
			return;
		}
		const { buildingId, floor, x, y } = target.location;
		switchFloor(buildingId, floor);
		focusOnLocation(x, y, 2);
	}

	onMount(() => {
		for (const [role, colors] of Object.entries(highlightColors)) {
			for (const [property, value] of Object.entries(colors))
				mapContainer.style.setProperty(`--poi-${role}-${property}`, value);
		}
		async function initMap() {
			try {
				const leaflet = await import('leaflet');
				if (disposed) return;
				const mountedMap = leaflet.map(mapContainer, {
					crs: leaflet.CRS.Simple,
					minZoom: -2,
					maxZoom: 2,
					zoomControl: true,
					maxBounds: MAP_MAX_BOUNDS,
					maxBoundsViscosity: 1
				});
				map = mountedMap;
				for (const [name, zIndex] of [
					['floor-maps', 420],
					['route-lines', 430]
				] as const) {
					mountedMap.createPane(name).style.zIndex = String(zIndex);
				}
				svgLayers = createSvgLayers(
					leaflet,
					mountedMap,
					mapContainer,
					buildingMaps,
					baseMapFiles,
					selectBuilding
				);
				routeLayer = createRouteLayer(
					leaflet,
					mountedMap,
					mapContainer,
					navigation.graph.nodes,
					() => view,
					(node) => {
						switchFloor(getNodeBuildingId(node) || view.zoomedBldg, node.floor);
						focusOnLocation(node.x, node.y, Math.max(0, mountedMap.getZoom()));
					},
					navigation.graph.edges,
					() => Math.max(0, mountedMap.getSize().y - bottomSheetHeight)
				);
				poiLayer = createPoiLayer(
					leaflet,
					mountedMap,
					mapContainer,
					svgLayers,
					navigation.graph.nodes,
					navigation.pois,
					(poiId) => {
						navigation.setHighlight(poiId);
					}
				);
				const selections = await svgLayers.load();
				if (disposed) return;
				markerLayer = createMarkerLayer(
					leaflet,
					mountedMap,
					navigation.markers.filter(({ id }) => navigation.resolvePoi(id)),
					buildingMaps,
					() => view,
					(id) => navigation.setHighlight(id)
				);
				for (const { layer, buildingId, floor } of selections)
					poiLayer.enableSelection(layer, buildingId, floor);
				svgLayersReady = true;
				mountedMap.on('click', onMapClick);
				mountedMap.on('move zoom resize zoomend moveend', updateMapState);
				mountedMap.on('move zoom resize tooltipopen tooltipclose', scheduleRouteLabels);
				mountedMap.fitBounds(MAP_BOUNDS);
				updateMapState();
				renderNavigation();
			} catch (error) {
				if (!disposed) console.error('マップの初期化エラー:', error);
			}
		}
		void initMap();
		return () => {
			disposed = true;
			svgLayersReady = false;
			if (buildingControlFrame !== undefined) cancelAnimationFrame(buildingControlFrame);
			if (routeLabelFrame !== undefined) cancelAnimationFrame(routeLabelFrame);
			map?.off('move zoom resize zoomend moveend', updateMapState);
			map?.off('click', onMapClick);
			map?.off('move zoom resize tooltipopen tooltipclose', scheduleRouteLabels);
			poiLayer?.dispose();
			markerLayer?.dispose();
			routeLayer?.dispose();
			svgLayers?.dispose();
			if (map) {
				const mountedMap = map;
				if (mapContainer.querySelector('.leaflet-zoom-anim'))
					mountedMap.once('zoomend', () => mountedMap.remove());
				else mountedMap.remove();
			}
		};
	});
</script>

<div
	class={[
		'map-wrapper relative isolate h-dvh w-full overflow-hidden [&_.leaflet-bottom.leaflet-right]:bottom-(--bottom-sheet-height)! [&_.leaflet-control-attribution]:mr-2!',
		bottomSheetSnap === 'top' && 'sheet-expanded'
	]}
	style:--bottom-sheet-height={`${bottomSheetHeight}px`}
>
	<div bind:this={mapContainer} class="map-container z-1 h-full w-full bg-[#898989]!"></div>
	<BuildingFloorControls
		buildings={controlBuildings}
		positions={buildingControlPositions}
		colors={view.buildingOutlineColors}
		activeFloors={view.activeFloors}
		onfloorchange={switchFloor}
		onresize={scheduleBuildingControls}
		bind:container={buildingControlsContainer}
	/>
	<BottomSheet
		bind:snap={bottomSheetSnap}
		contentMinHeight={sheetContentMinHeight}
		onheightchange={(height) => (bottomSheetHeight = height)}
		onsettle={(snap, height) => {
			bottomSheetHeight = height;
			settledSheetSnap = snap;
		}}
	>
		<RouteSearchPanel
			{navigation}
			bind:snap={bottomSheetSnap}
			bind:contentMinHeight={sheetContentMinHeight}
		/>
	</BottomSheet>
</div>

<style>
	.sheet-expanded :global(.leaflet-control) {
		visibility: hidden;
		pointer-events: none;
	}
</style>
