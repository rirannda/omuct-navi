<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import 'leaflet/dist/leaflet.css';
	import '../map/mapLayers.css';
	import type * as L from 'leaflet';
	import { baseMapFiles, buildingMaps } from '../../data/maps';
	import { geolocationReferenceSource } from '../../data/geolocation';
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
	import { createLocationLayer } from '../map/locationLayer';
	import { isPositionOnRoute } from '../map/routePosition';
	import type { MapPosition } from '../map/geolocationProjection';
	import { getRouteDisplay } from '../route/routeDisplay';
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
	const projectDisclaimer =
		'omuct-naviは !MS チームが総合課題実習の一環として作成したソフトウェアです。高専祭運営の公式情報ではないため間違っている場合があります。';
	const id = $props.id();
	const locationHintId = `${id}-location-stop-hint`;
	const showLocationHint = $derived(
		navigation.gpsLocation.enabled || navigation.gps.requesting || navigation.gps.error !== null
	);
	const initialNavigation = untrack(() => navigation);
	const getConnectedFloor = createConnectedFloorLookup(
		initialNavigation.graph.nodes,
		initialNavigation.graph.edges
	);
	const view = createMapViewState(buildingMaps, getConnectedFloor);
	let mapContainer: HTMLDivElement;
	let map: L.Map | undefined;
	let mapZoom = $state<number | null>(null);
	let svgLayers: ReturnType<typeof createSvgLayers> | undefined;
	let routeLayer: ReturnType<typeof createRouteLayer> | undefined;
	let poiLayer: ReturnType<typeof createPoiLayer> | undefined;
	let markerLayer: ReturnType<typeof createMarkerLayer> | undefined;
	let locationLayer: ReturnType<typeof createLocationLayer> | undefined;
	let followArmed = $state(false);
	let pendingLocationFocus = false;
	let pendingRouteFocus = false;
	let appliedCurrentLocationRequest = 0;
	const routeSegments = $derived(
		navigation.routePath
			? getRouteDisplay([...navigation.routePath], navigation.graph.nodes, navigation.graph.edges)
					.segments
			: []
	);
	let svgLayersReady = $state(false);
	let disposed = false;
	let buildingControlsContainer = $state<HTMLDivElement>();
	let buildingControlFrame: number | undefined;
	let routeLabelFrame: number | undefined;
	let buildingControlPositions = $state<Record<string, FloorControlPlacement>>({});
	let bottomSheetSnap = $state<BottomSheetSnap>('bottom');
	let settledSheetSnap = $state<BottomSheetSnap>('bottom');
	let appliedFocusRequest: NavigationState['focusRequest'] = null;
	let appliedFacilitySearch: NavigationState['facilitySearch'] = null;
	let sheetContentMinHeight = $state<number>();
	let bottomSheetHeight = $state(BOTTOM_SHEET_PEEK_HEIGHT);
	let rootFontSize = $state(16);
	const middleMinHeight = $derived((navigation.isFestival ? 22.5 : 20) * rootFontSize + 56);
	const peekHeight = $derived(
		navigation.isFestival ? 8.5 * rootFontSize + 56 : BOTTOM_SHEET_PEEK_HEIGHT
	);
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
	let interactedRoute: NavigationState['routePath'] | undefined;
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
		const markerIds = navigation.facilitySearch
			? navigation.facilityResults.map(({ id }) => id)
			: null;
		const ready = svgLayersReady;
		untrack(() => {
			if (ready) renderNavigation(path, highlights, markerIds);
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
				if (movement) {
					// 地図の境界で復帰アニメーションとシートの移動が競合しないようにします。
					const center = map!.project(map!.getCenter()).add([0, movement]);
					map!.setView(map!.unproject(center), map!.getZoom(), { animate: false });
				}
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
				const gps = navigation.gpsLocation;
				if (navigation.routePath && (gps.enabled || navigation.gps.requesting)) return;
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

	$effect(() => {
		const request = navigation.facilitySearch;
		const results = navigation.facilityResults;
		const ready = svgLayersReady;
		const settled = bottomSheetSnap === settledSheetSnap;
		const height = bottomSheetHeight;
		untrack(() => {
			if (!request) {
				appliedFacilitySearch = null;
				return;
			}
			if (!ready || !settled || !results.length || request === appliedFacilitySearch) return;
			if (map!.getSize().y - height < 100) return;
			appliedFacilitySearch = request;
			const first = results[0];
			switchFloor(first.buildingId, first.floor);
			if (
				!navigation.routePath &&
				buildingMaps.find(({ id }) => id === first.buildingId)?.floors[first.floor]
			)
				selectBuilding(first.buildingId);
			const points: L.LatLngTuple[] = results.map(({ x, y }) => [y, x]);
			const gps = navigation.gpsLocation;
			if (gps.enabled && gps.position) points.push([gps.position.y, gps.position.x]);
			map!.fitBounds(points, {
				paddingTopLeft: [24, 24],
				paddingBottomRight: [24, height + 24],
				maxZoom: 2,
				animate: false
			});
		});
	});

	$effect(() => {
		const gps = navigation.gpsLocation;
		const request = navigation.currentLocationRequest;
		const segments = routeSegments;
		const floors = { ...view.activeFloors };
		const ready = svgLayersReady;
		const canCenter =
			bottomSheetSnap !== 'top' && bottomSheetSnap === settledSheetSnap && mapZoom !== null;
		const height = bottomSheetHeight;
		const follow = followArmed;
		untrack(() => {
			if (!ready) return;
			if (request !== appliedCurrentLocationRequest) {
				appliedCurrentLocationRequest = request;
				followArmed = true;
				pendingLocationFocus = true;
			}
			const position = gps.enabled ? gps.position : null;
			locationLayer?.update(position);
			if (!gps.enabled) pendingLocationFocus = false;
			if (!position || !canCenter) return;
			if (pendingLocationFocus) {
				pendingLocationFocus = false;
				pendingRouteFocus = false;
				centerOnCurrentPosition(position, height, 2);
			} else if (
				follow &&
				isPositionOnRoute(position, segments, floors, navigation.gps.routeTolerance)
			) {
				// 全体表示の縮尺ではmaxBoundsが中央移動を制限するため、追従開始時に拡大します。
				centerOnCurrentPosition(position, height, pendingRouteFocus ? 2 : map!.getZoom());
				pendingRouteFocus = false;
			}
		});
	});

	function renderNavigation(
		path = navigation.routePath,
		highlights = navigation.highlights,
		markerIds: readonly string[] | null = navigation.facilitySearch
			? navigation.facilityResults.map(({ id }) => id)
			: null
	) {
		if (!svgLayersReady || disposed) return;
		const routeChanged = path !== renderedRoute;
		let routeStart: Node | undefined;
		if (routeChanged) {
			renderedRoute = path;
			followArmed = !!path && path !== interactedRoute;
			pendingRouteFocus = !!path;
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
			const gps = navigation.gpsLocation;
			const onRoute =
				gps.enabled &&
				gps.position &&
				isPositionOnRoute(
					gps.position,
					routeSegments,
					view.activeFloors,
					navigation.gps.routeTolerance
				);
			if (routeStart && !onRoute) {
				// GPSの初回位置と出発地への飛行を競合させず、経路の表示後に追従へ渡します。
				routeLayer!.fitFloor(routeStart.floor, !(gps.enabled || navigation.gps.requesting));
			}
		}
		renderedHighlights = highlights;
		poiLayer!.render(highlights);
		markerLayer!.render(highlights, markerIds);
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
	function updateMapState(event: L.LeafletEvent | undefined = undefined) {
		if (disposed || !svgLayersReady || adjustingSheet) return;
		if (!event || event.type === 'resize') {
			// 各段の入力・オプションを、文字サイズに合わせて収めます。
			rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
		}
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

	function centerOnCurrentPosition(
		position: MapPosition,
		sheetHeight: number,
		zoom = map!.getZoom()
	) {
		if (!map) return;
		const snap = map.options.zoomSnap || 1;
		const targetZoom = Math.max(
			map.getMinZoom(),
			Math.min(map.getMaxZoom(), Math.round(zoom / snap) * snap)
		);
		const center = map.project([position.y, position.x], targetZoom).add([0, sheetHeight / 2]);
		map.stop();
		map.setView(map.unproject(center, targetZoom), targetZoom, { animate: false });
	}

	function stopFollowing() {
		followArmed = false;
		pendingLocationFocus = false;
		pendingRouteFocus = false;
		appliedCurrentLocationRequest = navigation.currentLocationRequest;
		interactedRoute = navigation.routePath;
		appliedFocusRequest = navigation.focusRequest;
		appliedFacilitySearch = navigation.facilitySearch;
		map?.stop();
		if (!mapContainer.querySelector('.leaflet-zoom-anim')) recordZoomEnd();
	}
	function recordZoomStart() {
		mapZoom = null;
	}
	function recordZoomEnd() {
		mapZoom = map?.getZoom() ?? null;
	}

	function observeUserInteraction(element: HTMLElement) {
		const onInteraction = (event: Event) => {
			if (event.target instanceof Element && event.target.closest('dialog')) return;
			stopFollowing();
		};
		const onKey = (event: KeyboardEvent) => {
			if (
				['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', '+', '-', '=', 'Enter', ' '].includes(
					event.key
				)
			)
				onInteraction(event);
		};
		element.addEventListener('pointerdown', onInteraction, true);
		element.addEventListener('wheel', onInteraction, { capture: true, passive: true });
		element.addEventListener('keydown', onKey, true);
		return {
			destroy() {
				element.removeEventListener('pointerdown', onInteraction, true);
				element.removeEventListener('wheel', onInteraction, true);
				element.removeEventListener('keydown', onKey, true);
			}
		};
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
				mountedMap.attributionControl.setPosition('bottomleft');
				mountedMap.attributionControl.addAttribution(
					`位置補正基準点：<a href="${geolocationReferenceSource.url}" target="_blank" rel="external noopener noreferrer">地理院地図</a>を加工`
				);
				for (const [name, zIndex] of [
					['floor-maps', 420],
					['route-lines', 430],
					['current-location', 640]
				] as const) {
					mountedMap.createPane(name).style.zIndex = String(zIndex);
				}
				mountedMap.getPane('current-location')!.style.pointerEvents = 'none';
				locationLayer = createLocationLayer(leaflet, mountedMap);
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
				mountedMap.on('dragstart', stopFollowing);
				mountedMap.on('zoomstart', recordZoomStart);
				mountedMap.on('zoomend', recordZoomEnd);
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
			navigation.gps.stop();
			svgLayersReady = false;
			if (buildingControlFrame !== undefined) cancelAnimationFrame(buildingControlFrame);
			if (routeLabelFrame !== undefined) cancelAnimationFrame(routeLabelFrame);
			map?.off('move zoom resize zoomend moveend', updateMapState);
			map?.off('click', onMapClick);
			map?.off('dragstart', stopFollowing);
			map?.off('zoomstart', recordZoomStart);
			map?.off('zoomend', recordZoomEnd);
			map?.off('move zoom resize tooltipopen tooltipclose', scheduleRouteLabels);
			poiLayer?.dispose();
			markerLayer?.dispose();
			locationLayer?.dispose();
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
	use:observeUserInteraction
	class={[
		'map-wrapper relative isolate h-dvh w-full overflow-hidden [&_.leaflet-bottom]:bottom-(--bottom-sheet-height)! [&_.leaflet-control-attribution]:ml-2!',
		bottomSheetSnap === 'top' && 'sheet-expanded'
	]}
	style:--bottom-sheet-height={`${bottomSheetHeight}px`}
>
	<div bind:this={mapContainer} class="map-container z-1 h-full w-full bg-[#898989]!"></div>
	{#if bottomSheetSnap !== 'top'}
		<p
			class="pointer-events-none absolute top-2.5 right-2.5 left-14 z-1000 rounded border-2 border-yellow-400/90 bg-yellow-500/40 p-1 text-sm text-white"
		>
			{projectDisclaimer}
		</p>
		<div
			class="pointer-events-none absolute right-2 z-1000 flex max-w-[calc(100%-1rem)] items-center gap-2"
			style:bottom={`calc(${bottomSheetHeight}px + ${showLocationHint ? '2rem' : '0.5rem'})`}
		>
			{#if showLocationHint}
				<p
					id={locationHintId}
					class="max-w-44 rounded-lg bg-white/95 px-3 py-2 text-xs leading-5 text-slate-600 shadow-sm"
				>
					<span class="block"
						>{navigation.gps.error
							? '現在地を取得できません。'
							: navigation.gpsLocation.enabled
								? '位置情報を取得中です。'
								: '位置情報の利用を確認中です。'}</span
					>
					<span class="block">停止は下のシートからできます。</span>
				</p>
			{/if}
			<button
				type="button"
				class="current-location-button pointer-events-auto flex size-11 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white text-blue-700 shadow-md hover:bg-blue-50 disabled:cursor-not-allowed disabled:text-slate-400"
				aria-label="現在地に移動"
				aria-describedby={showLocationHint ? locationHintId : undefined}
				aria-pressed={followArmed && !!navigation.routePath && navigation.gpsLocation.enabled}
				aria-busy={navigation.gpsLocation.enabled && !navigation.gpsLocation.position}
				title={navigation.gpsLocation.enabled
					? navigation.gpsLocation.position
						? '現在地に移動'
						: '現在地を取得中です'
					: '現在地に移動'}
				disabled={navigation.gpsLocation.enabled && !navigation.gpsLocation.position}
				onclick={() => navigation.requestCurrentLocation()}
			>
				<svg
					aria-hidden="true"
					class="size-6"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
				>
					<circle cx="12" cy="12" r="7" />
					<circle cx="12" cy="12" r="2" />
					<path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
				</svg>
			</button>
		</div>
	{/if}
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
		{peekHeight}
		{middleMinHeight}
		contentMinHeight={sheetContentMinHeight}
		onheightchange={(height) => (bottomSheetHeight = height)}
		onsettle={(snap, height) => {
			bottomSheetHeight = height;
			settledSheetSnap = snap;
		}}
	>
		<div class={bottomSheetSnap === 'top' ? 'flex min-h-full flex-col' : undefined}>
			<RouteSearchPanel
				{navigation}
				bind:snap={bottomSheetSnap}
				bind:contentMinHeight={sheetContentMinHeight}
			/>
			{#if bottomSheetSnap === 'top'}
				<footer class="mx-auto mt-auto w-full max-w-2xl">
					<p class="rounded border-2 border-yellow-500/80 bg-yellow-500/40 p-1 text-sm text-gray-800">
						{projectDisclaimer}
					</p>
					<a href="https://fes2026.omuct-gakuyukai.com/" target="_blank" rel="noopener noreferrer" class="border-b">
						第62回高専祭特設サイト(別タブ)
					</a>
				</footer>
			{/if}
		</div>
	</BottomSheet>
</div>

<style>
	.sheet-expanded :global(.leaflet-control) {
		visibility: hidden;
		pointer-events: none;
	}
</style>
