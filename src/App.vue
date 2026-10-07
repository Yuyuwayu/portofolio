<script setup>
import { ref, shallowRef, onMounted, onBeforeUnmount, computed, watchEffect, watch } from 'vue';
import { tsParticles } from '@tsparticles/engine';
import { loadSlim } from '@tsparticles/slim';
import { Github, Linkedin, Twitter, ExternalLink, Heart, Sun, Moon } from 'lucide-vue-next';
import DragonCanvas from './components/DragonCanvas.vue';

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

const personalInfo = ref({
  nama: 'Nanda Willy Atmaja',
  jabatan: 'Junior Web Developer',
  sapaan: 'Halo, saya',
  bio: 'Seorang mahasiswa dari Universitas Negeri Semarang yang bersemangat dalam dunia pengembangan web. Saya memiliki minat kuat pada pengembangan back-end dan front-end, dan selalu antusias untuk belajar teknologi baru serta berkontribusi dalam proyek-proyek yang menantang.',
  email: 'Justturtle30@students.unnes.ac.id',
  cvUrl: 'https://drive.google.com/file/d/1LbcVmTRIcsnJLWUIXpECe6zi2pdWYbG3/view?usp=drive_link'
});

const projects = ref([
  {
    title: 'MyShuttle UNNES',
    description: 'Full-stack campus shuttle monitoring system for tracking shuttle routes, shuttle locations, nearby stops, and passenger occupancy. Laravel powers the full application, while Python runs a custom-trained YOLOv8n model for passenger detection.',
    imageUrl: '/myshuttle-unnes.webp',
    technologies: ['Laravel', 'Python', 'YOLOv8n', 'Leaflet']
  },
  {
    title: 'Web Profil Desa',
    description: 'Membuat Template Web Profil Desa dengan data dummy menggunakan Vue 3 dan Tailwind.',
    imageUrl: 'https://placehold.co/600x400/020617/94a3b8?text=Web+Profil+Desa',
    technologies: ['Vue 3', 'Tailwind'],
    sourceUrl: 'https://github.com/Yuyuwayu/selokarto'
  },
  {
    title: 'Deteksi Ikan',
    description: 'Membuat Prototipe Model Yolo untuk mendeteksi Ikan.',
    imageUrl: 'https://placehold.co/600x400/020617/94a3b8?text=Deteksi+Ikan',
    technologies: ['Python', 'FastApi', 'Yolo'],
    sourceUrl: 'https://github.com/Yuyuwayu/capstone-yolo'
  },
  {
    title: 'Analisis Segmentasi Pelanggan dengan Clustering dan Klasifikasi',
    description: 'Melakukan segmentasi pelanggan menggunakan K-Means Clustering, menghasilkan 4 segmen.',
    imageUrl: 'https://placehold.co/600x400/020617/94a3b8?text=Clustering+dan+Klasifikasi',
    technologies: ['Python'],
    sourceUrl: 'https://github.com/Yuyuwayu/machine-learning'
  },
  {
    title: 'Desain Landing Page',
    description: 'Mendesain dan membangun landing page yang menarik dan responsif dari awal menggunakan HTML dan CSS murni.',
    imageUrl: 'https://placehold.co/600x400/020617/94a3b8?text=Landing+Page',
    technologies: ['HTML', 'CSS', 'Responsive Design'],
    sourceUrl: 'https://github.com/Yuyuwayu/Belajar'
  }
]);

const skills = ref([
  { name: 'HTML & CSS', iconUrl: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/html5/html5-original.svg' },
  { name: 'JavaScript', iconUrl: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/javascript/javascript-original.svg' },
  { name: 'Vue.js', iconUrl: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/vuejs/vuejs-original.svg' },
  { name: 'Python', iconUrl: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg' },
  { name: 'CodeIgniter', iconUrl: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/codeigniter/codeigniter-plain.svg' },
  { name: 'FastAPI', iconUrl: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/fastapi/fastapi-original.svg' },
  { name: 'Git', iconUrl: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/git/git-original.svg' }
]);

const socialLinks = ref([
  { name: 'GitHub', component: Github, url: 'https://github.com/Yuyuwayu' },
  { name: 'LinkedIn', component: Linkedin, url: 'https://www.linkedin.com/in/nanda-willy-atmaja-6b916333b/' }
]);

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
  // Most stars are deliberately unlinked. Only the fixed anchors below form
  // the handful of faint, stable constellation strokes.
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
    <main class="container mx-auto px-6 py-12 md:py-20">

      <div class="absolute top-6 right-6 z-20">
        <button @click="isDarkMode = !isDarkMode" class="p-2 rounded-full bg-surface/80 backdrop-blur-sm transition-colors duration-300 border border-card-border">
          <Sun v-if="isDarkMode" class="w-6 h-6 text-yellow-500" />
          <Moon v-else class="w-6 h-6 text-indigo-700" />
        </button>
      </div>

      <section id="home" class="relative isolate min-h-[80vh] flex items-center scroll-target">
        <div ref="heroCopy" class="relative z-10 max-w-3xl">
          <div class="text-2xl font-bold text-primary tracking-wider mb-8">
            {{ personalInfo.nama.split(' ')[0] }}<span class="text-accent">.</span>
          </div>
          <h2 class="text-accent font-semibold text-lg tracking-wide">{{ personalInfo.sapaan }}</h2>
          <h1 class="text-4xl md:text-6xl font-bold text-primary mt-2">{{ personalInfo.nama }}</h1>
          <h3 class="text-2xl md:text-4xl font-semibold text-secondary mt-3">{{ personalInfo.jabatan }}</h3>
          <p class="mt-6 text-lg text-secondary max-w-xl">
            {{ personalInfo.bio }}
          </p>
          <div class="mt-8 flex gap-4">
            <a href="#projects" @click.prevent="scrollTo('#projects')" class="bg-primary text-background hover:opacity-90 font-semibold px-8 py-3 rounded-lg shadow-lg transition-all duration-300 transform hover:scale-105 border border-accent">Lihat Proyek Saya</a>
            <a :href="personalInfo.cvUrl" target="_blank" class="bg-transparent border border-accent text-accent hover:bg-accent hover:text-white font-semibold px-8 py-3 rounded-lg shadow-lg transition-all duration-300">Unduh CV</a>
          </div>
        </div>
      </section>

      <section id="projects" class="py-20 scroll-target">
        <h2 class="text-3xl md:text-4xl font-bold text-primary text-center">
          <span class="text-accent">Proyek</span> yang Pernah Saya Buat
        </h2>
        <p class="text-center text-secondary mt-4 max-w-2xl mx-auto">Berikut adalah beberapa proyek pilihan yang menunjukkan keahlian dan minat saya.</p>
        <div class="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div v-for="project in projects" :key="project.title" class="bg-surface backdrop-blur-xl border border-card-border rounded-xl shadow-lg overflow-hidden transform hover:-translate-y-2 transition-all duration-300 group flex flex-col">
            <img :src="project.imageUrl" :alt="'Gambar ' + project.title" class="w-full h-48 object-cover group-hover:opacity-90 transition-opacity duration-300">
            <div class="p-6 flex flex-col flex-grow">
              <div class="flex-grow">
                <h3 class="text-xl font-bold text-primary">{{ project.title }}</h3>
                <p class="text-secondary mt-2 text-sm">{{ project.description }}</p>
                <div class="mt-4 flex flex-wrap gap-2">
                  <span v-for="tech in project.technologies" class="bg-chip-bg text-chip-text text-xs font-semibold px-2.5 py-1 rounded-full">{{ tech }}</span>
                </div>
              </div>
              <div v-if="project.sourceUrl" class="mt-auto pt-6 flex justify-end gap-4">
                <a :href="project.sourceUrl" target="_blank" class="text-secondary hover:text-accent transition-colors duration-300 flex items-center gap-2">
                  <Github class="w-4 h-4" /> Kode
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="skills" class="py-20 scroll-target">
        <h2 class="text-3xl md:text-4xl font-bold text-primary text-center">
          <span class="text-accent">Keterampilan</span> & Teknologi
        </h2>
        <p class="text-center text-secondary mt-4 max-w-2xl mx-auto">Saya memiliki pengalaman dengan berbagai teknologi modern.</p>
        <div class="mt-12 max-w-4xl mx-auto flex flex-wrap justify-center gap-6 md:gap-8">
          <div v-for="skill in skills" :key="skill.name" class="flex flex-col items-center gap-3 p-4 bg-surface backdrop-blur-xl border border-card-border rounded-xl w-28 h-28 justify-center transition-all duration-300 transform hover:scale-110">
            <img :src="skill.iconUrl" :alt="skill.name" class="w-10 h-10">
            <span class="text-primary font-medium text-sm text-center">{{ skill.name }}</span>
          </div>
        </div>
      </section>

      <section id="contact" class="py-20 text-center scroll-target">
        <h2 class="text-3xl md:text-4xl font-bold text-primary">
          Mari Terhubung!
        </h2>
        <p class="text-secondary mt-4 max-w-xl mx-auto">
          Saya selalu terbuka untuk diskusi, kolaborasi, atau peluang baru.
        </p>
        <div class="mt-8">
          <a :href="'mailto:' + personalInfo.email" class="inline-block bg-primary text-background hover:opacity-90 text-lg font-semibold px-10 py-4 rounded-lg shadow-lg transition-all duration-300 transform hover:scale-105 border border-accent">
            Hubungi Saya
          </a>
        </div>
        <div class="mt-10 flex justify-center gap-8">
          <a v-for="social in socialLinks" :key="social.name" :href="social.url" target="_blank" class="text-secondary hover:text-accent transition-colors duration-300">
            <component :is="social.component" class="w-8 h-8" />
          </a>
        </div>
      </section>

    </main>

    <footer class="border-t border-card-border">
      <div class="container mx-auto px-6 py-6 text-center text-slate-500">
        <p>&copy; {{ new Date().getFullYear() }} {{ personalInfo.nama }}. Dibuat dengan <Heart class="inline-block w-4 h-4 text-red-500 fill-current" /> menggunakan Vue.js.</p>
      </div>
    </footer>
  </div>
</template>
