# OMUCT Navi

OMUCT Naviは、校内の教室や施設を探し、目的地までの経路を地図で確認できるナビゲーションアプリです。

## 主な機能

- 校内マップ：建物を選択し、階ごとのフロアマップを確認できます。
- 施設検索：教室や施設を名前・キーワードから検索できます。
- 経路案内：出発地と目的地を選ぶと、経路や建物・階の移動箇所を地図上に表示します。
- バリアフリー検索：階段を使わない経路を検索できます。
- 施設情報：地図上の施設を選択して所在地や登録された説明を確認し、出発地・目的地に設定できます。

## 仕組み

### 全体構成

```mermaid
flowchart TB
    subgraph sgUi["画面（SvelteKit）"]
        nPage["routes/+page.svelte<br/>RouteSearchPanel・BottomSheet・BottomNav・Map"]
    end
    subgraph sgLib["共有状態 / 経路探索（src/lib）"]
        nNav["states/navigation.svelte.ts<br/>選択・ハイライト・経路を保持"]
        nAstar["aStar/<br/>グラフ構築とA*探索"]
        nRoute["route/<br/>経路表示・ラベル配置"]
    end
    subgraph sgMap["地図描画（src/lib/map・Leaflet）"]
        nLayers["svgLayers / poiLayer / markerLayer / routeLayer"]
        nView["state/view・floors<br/>建物と階の表示状態"]
    end
    subgraph sgData["データ（src/data・static/maps）"]
        nGraph["nodes・edges・edge_stair<br/>（経路グラフ）"]
        nSpots["pois・markers・buildings・maps"]
        nSvgs["階別SVG地図"]
    end
    sgUi --> sgLib
    sgUi --> sgMap
    sgLib --> sgData
    sgMap --> sgData
```

### 経路探索の流れ

```mermaid
flowchart LR
    A["① 場所を選ぶ<br/>出発地・目的地<br/>（POI → nodeId）"] --> B["② グラフ構築<br/>buildGraph"]
    B --> C["③ A*探索<br/>aStar"]
    C --> D["④ 共有状態<br/>routePathに保存"]
    D --> E["⑤ 表示<br/>routeLayerが描画"]
```

- 通常の辺のコストは2ノード間の直線距離、階段の辺は固定コスト30です。
- バリアフリー設定（`avoidStairs`）では階段の辺を除いて探索します。

### 操作から経路表示までのシーケンス

```mermaid
sequenceDiagram
    autonumber
    actor User as ユーザー
    participant Panel as RouteSearchPanel
    participant Nav as navigation
    participant AStar as aStar
    participant Map as Map.svelte
    participant Layers as routeLayer / poiLayer

    User->>Panel: 出発地・目的地を検索候補から選ぶ
    Panel->>Nav: clearRoute()
    Panel->>Nav: setHighlight(poiId, role)
    Panel->>Nav: requestFocus(poiId, showFloor)
    Nav-->>Map: highlights・focusRequestが変化
    Map->>Layers: POIを強調（render）
    Map->>Map: カメラ移動（目的地は階別図も表示）

    User->>Panel: 「ルート検索」を押す
    Panel->>Nav: showRoute(startNodeId, goalNodeId)
    Nav->>AStar: aStar(graph, start, goal, avoidStairs)
    AStar-->>Nav: nodeIdの配列 または null
    alt 経路が見つかった
        Nav->>Nav: routePathを更新、routeErrorを解除
        Nav-->>Panel: routePathあり（「経路を解除」を表示）
        Panel->>Nav: requestFocus(出発地のPOI)
        Nav-->>Map: routePath・focusRequestが変化
        Map->>Layers: routeLayer.draw(path)で経路線を描画
        Map->>Map: 経路上の階へ表示を切り替え
    else 経路が見つからない
        Nav->>Nav: routeErrorを設定（routePathはnull）
        Nav-->>Panel: エラーメッセージを表示
    end

    User->>Panel: バリアフリー設定を切り替える
    Panel->>Nav: setBarrierFree(enabled)
    Note over Nav,AStar: 経路検索済みなら直前の出発地・目的地で showRoute を再実行
```

検索パネルは`navigation`のメソッドだけを呼び、`Map.svelte`は`navigation`の状態変化を受けて描画します。パネルと地図は互いを直接呼びません。

### 状態の所有と更新の流れ

```mermaid
flowchart TB
    parent["親（+page.svelte）<br/>createNavigationState()を生成"]
    nav["navigation<br/>highlights（start / goal / selected）<br/>routePath・selectedPoi"]
    map["Map.svelte<br/>初期化・破棄・カメラ操作・表示更新の調整"]
    svg["svgLayers<br/>基本図・階別図"]
    poi["poiLayer / markerLayer<br/>施設の強調・吹き出し"]
    rt["routeLayer<br/>経路線・階移動マーカー"]
    parent -->|生成して共有| nav
    nav -->|状態の変化| map
    map --> svg
    map --> poi
    map --> rt
```

各描画モジュールは互いを直接呼ばず、`Map.svelte`が調整します。詳細は[地図の責務と状態の所有](docs/map_responsibilities.md)を参照してください。

## 使い方

1. 画面下部の検索欄を開き、出発地と行き先を検索します。
2. それぞれ検索候補から場所を選び、「ルート検索」を押します。
3. 地図上の経路を確認します。必要に応じて建物や階を切り替えられます。

バリアフリー設定では、登録された経路情報から階段を除いて検索します。現地の段差や通行状況がすべて反映されているとは限らないため、実際の状況もご確認ください。

## NixOS

NixOSで開発を行なう場合は `steam-run` を `bun dev` の前に入力してください。
