import type { GeolocationProjection } from '../map/geolocationProjection';
import type { GpsLocation } from '../map/nearbyFacilities';

export const LOCATION_CONSENT_KEY = 'omuct-navi.location-consent.v1';
export const MAX_LOCATION_ACCURACY_METERS = 50;
export const ROUTE_FOLLOW_TOLERANCE_METERS = 10;

export type GeolocationEnvironment = {
	secure: boolean;
	geolocation?: Pick<Geolocation, 'watchPosition' | 'clearWatch'>;
	permissions?: Pick<Permissions, 'query'>;
	storage?: Pick<Storage, 'getItem' | 'setItem'>;
};

function browserEnvironment(): GeolocationEnvironment {
	let storage: Storage | undefined;
	try {
		storage = window.localStorage;
	} catch {
		// 保存できないブラウザでは、この画面を開いている間だけ確認済みとします。
	}
	return {
		secure: typeof window !== 'undefined' && window.isSecureContext,
		geolocation: typeof navigator !== 'undefined' ? navigator.geolocation : undefined,
		permissions: typeof navigator !== 'undefined' ? navigator.permissions : undefined,
		storage
	};
}

/** 測位と初回確認だけを所有します。位置の永続化や通信、Leafletへの依存はありません。 */
export function createGeolocationState({
	projection,
	onLocation,
	contains,
	getEnvironment = browserEnvironment
}: {
	projection: GeolocationProjection | null;
	onLocation: (location: GpsLocation) => void;
	contains: (position: { x: number; y: number }) => boolean;
	getEnvironment?: () => GeolocationEnvironment;
}) {
	let consentOpen = $state(false);
	let requesting = $state(false);
	let decision: 'accepted' | 'declined' | undefined;
	let active = $state(false);
	let error = $state<string | null>(null);
	let watch: {
		id: number;
		geolocation: NonNullable<GeolocationEnvironment['geolocation']>;
	} | null = null;
	let generation = 0;
	let pending: Promise<boolean> | null = null;
	let finishPending: ((accepted: boolean) => void) | undefined;
	let accuracyWaitTimer: ReturnType<typeof setTimeout> | undefined;

	function clearAccuracyWait() {
		if (accuracyWaitTimer !== undefined) clearTimeout(accuracyWaitTimer);
		accuracyWaitTimer = undefined;
	}

	function readDecision() {
		if (decision) return decision;
		try {
			const saved = getEnvironment().storage?.getItem(LOCATION_CONSENT_KEY);
			if (saved === 'accepted' || saved === 'declined') decision = saved;
		} catch {
			// ストレージへのアクセス制限は測位自体を妨げません。
		}
		return decision;
	}
	const hasConsent = () => readDecision() === 'accepted';

	function stop() {
		generation++;
		clearAccuracyWait();
		if (watch) watch.geolocation.clearWatch(watch.id);
		watch = null;
		active = false;
		consentOpen = false;
		requesting = false;
		finishPending?.(false);
		finishPending = undefined;
		pending = null;
		error = null;
		onLocation({ enabled: false });
	}

	function fail(message: string) {
		stop();
		error = message;
	}

	function start(): boolean {
		if (active) return true;
		const environment = getEnvironment();
		if (!environment.secure) {
			fail('位置情報を使うには、HTTPSでこのサイトを開いてください。');
			return false;
		}
		const geolocation = environment.geolocation;
		if (!geolocation) {
			fail('このブラウザでは位置情報を利用できません。場所を手動で選択してください。');
			return false;
		}
		if (!projection) {
			fail('現在地表示は準備中です。場所を手動で選択してください。');
			return false;
		}
		error = null;
		active = true;
		onLocation({ enabled: true, position: null });
		const current = ++generation;
		try {
			const id = geolocation.watchPosition(
				({ coords, timestamp }) => {
					if (current !== generation) return;
					if (!Number.isFinite(timestamp) || Date.now() - timestamp > 30000) {
						fail('現在地を更新できませんでした。時間をおいて再度お試しください。');
						return;
					}
					if (!Number.isFinite(coords.accuracy) || coords.accuracy > MAX_LOCATION_ACCURACY_METERS) {
						// 最初の粗い位置で停止せず、GPSの精度改善を待ちます。
						error = '現在地の精度の改善を待っています。屋外でお試しください。';
						onLocation({ enabled: true, position: null });
						if (accuracyWaitTimer === undefined) {
							accuracyWaitTimer = setTimeout(() => {
								if (current === generation) {
									fail(
										'現在地の精度が十分ではありません。屋外で再度試すか、場所を手動で選択してください。'
									);
								}
							}, 15000);
						}
						return;
					}
					const position = projection.project(coords, coords.accuracy);
					if (!position) {
						fail('現在地を取得できませんでした。場所を手動で選択してください。');
						return;
					}
					if (!contains(position)) {
						fail('現在地が校内地図の範囲外です。場所を手動で選択してください。');
						return;
					}
					clearAccuracyWait();
					error = null;
					onLocation({ enabled: true, position });
				},
				({ code }) => {
					if (current !== generation) return;
					fail(
						code === 1
							? '位置情報が許可されていません。ブラウザのサイト設定で許可するか、場所を手動で選択してください。'
							: code === 3
								? '現在地の取得に時間がかかっています。時間をおいて再度お試しください。'
								: '現在地を取得できませんでした。端末の位置情報の設定を確認してください。'
					);
				},
				{ enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
			);
			if (current === generation) watch = { id, geolocation };
			else geolocation.clearWatch(id);
			return current === generation;
		} catch {
			fail('現在地を取得できませんでした。場所を手動で選択してください。');
			return false;
		}
	}

	function finishRequest(allow: boolean) {
		const finish = finishPending;
		finishPending = undefined;
		pending = null;
		requesting = false;
		finish?.(allow && start());
	}

	async function checkBrowserPermission(current: number) {
		let permission: PermissionState | undefined;
		try {
			permission = (await getEnvironment().permissions?.query({ name: 'geolocation' }))?.state;
		} catch {
			// 許可状態を確認できない場合も、測位APIより先にアプリの確認を出します。
		}
		if (current !== generation || !pending) return;
		if (permission === 'granted') finishRequest(true);
		else consentOpen = true;
	}

	return {
		request({ retryDeclined = false }: { retryDeclined?: boolean } = {}): Promise<boolean> {
			if (pending) return pending;
			if (active) return Promise.resolve(true);
			if (readDecision() === 'declined' && !retryDeclined) return Promise.resolve(false);
			error = null;
			requesting = true;
			pending = new Promise((resolve) => (finishPending = resolve));
			if (hasConsent()) void checkBrowserPermission(generation);
			else consentOpen = true;
			return pending;
		},
		confirmConsent(allow: boolean) {
			if (!consentOpen) return;
			consentOpen = false;
			decision = allow ? 'accepted' : 'declined';
			try {
				getEnvironment().storage?.setItem(LOCATION_CONSENT_KEY, decision);
			} catch {
				// 利用するかの選択結果以外は保存しません。
			}
			finishRequest(allow);
		},
		hasConsent,
		stop,
		get consentOpen() {
			return consentOpen;
		},
		get requesting() {
			return requesting;
		},
		get active() {
			return active;
		},
		get error() {
			return error;
		},
		get routeTolerance() {
			return projection ? projection.unitsPerMeter * ROUTE_FOLLOW_TOLERANCE_METERS : 20;
		}
	};
}
