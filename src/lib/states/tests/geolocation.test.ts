import { describe, expect, it, vi } from 'vitest';
import { createGeolocationState, LOCATION_CONSENT_KEY } from '../geolocation.svelte';
import { createGeolocationProjection } from '../../map/geolocationProjection';
import type { GeolocationEnvironment } from '../geolocation.svelte';

function setup(saved?: string, permission: PermissionState = 'granted') {
	let onSuccess!: PositionCallback;
	let onError!: PositionErrorCallback;
	const storage = new Map(saved ? [[LOCATION_CONSENT_KEY, saved]] : []);
	const environment: GeolocationEnvironment = {
		secure: true,
		geolocation: {
			watchPosition: vi.fn((success, error) => {
				onSuccess = success;
				onError = error!;
				return 7;
			}),
			clearWatch: vi.fn()
		},
		permissions: {
			query: vi.fn<Permissions['query']>(async () => ({ state: permission }) as PermissionStatus)
		},
		storage: {
			getItem: (key) => storage.get(key) ?? null,
			setItem: (key, value) => {
				storage.set(key, value);
			}
		}
	};
	const onLocation = vi.fn();
	const projection = createGeolocationProjection([
		{ latitude: 35, longitude: 135, x: 400, y: 500 },
		{ latitude: 35, longitude: 135.001, x: 500, y: 500 },
		{ latitude: 35.001, longitude: 135, x: 400, y: 600 }
	])!;
	const options = {
		projection,
		onLocation,
		contains: ({ x, y }: { x: number; y: number }) => x >= 0 && x <= 1400 && y >= 0 && y <= 1700,
		getEnvironment: () => environment
	};
	const gps = createGeolocationState(options);
	return {
		gps,
		environment,
		options,
		storage,
		onLocation,
		position(overrides: Partial<GeolocationCoordinates> = {}, timestamp = Date.now()) {
			onSuccess({
				coords: { latitude: 35, longitude: 135, accuracy: 5, ...overrides },
				timestamp
			} as GeolocationPosition);
		},
		error(code: number) {
			onError({ code } as GeolocationPositionError);
		}
	};
}

describe('geolocation state', () => {
	it('初回確認前は取得せず、確認を共有して同意後に一つだけ監視を開始する', async () => {
		const { gps, environment, onLocation, storage, position } = setup();
		const first = gps.request();
		expect(gps.request()).toBe(first);
		expect(gps.consentOpen).toBe(true);
		expect(environment.geolocation!.watchPosition).not.toHaveBeenCalled();
		gps.confirmConsent(true);
		expect(await first).toBe(true);
		position();
		expect(onLocation.mock.lastCall![0].position).toMatchObject({ x: 400, y: 500 });
		expect([...storage.entries()]).toEqual([[LOCATION_CONSENT_KEY, 'accepted']]);
		await gps.request();
		expect(environment.geolocation!.watchPosition).toHaveBeenCalledTimes(1);
		gps.stop();
		expect(environment.geolocation!.clearWatch).toHaveBeenCalledWith(7);
	});
	it('明示停止は位置を破棄し、画面を開き直しても現在地ボタンで選び直すまで再開しない', async () => {
		const { gps, environment, options, onLocation, storage, position } = setup('accepted');
		await gps.request();
		position();
		gps.disable();
		expect(gps.active).toBe(false);
		expect(environment.geolocation!.clearWatch).toHaveBeenCalledWith(7);
		expect(storage.get(LOCATION_CONSENT_KEY)).toBe('declined');
		position();
		expect(onLocation.mock.lastCall![0]).toEqual({ enabled: false });
		expect(await gps.request()).toBe(false);
		const reopened = createGeolocationState(options);
		expect(await reopened.request()).toBe(false);
		expect(reopened.consentOpen).toBe(false);
		expect(environment.geolocation!.watchPosition).toHaveBeenCalledTimes(1);
		const retry = reopened.request({ retryDeclined: true });
		expect(reopened.consentOpen).toBe(true);
		expect(environment.geolocation!.watchPosition).toHaveBeenCalledTimes(1);
		reopened.confirmConsent(true);
		expect(await retry).toBe(true);
		expect(storage.get(LOCATION_CONSENT_KEY)).toBe('accepted');
		expect(environment.geolocation!.watchPosition).toHaveBeenCalledTimes(2);
		reopened.stop();
	});
	it('自動停止では同意を維持し、次の検索から再開できる', async () => {
		const { gps, environment, storage } = setup('accepted');
		await gps.request();
		gps.stop();
		expect(storage.get(LOCATION_CONSENT_KEY)).toBe('accepted');
		expect(gps.hasConsent()).toBe(true);
		expect(await gps.request()).toBe(true);
		expect(gps.consentOpen).toBe(false);
		expect(environment.geolocation!.watchPosition).toHaveBeenCalledTimes(2);
		gps.stop();
	});
	it('許可状態の照会中に明示停止すると、遅れて許可済みと分かっても測位しない', async () => {
		const { gps, environment } = setup('accepted');
		let resolvePermission!: (status: PermissionStatus) => void;
		const permission = new Promise<PermissionStatus>((resolve) => (resolvePermission = resolve));
		environment.permissions!.query = vi.fn<Permissions['query']>().mockReturnValue(permission);
		const request = gps.request();
		gps.disable();
		expect(await request).toBe(false);
		resolvePermission({ state: 'granted' } as PermissionStatus);
		await permission;
		expect(gps.requesting).toBe(false);
		expect(gps.consentOpen).toBe(false);
		expect(await gps.request()).toBe(false);
		expect(environment.geolocation!.watchPosition).not.toHaveBeenCalled();
	});
	it.each(['unavailable', 'write-failed'] as const)(
		'選択結果を保存できなくても明示停止後は同じ画面で再開しない (%s)',
		async (storageState) => {
			const { gps, environment } = setup('accepted');
			await gps.request();
			if (storageState === 'unavailable') environment.storage = undefined;
			else
				environment.storage!.setItem = () => {
					throw new Error('storage unavailable');
				};
			gps.disable();
			expect(gps.hasConsent()).toBe(false);
			expect(await gps.request()).toBe(false);
			expect(gps.consentOpen).toBe(false);
			expect(environment.geolocation!.watchPosition).toHaveBeenCalledTimes(1);
		}
	);
	it('拒否や確認中の破棄では測位せず、確認済みなら再表示せず取得する', async () => {
		const { gps, environment, storage } = setup();
		const first = gps.request();
		gps.confirmConsent(false);
		expect(await first).toBe(false);
		expect(storage.get(LOCATION_CONSENT_KEY)).toBe('declined');
		expect(environment.geolocation!.watchPosition).not.toHaveBeenCalled();
		expect(await gps.request()).toBe(false);
		expect(gps.consentOpen).toBe(false);
		const second = gps.request({ retryDeclined: true });
		gps.stop();
		expect(await second).toBe(false);
		const saved = setup('accepted');
		expect(await saved.gps.request()).toBe(true);
		expect(saved.environment.permissions!.query).toHaveBeenCalledWith({ name: 'geolocation' });
		expect(saved.gps.consentOpen).toBe(false);
		saved.gps.stop();
	});
	it.each(['prompt', 'denied', 'unsupported', 'failed'] as const)(
		'保存済みの同意があってもブラウザの許可が確定していなければアプリで先に確認する (%s)',
		async (permission) => {
			const { gps, environment } = setup('accepted', 'prompt');
			if (permission === 'unsupported') environment.permissions = undefined;
			else
				environment.permissions!.query = vi.fn<Permissions['query']>(async () => {
					if (permission === 'failed') throw new Error('query unsupported');
					return { state: permission } as PermissionStatus;
				});
			const request = gps.request();
			expect(gps.request()).toBe(request);
			expect(gps.requesting).toBe(true);
			await vi.waitFor(() => expect(gps.consentOpen).toBe(true));
			expect(environment.geolocation!.watchPosition).not.toHaveBeenCalled();
			gps.confirmConsent(true);
			expect(await request).toBe(true);
			expect(environment.geolocation!.watchPosition).toHaveBeenCalledTimes(1);
			expect(gps.requesting).toBe(false);
			gps.stop();
		}
	);
	it('許可状態の確認中に停止した場合、遅い結果で新しい確認や測位を進めない', async () => {
		const { gps, environment } = setup('accepted');
		let resolvePermission!: (status: PermissionStatus) => void;
		const firstPermission = new Promise<PermissionStatus>((resolve) => {
			resolvePermission = resolve;
		});
		environment.permissions!.query = vi
			.fn<Permissions['query']>()
			.mockReturnValueOnce(firstPermission)
			.mockResolvedValue({ state: 'prompt' } as PermissionStatus);
		const first = gps.request();
		gps.stop();
		expect(await first).toBe(false);
		const second = gps.request();
		await vi.waitFor(() => expect(gps.consentOpen).toBe(true));
		resolvePermission({ state: 'granted' } as PermissionStatus);
		await firstPermission;
		expect(gps.consentOpen).toBe(true);
		expect(environment.geolocation!.watchPosition).not.toHaveBeenCalled();
		gps.stop();
		expect(await second).toBe(false);
		expect(gps.requesting).toBe(false);
	});
	it.each([1, 2, 3])('ブラウザのエラー%dで停止し、遅い更新を受け付けない', async (code) => {
		const { gps, onLocation, position, error } = setup('accepted');
		await gps.request();
		error(code);
		expect(gps.error).not.toBeNull();
		expect(gps.active).toBe(false);
		position();
		expect(onLocation.mock.lastCall![0]).toEqual({ enabled: false });
	});
	it.each(['outside', 'stale'] as const)('範囲外・古い位置を表示に流さない (%s)', async (kind) => {
		const { gps, position, onLocation } = setup('accepted');
		await gps.request();
		position(
			kind === 'outside' ? { latitude: 36 } : {},
			kind === 'stale' ? Date.now() - 60000 : Date.now()
		);
		expect(gps.active).toBe(false);
		expect(gps.error).not.toBeNull();
		expect(onLocation.mock.lastCall![0]).toEqual({ enabled: false });
	});
	it('初回の粗い位置は精度改善を待ち、改善したら使い、改善しなければ停止する', async () => {
		vi.useFakeTimers();
		try {
			const { gps, position, onLocation } = setup('accepted');
			await gps.request();
			position({ accuracy: 1000 });
			expect(gps.active).toBe(true);
			expect(onLocation.mock.lastCall![0]).toEqual({ enabled: true, position: null });
			position({ accuracy: 3 });
			await vi.advanceTimersByTimeAsync(16000);
			expect(gps.active).toBe(true);
			expect(gps.error).toBeNull();
			expect(onLocation.mock.lastCall![0].position).toMatchObject({ x: 400, y: 500 });
			position({ accuracy: 100 });
			await vi.advanceTimersByTimeAsync(15000);
			expect(gps.active).toBe(false);
			expect(gps.error).toContain('精度が十分ではありません');
		} finally {
			vi.useRealTimers();
		}
	});
	it('基準点がない場合に仮の現在地を生成せず、非HTTPS・非対応も明示する', async () => {
		const { environment, options } = setup('accepted');
		const gps = createGeolocationState({ ...options, projection: null });
		expect(await gps.request()).toBe(false);
		expect(gps.error).toContain('準備中');
		expect(environment.geolocation!.watchPosition).not.toHaveBeenCalled();
		environment.secure = false;
		const insecure = createGeolocationState(options);
		expect(await insecure.request()).toBe(false);
		expect(insecure.error).toContain('HTTPS');
		environment.secure = true;
		environment.geolocation = undefined;
		const unsupported = createGeolocationState(options);
		expect(await unsupported.request()).toBe(false);
		expect(unsupported.error).toContain('このブラウザ');
	});
	it('ストレージを使えなくてもページ内の選択を保持し、二度目の確認を出さない', async () => {
		const { environment, options } = setup();
		environment.storage = {
			getItem() {
				throw new Error('storage blocked');
			},
			setItem() {
				throw new Error('storage blocked');
			}
		};
		const gps = createGeolocationState(options);
		const first = gps.request();
		gps.confirmConsent(true);
		expect(await first).toBe(true);
		gps.stop();
		expect(await gps.request()).toBe(true);
		expect(gps.consentOpen).toBe(false);
		gps.stop();
	});
});
