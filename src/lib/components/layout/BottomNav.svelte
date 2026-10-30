<script lang="ts">
	import BottomNavItem from '../elements/BottomNavItem.svelte';
	let activeTab = $state('home');
</script>

<nav class="fixed bottom-0 left-0 flex w-full items-center justify-center">
	<BottomNavItem id="home" isActive={activeTab === 'home'} onclick={() => (activeTab = 'home')} />
	<BottomNavItem id="map" isActive={activeTab === 'map'} onclick={() => (activeTab = 'map')} />
	<BottomNavItem id="map" isActive={activeTab === 'ld'} onclick={() => (activeTab = 'ld')} />
</nav>
