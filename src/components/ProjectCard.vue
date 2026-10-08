<script setup>
import { computed } from 'vue';
import { Github } from 'lucide-vue-next';
import { useLanguage } from '../composables/useLanguage';
import { translations } from '../data/translations';

const props = defineProps({
  project: {
    type: Object,
    required: true
  },
  isFlagship: {
    type: Boolean,
    default: false
  }
});

const { currentLanguage } = useLanguage();

const descriptionText = computed(() => {
  if (typeof props.project.description === 'object' && props.project.description !== null) {
    return props.project.description[currentLanguage.value] || props.project.description.en || props.project.description.id || '';
  }
  return props.project.description || '';
});

const altText = computed(() => {
  if (typeof props.project.imageAlt === 'object' && props.project.imageAlt !== null) {
    return props.project.imageAlt[currentLanguage.value] || props.project.imageAlt.en || props.project.imageAlt.id || props.project.title;
  }
  return props.project.imageAlt || `Preview ${props.project.title}`;
});
</script>

<template>
  <div
    :class="[
      'group relative flex flex-col bg-surface border rounded-xl overflow-hidden shadow-lg hover:-translate-y-1.5 transition-all duration-300',
      isFlagship
        ? 'border-accent/40 hover:border-accent/80 shadow-accent/5'
        : 'border-card-border hover:border-slate-700/80'
    ]"
  >
    <!-- Media Container -->
    <div
      :class="[
        'w-full bg-slate-950/90 flex items-center justify-center overflow-hidden shrink-0 relative',
        project.mediaFit === 'contain'
          ? 'h-[400px] sm:h-[440px] md:h-[460px] p-4'
          : 'aspect-[16/10] w-full'
      ]"
    >
      <img
        :src="project.imageUrl"
        :alt="altText"
        :class="[
          'transition-transform duration-500 ease-out',
          project.mediaFit === 'contain'
            ? 'h-full w-auto max-h-full max-w-full object-contain group-hover:scale-[1.02]'
            : 'w-full h-full object-cover group-hover:scale-[1.03]'
        ]"
      />
      <div class="absolute inset-0 pointer-events-none bg-gradient-to-t from-surface/30 via-transparent to-transparent opacity-60"></div>
    </div>

    <!-- Content -->
    <div class="p-5 sm:p-6 flex flex-col flex-grow">
      <div class="flex items-start justify-between gap-3 mb-2.5">
        <h3 class="text-xl font-bold text-primary group-hover:text-accent transition-colors duration-200">
          {{ project.title }}
        </h3>
        <span
          v-if="isFlagship"
          class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide bg-accent/15 text-accent border border-accent/30 shrink-0 mt-0.5"
        >
          {{ translations.projects.flagship[currentLanguage] }}
        </span>
      </div>

      <p class="text-secondary text-sm leading-relaxed mb-5">
        {{ descriptionText }}
      </p>

      <div class="mt-auto">
        <div class="flex flex-wrap gap-2">
          <span
            v-for="tech in project.technologies"
            :key="tech"
            class="bg-chip-bg text-chip-text text-xs font-semibold px-2.5 py-1 rounded-full border border-card-border/40"
          >
            {{ tech }}
          </span>
        </div>

        <div v-if="project.sourceUrl" class="mt-5 pt-4 border-t border-card-border/40 flex justify-end">
          <a
            :href="project.sourceUrl"
            target="_blank"
            class="text-secondary hover:text-accent transition-colors duration-200 text-sm flex items-center gap-1.5"
          >
            <Github class="w-4 h-4" />
            <span>{{ translations.projects.sourceCode[currentLanguage] }}</span>
          </a>
        </div>
      </div>
    </div>
  </div>
</template>
