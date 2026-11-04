export type Edge = {
	fromNode: string;
	toNode: string;
	isStairs: boolean;
};
export type Edges = Edge[];

export type Node = {
	id: string;
	buildingId?: string; // 省略時は既存のノードID命名規則から判定
	floor: number;
	x: number;
	y: number;
};
export type Nodes = Node[];

export type EnhancedEdge = {
	id: string;
	fromNode: string;
	toNode: string;
	isStairs: boolean;
	weight: number;
};

type DestinationInfo = {
	id: string;
	name: string;
	categoryId: string;
	nodeId: string;
	description: string;
	keys?: string[];
};

export type Poi = DestinationInfo & {
	svgId: string;
};
export type Pois = Poi[];

export type ToiletType = 'men' | 'women' | 'accessible';

export type MapDataConfig = {
	mode: 'normal' | 'festival';
};

/** x・yはNodeと同じ地図座標。nodeIdは経路の到達点、座標と所属階は表示用です。 */
export type MapMarker = DestinationInfo & {
	svgId?: never;
	x: number;
	y: number;
	buildingId: string;
	floor: number;
	/** always: 全体図から常に表示。floor: 所属階の詳細図を表示中のみ。屋外はalwaysを指定します。 */
	visibility: 'always' | 'floor';
	/** assets内の画像ファイルをimportしたURL。SVG・PNG等を指定できます。 */
	icon: string;
	/** トイレの種別。近くのトイレ検索の絞り込みに使用します。 */
	toiletType?: ToiletType;
};
export type Destination = Poi | MapMarker;

export type DestinationLocation = {
	x: number;
	y: number;
	buildingId: string;
	floor: number;
};
