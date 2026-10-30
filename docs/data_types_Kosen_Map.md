# データ型定義

## 1. グラフデータ (経路探索用)

グラフデータは、純粋に「道（ノード）」と「繋がり（エッジ）」だけを定義します。ここに「タピオカ屋」のような具体的な名前は入れません。

### ノード（点）データ: `nodes.json`

通路の交差点、曲がり角、階段の昇り口、教室のドアの前などを点として定義します。

```typescript
type MapNode = {
	id: string; // 例: "node_1f_ent", "node_1f_A_stairs" (一意のID)
	buildingId?: string; // 建物ID。省略時は node_<建物ID>_f<階>_<地点> から判定
	floor: number; // 階数 (例: 1, 2, 3。マップ切り替えの判定に使用)
	x: number; // マップ上のX座標 (※Leafletの L.CRS.Simple 座標系に準拠)
	y: number; // マップ上のY座標 (※同上)
};
```

### エッジ（線）データ: `edges.json`

ノードとノードがどう繋がっているか、その距離はどれくらいかを定義します。

`buildGraph()` は通常接続のコストをノード間の平面距離から計算します。
`isStairs === true` の接続は、座標間の距離にかかわらず固定コスト `30` とします。
実測の縮尺が未定義のため、1-1HRと1-2HRを結ぶ通常接続のコスト `33.5` を
10単位刻みに丸めた値を、階段1本の3m相当の代用値として採用しています。
これは平面距離への加算ではありません。縮尺を実測した場合は、`buildGraph.ts` の
`STAIR_EDGE_COST` を見直してください。

食堂地下の内部階番号は `0` です。`maps.ts` の `cafe_B1.svg` も `floors[0]` に登録し、
POIが参照するノードの `floor: 0` と一致させています。

```typescript
type MapEdge = {
	id: string; // 例: "edge_ent_to_hall"
	fromNode: string; // 始点のノードID
	toNode: string; // 終点のノードID
	// ノード間の距離は読み込み時にノードの座標から計算
	isStairs: boolean; // 階段・エレベーターなど、階層を跨ぐ移動かどうかのフラグ
};
```

> **💡 ヒント:**
> 通常の廊下は両方向に歩けるため、JSON上は1つのエッジとして定義し、プログラム（経路探索関数）に読み込む際に「双方向の繋がり」として処理すると入力の手間が省けます。

---

## 2. POIデータ (目的地・マーカー表示用)

POI（Point of Interest）データは、教室や模擬店などの「意味のある場所」を定義します。**POIは必ず「最寄りのノードID」を持つことで、グラフデータと結びつきます。**

また、マップ描画にSVGを使用するため、対応するSVGの図形IDを持たせることで、UIから部屋の色を変えたりする連携が可能になります。

### POIデータ: `pois.json`

```typescript
type POI = {
	id: string; // 例: "poi_room_I301", "poi_booth_yakisoba"
	name: string; // 表示名 (例: "I-301教室", "焼きそば屋")
	categoryId: string; // カテゴリ > POIデータ:カテゴリ
	nodeId: string; // 【重要】このPOIの出入り口となるノードのID（経路探索の起点/終点）
	svgId: string; // 【重要】SVGファイル内の対応する図形(パス/rect)のID。ハイライトやタップ判定に使用。
	description: string; // 補足説明 (例: "3Eの出し物です！", "時間割表示用の詳細")
};
```

#### POIデータ:カテゴリ

- `classroom`: 教室。 HR教室や特別教室、講義室、選択教室などもここに含む。
- `locker`: ロッカー室
- `lab`: 実験室。
- `office`: 研究室や教員室、控室
- `toilet`: トイレ
- `storage`: 倉庫
- `sa`: 学友会管理のもの
- `balcony`: バルコニー
- `others`: その他

> **💡 なぜノードとPOIを分けるのか？**
> 「3つの模擬店が同じ大きな教室で開催されている」場合、3つのPOIが1つの同じ `nodeId` と `svgId` を参照するだけで済みます。経路探索エンジンは「指定されたノードまでの最短経路」を計算するだけで良くなるため、ロジックが非常にシンプルになります。

## 命名規則,略語一覧

### 命名規則

#### svgId

- 学校で一意の部屋名称が定まる時: `部屋種別-(科目|氏名|使用者)`例:`lab-chem`(化学実験室), `po-chem`(化学研究室)など
  - コース教員の研究室は `po-コース-名字`
  - 特例: HR教室については1-1などと表現するため`hr_クラス`と表記する。 例:`hr_1-1`(1-1HR教室), `hr_2i`(2I HR教室)など
- 他の建物や階層にも多数存在するもの(トイレや倉庫、階段など): `種別_建物名_階数_補足`例:`wc-womens_la_f1`や`stair_la_f1-f2_east`,`stg_la_f1_east`など
  - \[補足\]階段について: 階段の階数はそのレイヤーの階を前に書く。1階から2階の階段なら`f1-f2`,3階から4階なら`f3-f4`。
- 例外:固有名詞っぽい部屋名 `lang-lab`や`technical-support-office`,`startup-ws`(ゆめもこ)など
- 例外2: 建物の構造である他階層との共通部分(吹き抜けや建物の外枠): `la_f1_atrium`や`ss1_f1_flame`など

#### node id

- 基本形: `node_建物名_階層_場所`
  - `場所`:
    - 部屋前ノード: `~_部屋種別-(科目|氏名|使用者)`など(基本的にsvgIdに準じる)
      例: `node_la_f1_hr_1-1`, `node_la_f3_lab-phys`
    - 角ノード: `~_cnr_最寄りの部屋種別_(最寄りの 科目|氏名|使用者)`
    - 出入り口ノード: `~_ee_方角` (ee = Entrance/Exit)
    - 階段ノード: `~_stair_方角`
    - トイレノード: `~_wc-種別` 例:`~_wc-mens`,`~_wc-bf`(barrier-free)など
    - 倉庫ノード: `~_stg_場所`

#### edge id

edge idはJSON読み込み時に`"fromNode"`と`"toNode"`から生成される。

- 基本形: `edge_建物名_階層_fromNode_to_toNode`
  `fromNode`,`toNode`から`node_建物名_階層_`を除いたものから生成する。

#### pois (id|categoryId)

- id
  - 基本形: `poi_(svgIdに準じた部屋名など)`
- categoryId
  以下のいずれか:
  - `classroom`: 教室。 HR教室や特別教室、講義室、選択教室などもここに含む。
  - `locker`: ロッカー室
  - `lab`: 実験室。
  - `office`: 研究室や教員室、控室
  - `toilet`: トイレ
  - `storage`: 倉庫
  - `sa`: 学友会管理のもの
  - `balcony`: バルコニー
  - `others`: その他

### 略語一覧

- 建物名:
  - 教養棟: `la` (Liberal Arts Building)
  - 専門棟1: `ss1` (Specialized Subjects Building 1)
  - 専門棟2: `ss2` (Specialized Subjects Building 2)
  - 工場棟: `fac{n}` (factory {n} Building)
  - 管理棟: `admin` (Administration Building)
  - 体育館: `gym`
  - 共育連携センター: `cepc` (Collaborative Education Partnerships Center)
  - 武道館: `mah` (Martial Arts Hall)
  - 倉庫: `stg` (Storage)
  - 部室: `cr` (Club Room)
  - 図書館: `lib` (Library)
  - 食堂: `cafe` (Cafeteria)
- 部屋名:
  - HR教室: `hr_クラス` 例: `hr_1-1`
  - ロッカー室: `locker-学年` 例: `locker-1`
  - 研究室(一人): `po-(コース)-名字` 例: `po-i-kubota`
  - 研究室(複数人または科目): `po-科目` 例: `po-chem`
  - 教員室: `to-名字`
    - 非常勤講師控室: `to-pt`
  - 実験室: `lab-科目`
  - 準備室: `pr-科目`
  - 選択教室: `or-番号`
  - 講義室: `lr-科目`
  - トイレ: `wc-種別_建物_階`
  - 学友会管理のもの: `sa-種別`
  - 立入禁止または不明なもの: `na_近くの部屋`
  - 空き教室: `ur_建物_階`
  - 予備室: `spare_建物`
  - 特別教室: `special_建物_階`
  - 学務課: `sao`
  - 総務課: `gao`
  - 学主事: `dos`
  - 主任室: `co`
- 方角:
  - 東西南北のみならそのまま`east``west``south``north`
  - 北側の西側、南側の東側などのときは`nw`(north-west)や`se`(south-east)と表記
