import type { LabelBounds } from '../route/labelLayout';

type Point = { x: number; y: number };
const sampledOutlines = new WeakMap<SVGGeometryElement, Point[]>();

/** 描画されていない階の輪郭も取得できるよう、SVG座標で一度だけサンプリングします。 */
export function getSvgOutlinePoints(outline: SVGGeometryElement): readonly Point[] {
	let points = sampledOutlines.get(outline);
	if (!points) {
		const length = outline.getTotalLength();
		if (length <= 0) return [];
		const steps = Math.ceil(length);
		points = Array.from({ length: steps + 1 }, (_, index) => {
			const point = outline.getPointAtLength((length * index) / steps);
			return { x: point.x, y: point.y };
		});
		sampledOutlines.set(outline, points);
	}
	return points;
}

/** 実際の輪郭上の点を使い、L字形などの外接矩形内の空白へ線を結ばないようにします。 */
export function getSvgOutlineAnchor(
	outline: SVGGeometryElement,
	target: Point,
	viewport: LabelBounds
): Point | undefined {
	const matrix = outline.getScreenCTM();
	if (!matrix) return undefined;
	const points = getSvgOutlinePoints(outline);
	let closest: Point | undefined;
	let closestVisible: Point | undefined;
	let distance = Infinity;
	let visibleDistance = Infinity;
	for (const point of points) {
		const x = matrix.a * point.x + matrix.c * point.y + matrix.e - viewport.x;
		const y = matrix.b * point.x + matrix.d * point.y + matrix.f - viewport.y;
		const squaredDistance = (x - target.x) ** 2 + (y - target.y) ** 2;
		if (squaredDistance < distance) {
			closest = { x, y };
			distance = squaredDistance;
		}
		if (
			x >= 0 &&
			x <= viewport.width &&
			y >= 0 &&
			y <= viewport.height &&
			squaredDistance < visibleDistance
		) {
			closestVisible = { x, y };
			visibleDistance = squaredDistance;
		}
	}
	return closestVisible ?? closest;
}
