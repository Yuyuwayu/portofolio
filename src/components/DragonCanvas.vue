<script setup lang="ts">
import { ref } from 'vue';
import { useDragonAnimation } from '../composables/useDragonAnimation';

const props = defineProps<{
  dark: boolean;
  safeZone?: HTMLElement | null;
}>();

const canvas = ref<HTMLCanvasElement | null>(null);

useDragonAnimation(
  canvas,
  () => props.safeZone ?? null,
  () => props.dark,
);
</script>

<template>
  <canvas ref="canvas" class="dragon-canvas" aria-hidden="true"></canvas>
</template>

<style scoped>
.dragon-canvas {
  position: absolute;
  inset: 0;
  z-index: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
</style>
