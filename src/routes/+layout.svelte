<script lang="ts">
	import './layout.css';
	import favicon from '#lib/assets/omuct-navi-icon.svg';
	// import BottomNav from '#lib/components/layout/BottomNav.svelte';
	// import Header from '#lib/components/Header.svelte';

	const appName = 'OMUCT Navi';
	const title = `${appName} | 校内マップ・経路案内`;
	const description =
		'OMUCT Naviは、校内の教室や施設の場所をフロアマップで確認し、目的地までの経路を調べられる校内ナビゲーションアプリです。';

	let { children } = $props();
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<meta name="application-name" content={appName} />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content={appName} />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:locale" content="ja_JP" />
	<meta name="twitter:card" content="summary" />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
	<link rel="icon" href={favicon} />
</svelte:head>

<!-- <Header /> -->
{@render children()}
<!-- <BottomNav /> -->
