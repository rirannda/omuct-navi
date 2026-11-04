export type MapPosition = { x: number; y: number; accuracy?: number };
export type GeographicPosition = { latitude: number; longitude: number };
export type GeolocationReferencePoint = GeographicPosition & {
	/** Nodeと同じ、Yが上向きの校内地図座標。SVGのY座標ではありません。 */
	x: number;
	y: number;
};

function validCoordinates({ latitude, longitude }: GeographicPosition): boolean {
	return (
		Number.isFinite(latitude) &&
		Math.abs(latitude) <= 90 &&
		Number.isFinite(longitude) &&
		Math.abs(longitude) <= 180
	);
}

/** 校内の離れた3点から局所的なアフィン変換を作ります。未設定・一直線なら使いません。 */
export function createGeolocationProjection(points: readonly GeolocationReferencePoint[]) {
	if (
		points.length !== 3 ||
		points.some((point) => !validCoordinates(point) || !Number.isFinite(point.x + point.y))
	)
		return null;
	const [origin, first, second] = points;
	const metersPerDegree = (6371008.8 * Math.PI) / 180;
	const longitudeScale = metersPerDegree * Math.cos((origin.latitude * Math.PI) / 180);
	const east1 = (first.longitude - origin.longitude) * longitudeScale;
	const north1 = (first.latitude - origin.latitude) * metersPerDegree;
	const east2 = (second.longitude - origin.longitude) * longitudeScale;
	const north2 = (second.latitude - origin.latitude) * metersPerDegree;
	const determinant = east1 * north2 - east2 * north1;
	const area =
		(first.x - origin.x) * (second.y - origin.y) - (second.x - origin.x) * (first.y - origin.y);
	if (Math.abs(determinant) < 0.01 || Math.abs(area) < 0.01) return null;
	const a = ((first.x - origin.x) * north2 - (second.x - origin.x) * north1) / determinant;
	const b = ((second.x - origin.x) * east1 - (first.x - origin.x) * east2) / determinant;
	const c = ((first.y - origin.y) * north2 - (second.y - origin.y) * north1) / determinant;
	const d = ((second.y - origin.y) * east1 - (first.y - origin.y) * east2) / determinant;
	// 最大特異値を使い、回転・縦横比の異なる図でも精度の円を過小評価しません。
	const trace = a * a + b * b + c * c + d * d;
	const unitsPerMeter = Math.sqrt(
		(trace + Math.sqrt(Math.max(0, trace * trace - 4 * (a * d - b * c) ** 2))) / 2
	);
	if (!Number.isFinite(unitsPerMeter) || unitsPerMeter <= 0) return null;
	return {
		unitsPerMeter,
		project(position: GeographicPosition, accuracyMeters = 0): MapPosition | null {
			if (!validCoordinates(position) || !Number.isFinite(accuracyMeters) || accuracyMeters < 0)
				return null;
			const east = (position.longitude - origin.longitude) * longitudeScale;
			const north = (position.latitude - origin.latitude) * metersPerDegree;
			return {
				x: origin.x + a * east + b * north,
				y: origin.y + c * east + d * north,
				accuracy: accuracyMeters * unitsPerMeter
			};
		}
	};
}

export type GeolocationProjection = NonNullable<ReturnType<typeof createGeolocationProjection>>;
