import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import TestButton from '../TestButton.svelte';
import { createNavigationState } from '../../states/navigation.svelte';

describe('TestButton navigation', () => {
	it('共有モデルで経路とハイライトを変更し、移動操作だけをコールバックへ渡す', async () => {
		const navigation = createNavigationState();
		const focusOnPoi = vi.fn();
		const { getByRole } = await render(TestButton, { props: { navigation, focusOnPoi } });
		await getByRole('button', { name: '1-1HRから応用物理実験室への経路を表示' }).click();
		expect(navigation.routePath?.[0]).toBe('node_la_f1_hr_1-1');
		expect(navigation.routePath?.at(-1)).toBe('node_la_f3_lab-a-phys');
		expect(navigation.highlights).toEqual({ start: 'poi_hr_1-1', goal: 'poi_lab-a-phys' });
		expect(focusOnPoi).toHaveBeenCalledExactlyOnceWith('poi_hr_1-1');
		await getByRole('button', { name: 'POIハイライトを解除' }).click();
		expect(navigation.highlights).toEqual({});
		expect(navigation.routePath).not.toBeNull();
	});
});
