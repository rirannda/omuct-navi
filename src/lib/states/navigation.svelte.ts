import { aStar } from '../aStar/aStar';
import { buildGraph } from '../aStar/buildGraph';
import { nodes } from '../../data/nodes';
import { edges } from '../../data/edges';
import { edgeStairs } from '../../data/edge_stair';
import { pois } from '../../data/pois';
import { markers } from '../../data/markers';
import { mapDataConfig } from '../../data/config';
import { geolocationReferencePoints } from '../../data/geolocation';
import { buildingNames } from '../../data/buildings';
import type {
	Node,
	Poi,
	MapMarker,
	Destination,
	DestinationLocation,
	MapDataConfig,
	ToiletType,
	EnhancedEdge
} from '../../data/types';
import { getNodeBuildingId } from '../map/nodeBuilding';
import { findNearbyFacilities } from '../map/nearbyFacilities';
import type { FacilityCategory, FacilitySearch, GpsLocation } from '../map/nearbyFacilities';
import type { HighlightColor } from '../map/highlightColors';
import { highlightRoles } from '../map/highlightColors';
import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import { getContext, hasContext, setContext } from 'svelte';
import { createGeolocationProjection } from '../map/geolocationProjection';
import type { GeolocationReferencePoint } from '../map/geolocationProjection';
import { createGeolocationState } from './geolocation.svelte';

export type PoiHighlights = Readonly<Partial<Record<HighlightColor, string>>>;
export type NavigationData = {
	graph: { nodes: Node[]; edges: EnhancedEdge[] };
	pois: readonly Poi[];
	markers?: readonly MapMarker[];
	config?: MapDataConfig;
	geolocationReferencePoints?: readonly GeolocationReferencePoint[];
};

/** ページごとに生成する共有状態。描画先やカメラ位置には依存しません。 */
export function createNavigationState(data?: NavigationData) {
	const graph = data?.graph ?? buildGraph(nodes, edges, edgeStairs);
	const poiData = data?.pois ?? pois;
	const markerData = data ? (data.markers ?? []) : markers;
	const isFestival = (data?.config ?? mapDataConfig).mode === 'festival';
	const destinations: readonly Destination[] = [...poiData, ...markerData];
	const poiById = new SvelteMap<string, Destination>();
	for (const destination of destinations) {
		if (poiById.has(destination.id)) {
			throw new Error(
				`目的地IDが重複しています: ${destination.id}。マーカーへ移行した施設はpois.tsから削除してください。`
			);
		}
		poiById.set(destination.id, destination);
	}
	const nodeById = new SvelteMap(graph.nodes.map((node) => [node.id, node]));
	const validMarkers = markerData.filter(({ nodeId }) => nodeById.has(nodeId));
	const facilityBuildings = [
		...new SvelteSet([
			...Object.keys(buildingNames),
			...validMarkers.map(({ buildingId }) => buildingId)
		])
	].map((id) => ({ id, name: buildingNames[id] ?? id }));
	let gpsLocation = $state.raw<GpsLocation>({ enabled: false });
	let facilitySearch = $state.raw<FacilitySearch | null>(null);
	const facilityResults = $derived.by(() => {
		if (!facilitySearch) return [];
		if (gpsLocation.enabled) {
			return gpsLocation.position
				? findNearbyFacilities(validMarkers, facilitySearch, {
						kind: 'gps',
						...gpsLocation.position
					})
				: [];
		}
		return facilitySearch.buildingId
			? findNearbyFacilities(validMarkers, facilitySearch, {
					kind: 'building',
					buildingId: facilitySearch.buildingId
				})
			: [];
	});
	const defaultStart = poiById.get('poi_hr_2i');
	let highlights = $state.raw<PoiHighlights>(
		defaultStart && nodeById.has(defaultStart.nodeId) ? { start: defaultStart.id } : {}
	);
	let routePath = $state.raw<readonly string[] | null>(null);
	let focusRequest = $state.raw<{ poiId: string; showFloor: boolean } | null>(null);
	let barrierFree = $state(false);
	let routeError = $state<string | null>(null);
	let routeErrorVersion = $state(0);
	let routeRequest: { startId: string; goalId: string } | null = null;
	let currentLocationRequest = $state(0);
	const gps = createGeolocationState({
		projection: createGeolocationProjection(
			data?.geolocationReferencePoints ?? geolocationReferencePoints
		),
		onLocation: setGpsLocation,
		contains: ({ x, y }) => x >= 0 && x <= 1400 && y >= 0 && y <= 1700
	});

	/** 校内図に変換済みの位置のみ受け取ります。nullは取得中です。 */
	function setGpsLocation(next: GpsLocation): boolean {
		if (
			next.enabled &&
			next.position &&
			(!Number.isFinite(next.position.x) || !Number.isFinite(next.position.y))
		)
			return false;
		if (next.enabled !== gpsLocation.enabled && facilitySearch) {
			facilitySearch = { ...facilitySearch, buildingId: undefined };
		}
		gpsLocation = next.enabled
			? { enabled: true, position: next.position ? { ...next.position } : null }
			: { enabled: false };
		return true;
	}

	/** 既存のAPI名を維持し、部屋のPOIとマーカーを共通の選択対象として解決します。 */
	function resolvePoi(
		poiId: string
	): { poi: Destination; node: Node; location: DestinationLocation } | undefined {
		const poi = poiById.get(poiId);
		const node = poi ? nodeById.get(poi.nodeId) : undefined;
		if (!poi || !node) return;
		const location =
			'svgId' in poi
				? { x: node.x, y: node.y, floor: node.floor, buildingId: getNodeBuildingId(node) }
				: { x: poi.x, y: poi.y, floor: poi.floor, buildingId: poi.buildingId };
		return { poi, node, location };
	}

	function setHighlight(poiId: string, role: HighlightColor = 'selected'): boolean {
		if (!highlightRoles.includes(role) || !resolvePoi(poiId)) return false;
		if (highlights[role] !== poiId) highlights = { ...highlights, [role]: poiId };
		return true;
	}

	function clearHighlight(role?: HighlightColor): void {
		if (role !== undefined && !highlightRoles.includes(role)) return;
		if (!role) {
			highlights = {};
		} else if (highlights[role] !== undefined) {
			const next = { ...highlights };
			delete next[role];
			highlights = next;
		}
	}

	function showRoute(startId: string, goalId: string): string[] | null {
		routeRequest = { startId, goalId };
		const path = aStar(graph, startId, goalId, { avoidStairs: barrierFree });
		routePath = path ? [...path] : null;
		routeError = path
			? null
			: barrierFree
				? '階段を使わない経路が見つかりません。条件を変更してください。'
				: '選択した場所を結ぶ経路が見つかりません。';
		if (!path) {
			routeErrorVersion += 1;
			console.error(`経路が見つかりません: ${startId} -> ${goalId}`);
		}
		return path;
	}

	return {
		graph,
		isFestival,
		facilityBuildings,
		pois: poiData,
		markers: markerData,
		destinations,
		gps,
		setGpsLocation,
		async requestGps() {
			return gpsLocation.enabled || (await gps.request());
		},
		async requestCurrentLocation() {
			if (gpsLocation.enabled || (await gps.request({ retryDeclined: true })))
				currentLocationRequest++;
		},
		requestGpsForRoute() {
			if (!gpsLocation.enabled) void gps.request();
		},
		get currentLocationRequest() {
			return currentLocationRequest;
		},
		resolvePoi,
		setHighlight,
		clearHighlight,
		searchFacilities: (category: FacilityCategory, toiletType?: ToiletType) => {
			if (!isFestival) return false;
			facilitySearch = {
				category,
				toiletType: category === 'toilet' ? toiletType : undefined,
				buildingId: facilitySearch?.buildingId
			};
			clearHighlight('selected');
			return true;
		},
		setFacilityBuilding: (buildingId: string) => {
			if (!facilitySearch || gpsLocation.enabled) return false;
			if (buildingId && !facilityBuildings.some(({ id }) => id === buildingId)) return false;
			facilitySearch = { ...facilitySearch, buildingId: buildingId || undefined };
			return true;
		},
		clearFacilitySearch: () => {
			if (facilitySearch && !routePath) gps.stop();
			facilitySearch = null;
		},
		showRoute,
		setBarrierFree: (enabled: boolean) => {
			if (barrierFree === enabled) return;
			barrierFree = enabled;
			if (routeRequest) showRoute(routeRequest.startId, routeRequest.goalId);
		},
		/** POIへの移動と、必要に応じて階別表示を依頼します。同じPOIでも再実行します。 */
		requestFocus: (poiId: string, options: { showFloor?: boolean } = {}) => {
			focusRequest = { poiId, showFloor: options.showFloor ?? false };
		},
		clearRoute: () => {
			if (routePath && !facilitySearch) gps.stop();
			routePath = null;
			routeRequest = null;
			routeError = null;
		},
		get barrierFree() {
			return barrierFree;
		},
		get gpsLocation() {
			return gpsLocation;
		},
		get facilitySearch() {
			return facilitySearch;
		},
		get facilityResults() {
			return facilityResults;
		},
		get routeError() {
			return routeError;
		},
		get routeErrorVersion() {
			return routeErrorVersion;
		},
		get highlights() {
			return highlights;
		},
		get focusRequest() {
			return focusRequest;
		},
		get routePath() {
			return routePath;
		},
		get selectedPoi() {
			return highlights.selected ? (poiById.get(highlights.selected) ?? null) : null;
		}
	};
}

export type NavigationState = ReturnType<typeof createNavigationState>;

const navigationKey = Symbol('navigation');

/** ページ配下のコンポーネントがpropsなしで共有できるよう、状態をcontextへ登録します。 */
export function provideNavigation(navigation = createNavigationState()): NavigationState {
	setContext(navigationKey, navigation);
	return navigation;
}

export function getNavigation(): NavigationState | undefined {
	return hasContext(navigationKey) ? getContext<NavigationState>(navigationKey) : undefined;
}

export function requireNavigation(): NavigationState {
	const navigation = getNavigation();
	if (!navigation) throw new Error('provideNavigation()で共有状態を登録してください');
	return navigation;
}
