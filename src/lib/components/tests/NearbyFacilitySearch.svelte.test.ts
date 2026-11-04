import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import RouteSearchPanel from '../layout/RouteSearchPanel.svelte';
import { createFacilityNavigation } from './facilityTestData';
import { LOCATION_CONSENT_KEY } from '../../states/geolocation.svelte';

beforeEach(() => localStorage.removeItem(LOCATION_CONSENT_KEY));
afterEach(() => localStorage.removeItem(LOCATION_CONSENT_KEY));

describe('nearby facility search UI', () => {
	it('通常版には施設ボタンを出さず、中段・上段のオプション内にバリアフリーを表示する', async () => {
		const navigation = createFacilityNavigation('normal');
		const { container, getByRole, rerender } = await render(RouteSearchPanel, {
			navigation,
			snap: 'bottom'
		});
		expect(container.querySelector('[role="switch"]')).toBeNull();
		await rerender({ navigation, snap: 'middle' });
		const options = container.querySelector('details')!;
		expect(options.open).toBe(false);
		expect(options.getBoundingClientRect().top).toBeGreaterThanOrEqual(
			container.querySelector('button[type="submit"]')!.getBoundingClientRect().bottom
		);
		container.querySelector('summary')!.click();
		await getByRole('switch', { name: 'バリアフリー' }).click();
		expect(navigation.barrierFree).toBe(true);
		expect(container.textContent).not.toContain('近くのトイレを表示');
		expect(container.textContent).not.toContain('近くのゴミ箱を表示');
		await rerender({ navigation, snap: 'top' });
		await getByRole('switch', { name: 'バリアフリー' }).click();
		expect(navigation.barrierFree).toBe(false);
	});

	it('高専祭版は下段から施設ボタンを表示し、バリアフリーをオプションへ分ける', async () => {
		const navigation = createFacilityNavigation();
		const { container, getByRole, rerender } = await render(RouteSearchPanel, {
			navigation,
			snap: 'bottom'
		});
		const options = () => container.querySelector('[aria-label="検索オプション"]')!;
		expect(options().querySelector('[role="switch"]')).toBeNull();
		expect(options().querySelector('[aria-label="近くのトイレを表示"]')).not.toBeNull();
		expect(options().querySelector('[aria-label="近くのゴミ箱を表示"]')).not.toBeNull();
		await rerender({ navigation, snap: 'middle' });
		expect(options().querySelector('[role="switch"]')).toBeNull();
		expect(options().querySelectorAll('button')).toHaveLength(2);
		container.querySelector('summary')!.click();
		await getByRole('switch', { name: 'バリアフリー' }).click();
		expect(navigation.barrierFree).toBe(true);
		await rerender({ navigation, snap: 'top' });
		expect(container.querySelector('[aria-label="検索オプション"]')).toBeNull();
	});

	it('GPSオフでは建物を選択し、女子トイレに絞って施設情報を開ける', async () => {
		const navigation = createFacilityNavigation();
		const { container, getByRole, rerender } = await render(RouteSearchPanel, {
			navigation,
			snap: 'bottom'
		});
		await getByRole('button', { name: '近くのトイレを表示' }).click();
		await getByRole('button', { name: '使わない', exact: true }).click();
		await expect.poll(() => container.querySelector('[role="switch"]')).not.toBeNull();
		expect(container.querySelector('[aria-label="近くの施設の検索結果"]')).toBeNull();
		await getByRole('combobox', { name: '現在の建物' }).selectOptions('la');
		await expect
			.poll(() => container.querySelector('[aria-label="近くの施設の検索結果"]')?.textContent)
			.toContain('教養棟1階男子トイレ');
		await getByRole('combobox', { name: 'トイレの種類' }).selectOptions('women');
		expect(navigation.facilityResults.map(({ id }) => id)).toEqual(['women-la']);
		await rerender({ navigation, snap: 'bottom' });
		expect(container.querySelector('[aria-label="近くの施設を検索"]')).toBeNull();
		expect(container.querySelector('[aria-label="近くのトイレを表示"]')).not.toBeNull();
		await rerender({ navigation, snap: 'top' });
		expect(container.querySelector('[aria-label="近くの施設を検索"]')).not.toBeNull();
		expect(container.querySelector('[aria-label="近くのトイレを表示"]')).toBeNull();
		await getByRole('button', { name: /教養棟2階女子トイレ/ }).click();
		expect(navigation.selectedPoi?.id).toBe('women-la');
		expect(navigation.focusRequest).toEqual({ poiId: 'women-la', showFloor: true });
		expect(navigation.facilitySearch).toBeNull();
		await expect
			.poll(() => container.querySelector('[aria-label="選択した施設の情報"]')?.textContent)
			.toContain('教養棟 · 2階');
	});

	it('同じ建物のゴミ箱へ切り替え、該当なしと検索解除を表示する', async () => {
		const navigation = createFacilityNavigation();
		const { container, getByRole } = await render(RouteSearchPanel, { navigation, snap: 'middle' });
		await getByRole('button', { name: '近くのトイレを表示' }).click();
		await getByRole('button', { name: '使わない', exact: true }).click();
		await getByRole('combobox', { name: '現在の建物' }).selectOptions('la');
		await getByRole('button', { name: '近くのゴミ箱を表示' }).click();
		expect(navigation.facilityResults.map(({ id }) => id)).toEqual(['trash-la']);
		expect(container.querySelector('[id$="-type"]')).toBeNull();
		await getByRole('combobox', { name: '現在の建物' }).selectOptions('admin');
		await expect.poll(() => container.textContent).toContain('条件に合うゴミ箱がありません。');
		await getByRole('button', { name: '検索を閉じる' }).click();
		expect(container.querySelector('[aria-label="近くの施設を検索"]')).toBeNull();
	});

	it('GPS取得中は待機し、取得後は建物選択を出さず近い施設を表示する', async () => {
		const navigation = createFacilityNavigation();
		navigation.setGpsLocation({ enabled: true, position: null });
		const { container, getByRole } = await render(RouteSearchPanel, { navigation, snap: 'middle' });
		await getByRole('button', { name: '近くのトイレを表示' }).click();
		expect(container.textContent).toContain('現在地を取得中です。');
		expect(container.querySelector('[id$="-building"]')).toBeNull();
		navigation.setGpsLocation({ enabled: true, position: { x: 990, y: 800 } });
		await expect
			.poll(() => container.querySelector('ul li')?.textContent)
			.toContain('管理棟バリアフリートイレ');
		await getByRole('combobox', { name: 'トイレの種類' }).selectOptions('accessible');
		expect(navigation.facilityResults.map(({ id }) => id)).toEqual(['accessible-admin']);
		navigation.setGpsLocation({ enabled: false });
		await expect
			.poll(() => container.querySelector('[id$="-building"]')?.getAttribute('id'))
			.toBeDefined();
		expect(navigation.facilityResults).toEqual([]);
	});
});
