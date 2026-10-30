import { afterEach, describe, expect, it } from 'vitest';
import { getSvgOutlineAnchor, getSvgOutlinePoints } from '../svgOutline';

let svg: SVGSVGElement;
function makeOutline() {
	svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
	svg.setAttribute('viewBox', '0 0 200 200');
	svg.style.width = '200px';
	svg.style.height = '200px';
	svg.innerHTML = '<path d="M20 20H40V140H140V160H20Z" fill="none" stroke="black" />';
	document.body.appendChild(svg);
	return svg.querySelector('path')!;
}
afterEach(() => svg?.remove());

describe('getSvgOutlineAnchor', () => {
	it('未表示のSVGの輪郭も取得でき、同じSVGではサンプルを再利用する', () => {
		const outline = makeOutline();
		svg.remove();
		const points = getSvgOutlinePoints(outline);
		expect(points.length).toBeGreaterThan(4);
		expect(getSvgOutlinePoints(outline)).toBe(points);
	});

	it('L字形の空白を指さず、拡大や移動後もSVGの線上へ接続する', () => {
		const outline = makeOutline();
		for (const scale of [1, 2, 4]) {
			svg.style.width = `${scale * 200}px`;
			svg.style.height = `${scale * 200}px`;
			svg.style.transform = 'translate(17px, 23px)';
			const rect = svg.getBoundingClientRect();
			const anchor = getSvgOutlineAnchor(
				outline,
				{ x: 180 * scale, y: 60 * scale },
				{ x: rect.x, y: rect.y, width: rect.width, height: rect.height }
			)!;
			const local = new DOMPoint(anchor.x + rect.x, anchor.y + rect.y).matrixTransform(
				outline.getScreenCTM()!.inverse()
			);
			expect(outline.isPointInStroke(local)).toBe(true);
			expect(outline.isPointInStroke(new DOMPoint(140, 60))).toBe(false);
		}
	});

	it('見えている輪郭を優先し、画面外の近い輪郭へ接続しない', () => {
		const outline = makeOutline();
		const rect = svg.getBoundingClientRect();
		const anchor = getSvgOutlineAnchor(
			outline,
			{ x: 0, y: 60 },
			{ x: rect.x + 100, y: rect.y, width: 100, height: 200 }
		)!;
		expect(anchor.x).toBeGreaterThanOrEqual(0);
		expect(anchor.y).toBeGreaterThanOrEqual(0);
		const local = new DOMPoint(anchor.x + rect.x + 100, anchor.y + rect.y).matrixTransform(
			outline.getScreenCTM()!.inverse()
		);
		expect(outline.isPointInStroke(local)).toBe(true);
	});
});
