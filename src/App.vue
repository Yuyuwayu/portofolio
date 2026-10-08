<script setup>
import { ref, shallowRef, onMounted, onBeforeUnmount, computed, watchEffect, watch } from 'vue';
import { tsParticles } from '@tsparticles/engine';
import { loadSlim } from '@tsparticles/slim';
import { Github, Linkedin, Sun, Moon, Globe, Heart } from 'lucide-vue-next';
import DragonCanvas from './components/DragonCanvas.vue';
import ProjectCard from './components/ProjectCard.vue';
import { useLanguage } from './composables/useLanguage';
import { translations, personalInfo } from './data/translations';
import { projects } from './data/projects';
import { skills } from './data/skills';

const { currentLanguage, toggleLanguage } = useLanguage();

const particlesContainer = ref(null);
const particleSystem = shallowRef(null);
const heroCopy = ref(null);
const isDarkMode = ref(true);
const prefersReducedMotion = ref(false);
let reducedMotionQuery = null;

const updateReducedMotionPreference = ({ matches }) => {
  prefersReducedMotion.value = matches;
};

watchEffect(() => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('isDarkMode', JSON.stringify(isDarkMode.value));
    if (isDarkMode.value) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }
});

const socialLinks = [
  { name: 'GitHub', component: Github, url: 'https://github.com/Yuyuwayu' },
  { name: 'LinkedIn', component: Linkedin, url: 'https://www.linkedin.com/in/nanda-willy-atmaja-6b916333b/' }
];

const constellationAnchors = [
  // A small northern cluster, kept away from the hero copy.
  ['north', 8, 8, 1.6],
  ['north', 12, 17, 1.9],
  ['north', 17, 25, 1.5],
  ['north', 21, 34, 1.3],
  // A counterweight in the upper-right keeps the field from feeling uniform.
  ['east', 76, 10, 1.4],
  ['east', 80, 19, 2.0],
  ['east', 85, 27, 1.5],
  ['east', 89, 36, 1.3],
  // A longer, quieter chain that only hints at a dragon when noticed.
  ['serpent', 55, 62, 1.2],
  ['serpent', 60, 70, 1.8],
  ['serpent', 65, 77, 1.4],
  ['serpent', 70, 85, 1.9],
  ['serpent', 77, 84, 1.3],
];

const compactConstellationAnchors = [
  ['north', 10, 10, 1.5],
  ['north', 15, 20, 1.8],
  ['north', 21, 30, 1.4],
  ['east', 77, 12, 1.4],
  ['east', 82, 22, 1.8],
  ['east', 88, 31, 1.4],
  ['serpent', 60, 68, 1.3],
  ['serpent', 66, 76, 1.8],
  ['serpent', 72, 84, 1.3],
];

const constellationStars = (anchors, dark, motionEnabled, linkDistance) => {
  const starColor = dark ? '#a9c2d4' : '#5c7895';
  const lineColor = dark ? '#6e96b3' : '#6887a3';

  return anchors.map(([constellation, x, y, size]) => ({
    position: { x, y, mode: 'percent' },
    options: {
      color: { value: starColor },
      move: { enable: false },
      opacity: {
        value: { min: 0.42, max: 0.72 },
        animation: { enable: motionEnabled, speed: 0.08, sync: false },
      },
      size: { value: size },
      links: {
        color: lineColor,
        distance: linkDistance,
        enable: true,
        id: `constellation-${constellation}`,
        opacity: 0.18,
        triangles: { enable: false },
        width: 0.55,
      },
    },
  }));
};

const particleOptions = computed(() => ({
  manualParticles: constellationStars(constellationAnchors, isDarkMode.value, !prefersReducedMotion.value, 170),
  background: {
    color: {
      value: isDarkMode.value ? '#020617' : '#f8fafc'
    }
  },
  fpsLimit: 60,
  interactivity: {
    events: {
      onClick: { enable: true, mode: 'push' },
      onHover: { enable: true, mode: 'grab' },
      resize: true
    },
    modes: {
      push: { quantity: 4 },
      grab: {
        distance: 86,
        links: {
          color: isDarkMode.value ? '#7397b1' : '#66829d',
          opacity: 0.11,
        },
      },
    }
  },
  particles: {
    color: {
      value: isDarkMode.value
        ? ['#6f8fa8', '#8ca9bd', '#b1c5d2']
        : ['#7188a0', '#58738f', '#849bae']
    },
    links: {
      enable: false,
    },
    move: {
      direction: 'none',
      enable: !prefersReducedMotion.value,
      outModes: { default: 'out' },
      random: true,
      speed: 0.08,
      straight: false
    },
    number: {
      density: { enable: false },
      value: 44
    },
    opacity: {
      value: { min: 0.16, max: 0.52 },
      animation: { enable: !prefersReducedMotion.value, speed: 0.12, sync: false },
    },
    shape: { type: 'circle' },
    size: { value: { min: 0.65, max: 1.75 } }
  },
  responsive: [
    {
      maxWidth: 960,
      mode: 'screen',
      options: {
        manualParticles: constellationStars(compactConstellationAnchors, isDarkMode.value, !prefersReducedMotion.value, 120),
        particles: { number: { value: 30 } },
      },
    },
    {
      maxWidth: 639,
      mode: 'screen',
      options: {
        manualParticles: [],
        particles: {
          move: { enable: false },
          number: { value: 22 },
        },
      },
    },
  ],
  detectRetina: true
}));

const loadParticles = async (options) => {
  if (particlesContainer.value) {
    particleSystem.value = await tsParticles.load({
      id: 'tsparticles',
      element: particlesContainer.value,
      options: options,
    }) ?? null;
  }
};

const scrollTo = (selector) => {
  const element = document.querySelector(selector);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth' });
  }
};

watch(particleOptions, (newOptions) => {
  void loadParticles(newOptions);
});

onMounted(async () => {
  const savedTheme = localStorage.getItem('isDarkMode');
  isDarkMode.value = savedTheme !== null ? JSON.parse(savedTheme) : true;
  reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  prefersReducedMotion.value = reducedMotionQuery.matches;
  reducedMotionQuery.addEventListener('change', updateReducedMotionPreference);

  await loadSlim(tsParticles);
  await loadParticles(particleOptions.value);

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.scroll-target').forEach(el => {
    observer.observe(el);
  });
});

onBeforeUnmount(() => {
  reducedMotionQuery?.removeEventListener('change', updateReducedMotionPreference);
});
</script>

<template>
  <div ref="particlesContainer" id="tsparticles" class="fixed w-full h-full top-0 left-0 -z-10"></div>
  <DragonCanvas :dark="isDarkMode" :safe-zone="heroCopy" :particle-system="particleSystem" />

  <div class="relative z-10 text-secondary">
    <!-- Utility Controls: Language Switcher directly beside Theme Toggle -->
    <div class="fixed top-6 right-6 z-30 flex items-center gap-2">
      <!-- Language Switcher -->
      <button
        @click="toggleLanguage"
        :aria-label="translations.nav.switchLanguage[currentLanguage]"
        class="flex items-center gap-1.5 px-3 py-2 rounded-full bg-surface/80 backdrop-blur-sm transition-colors duration-300 border border-card-border hover:border-accent text-secondary hover:text-primary text-xs font-semibold shadow-sm"
      >
        <Globe class="w-4 h-4 text-accent" />
        <span class="uppercase tracking-wider font-bold">{{ currentLanguage }}</span>
      </button>

      <!-- Theme Toggle (preserving original design and scale) -->
      <button
        @click="isDarkMode = !isDarkMode"
        :aria-label="isDarkMode ? translations.nav.themeDark[currentLanguage] : translations.nav.themeLight[currentLanguage]"
        class="p-2 rounded-full bg-surface/80 backdrop-blur-sm transition-colors duration-300 border border-card-border hover:border-accent text-secondary hover:text-primary shadow-sm"
      >
        <Sun v-if="isDarkMode" class="w-6 h-6 text-yellow-500" />
        <Moon v-else class="w-6 h-6 text-indigo-700" />
      </button>
    </div>

    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-16">
      <!-- Hero Section -->
      <section id="home" class="relative isolate min-h-[82vh] flex items-center py-12 md:py-20 scroll-target">
        <div ref="heroCopy" class="relative z-10 max-w-3xl">
          <div class="text-2xl font-bold text-primary tracking-wider mb-6 sm:mb-8">
            {{ personalInfo.nama.split(' ')[0] }}<span class="text-accent">.</span>
          </div>
          <h2 class="text-accent font-semibold text-base sm:text-lg tracking-wide">{{ translations.hero.greeting[currentLanguage] }}</h2>
          <h1 class="text-4xl sm:text-5xl md:text-6xl font-bold text-primary mt-2 tracking-tight">{{ personalInfo.nama }}</h1>
          <h3 class="text-xl sm:text-2xl md:text-3xl font-semibold text-secondary mt-2.5 sm:mt-3">{{ translations.hero.role[currentLanguage] }}</h3>
          <p class="mt-5 text-base sm:text-lg text-secondary max-w-2xl leading-relaxed">
            {{ translations.hero.bio[currentLanguage] }}
          </p>
          <div class="mt-8 flex flex-wrap gap-4">
            <a
              href="#projects"
              @click.prevent="scrollTo('#projects')"
              class="bg-primary text-background hover:opacity-90 font-semibold px-6 sm:px-8 py-3 rounded-lg shadow-md transition-all duration-300 transform hover:scale-[1.02] border border-accent text-sm sm:text-base inline-flex items-center justify-center"
            >
              {{ translations.hero.viewProjects[currentLanguage] }}
            </a>
            <a
              :href="personalInfo.cvUrl"
              target="_blank"
              class="bg-transparent border border-accent text-accent hover:bg-accent hover:text-white font-semibold px-6 sm:px-8 py-3 rounded-lg shadow-md transition-all duration-300 text-sm sm:text-base inline-flex items-center justify-center"
            >
              {{ translations.hero.downloadCv[currentLanguage] }}
            </a>
          </div>
        </div>
      </section>

      <!-- Projects Section (Masonry Wall) -->
      <section id="projects" class="py-20 md:py-28 scroll-target relative">
        <!-- Subtle ambient star points -->
        <div class="pointer-events-none absolute top-10 right-8 w-1.5 h-1.5 rounded-full bg-slate-300/20 blur-[0.5px] hidden sm:block"></div>
        <div class="pointer-events-none absolute bottom-12 left-6 w-1 h-1 rounded-full bg-slate-300/20 blur-[0.5px] hidden sm:block"></div>

        <div class="text-center">
          <h2 class="text-3xl md:text-4xl font-bold text-primary tracking-tight">
            <span class="text-accent">{{ translations.projects.titlePrefix[currentLanguage] }}</span>{{ translations.projects.titleSuffix[currentLanguage] }}
          </h2>
          <p class="text-secondary mt-3 max-w-2xl mx-auto text-base">
            {{ translations.projects.subtitle[currentLanguage] }}
          </p>
        </div>

        <!-- Pinterest-Inspired Masonry Project Wall -->
        <div class="mt-12 md:mt-16">
          <!-- Desktop Layout (3 Columns): lg and above -->
          <div class="hidden lg:grid lg:grid-cols-3 gap-6 items-start">
            <!-- Column 1: Flagship Landscape (MyShuttle) + Secondary Landscape (Presensi) -->
            <div class="flex flex-col gap-6">
              <ProjectCard :project="projects[0]" :is-flagship="true" />
              <ProjectCard :project="projects[3]" />
            </div>

            <!-- Column 2: Tall Portrait Showcase (Doremi) -->
            <div class="flex flex-col gap-6">
              <ProjectCard :project="projects[1]" />
            </div>

            <!-- Column 3: Horizontal Tool (Webnovel Scraper) + Offset Tall Portrait Showcase (WhatsApp Bot) -->
            <div class="flex flex-col gap-6">
              <ProjectCard :project="projects[4]" />
              <ProjectCard :project="projects[2]" />
            </div>
          </div>

          <!-- Tablet Layout (2 Columns): md to lg -->
          <div class="hidden md:grid lg:hidden md:grid-cols-2 gap-6 items-start">
            <!-- Column 1: Landscape (MyShuttle) + Portrait (WhatsApp Bot) -->
            <div class="flex flex-col gap-6">
              <ProjectCard :project="projects[0]" :is-flagship="true" />
              <ProjectCard :project="projects[2]" />
            </div>

            <!-- Column 2: Portrait (Doremi) + Landscape (Presensi) + Landscape (Webnovel Scraper) -->
            <div class="flex flex-col gap-6">
              <ProjectCard :project="projects[1]" />
              <ProjectCard :project="projects[3]" />
              <ProjectCard :project="projects[4]" />
            </div>
          </div>

          <!-- Mobile Layout (1 Column): below md -->
          <div class="flex flex-col md:hidden gap-6">
            <ProjectCard
              v-for="(project, index) in projects"
              :key="project.title"
              :project="project"
              :is-flagship="index === 0"
            />
          </div>
        </div>
      </section>

      <!-- Skills Section -->
      <section id="skills" class="py-20 md:py-28 scroll-target">
        <div class="text-center">
          <h2 class="text-3xl md:text-4xl font-bold text-primary tracking-tight">
            <span class="text-accent">{{ translations.skills.titlePrefix[currentLanguage] }}</span>{{ translations.skills.titleSuffix[currentLanguage] }}
          </h2>
          <p class="text-secondary mt-3 max-w-2xl mx-auto text-base">
            {{ translations.skills.subtitle[currentLanguage] }}
          </p>
        </div>

        <div class="mt-12 max-w-4xl mx-auto flex flex-wrap justify-center gap-6 md:gap-8">
          <div
            v-for="skill in skills"
            :key="skill.name"
            class="flex flex-col items-center gap-3 p-4 bg-surface backdrop-blur-xl border border-card-border rounded-xl w-28 h-28 justify-center transition-all duration-300 transform hover:scale-110 shadow-sm"
          >
            <img :src="skill.iconUrl" :alt="skill.name" class="w-10 h-10 object-contain">
            <span class="text-primary font-medium text-sm text-center leading-tight">{{ skill.name }}</span>
          </div>
        </div>
      </section>

      <!-- Contact Section -->
      <section id="contact" class="py-20 md:py-28 text-center scroll-target">
        <h2 class="text-3xl md:text-4xl font-bold text-primary tracking-tight">
          {{ translations.contact.title[currentLanguage] }}
        </h2>
        <p class="text-secondary mt-3 max-w-xl mx-auto text-base">
          {{ translations.contact.subtitle[currentLanguage] }}
        </p>
        <div class="mt-8">
          <a
            :href="'mailto:' + personalInfo.email"
            class="inline-block bg-primary text-background hover:opacity-90 text-base sm:text-lg font-semibold px-8 sm:px-10 py-3.5 sm:py-4 rounded-lg shadow-lg transition-all duration-300 transform hover:scale-105 border border-accent"
          >
            {{ translations.contact.button[currentLanguage] }}
          </a>
        </div>
        <div class="mt-8 flex justify-center gap-6 sm:gap-8">
          <a
            v-for="social in socialLinks"
            :key="social.name"
            :href="social.url"
            target="_blank"
            :aria-label="social.name"
            class="text-secondary hover:text-accent transition-colors duration-300 p-2 rounded-lg hover:bg-slate-800/10 dark:hover:bg-slate-700/20"
          >
            <component :is="social.component" class="w-6 h-6" />
          </a>
        </div>
      </section>
    </main>

    <!-- Footer -->
    <footer class="border-t border-card-border/60 py-8">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-secondary">
        <p>
          &copy; {{ new Date().getFullYear() }} {{ personalInfo.nama }}.
          {{ translations.footer.builtWith[currentLanguage] }}
          <Heart class="inline-block w-4 h-4 text-red-500 fill-current mx-0.5 align-text-bottom" />
          {{ translations.footer.usingVue[currentLanguage] }}
        </p>
      </div>
    </footer>
  </div>
</template>
