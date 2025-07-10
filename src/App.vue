<script setup>
import { ref, onMounted, computed, watchEffect, watch } from 'vue';
import { tsParticles } from '@tsparticles/engine';
import { loadSlim } from '@tsparticles/slim';
import { Github, Linkedin, Twitter, ExternalLink, Heart, Sun, Moon } from 'lucide-vue-next';

const particlesContainer = ref(null);
const isDarkMode = ref(true);

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
  cvUrl: '#'
});

const projects = ref([
  {
    title: 'Web Monitoring IoT',
    description: 'Sistem monitoring berbasis web menggunakan ESP32 sebagai mikrokontroler, dengan Vue.js untuk front-end dan Fastapi untuk back-end.',
    imageUrl: 'https://placehold.co/600x400/020617/94a3b8?text=Proyek+IoT',
    technologies: ['Vue.js', 'FastAPI', 'Python', 'ESP32'],
    liveUrl: '#',
    sourceUrl: '#'
  },
  {
    title: 'Dashboard Admin Sederhana',
    description: 'Membuat dashboard admin yang fungsional dan responsif untuk manajemen data menggunakan CodeIgniter 4.',
    imageUrl: 'https://placehold.co/600x400/020617/94a3b8?text=Dashboard+Admin',
    technologies: ['CodeIgniter 4', 'PHP', 'Bootstrap', 'MySQL'],
    liveUrl: '#',
    sourceUrl: '#'
  },
  {
    title: 'Desain Landing Page',
    description: 'Mendesain dan membangun landing page yang menarik dan responsif dari awal menggunakan HTML dan CSS murni.',
    imageUrl: 'https://placehold.co/600x400/020617/94a3b8?text=Landing+Page',
    technologies: ['HTML', 'CSS', 'Responsive Design'],
    liveUrl: '#',
    sourceUrl: '#'
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
  { name: 'GitHub', component: Github, url: '#' },
  { name: 'LinkedIn', component: Linkedin, url: '#' }
]);

const particleOptions = computed(() => ({
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
      grab: { distance: 140, line_linked: { opacity: 0.5 } }
    }
  },
  particles: {
    color: {
      value: isDarkMode.value ? '#4f46e5' : '#4338ca'
    },
    links: {
      color: isDarkMode.value ? '#38bdf8' : '#2563eb',
      distance: 150,
      enable: true,
      opacity: 0.2,
      width: 1
    },
    move: {
      direction: 'none',
      enable: true,
      outModes: { default: 'bounce' },
      random: true,
      speed: 1,
      straight: false
    },
    number: {
      density: { enable: true, area: 800 },
      value: 60
    },
    opacity: { value: 0.5 },
    shape: { type: 'circle' },
    size: { value: { min: 1, max: 5 } }
  },
  detectRetina: true
}));

const loadParticles = (options) => {
  if (particlesContainer.value) {
    tsParticles.load({
      id: 'tsparticles',
      element: particlesContainer.value,
      options: options,
    });
  }
};

const scrollTo = (selector) => {
  const element = document.querySelector(selector);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth' });
  }
};

watch(particleOptions, (newOptions) => {
  loadParticles(newOptions);
});

onMounted(async () => {
  const savedTheme = localStorage.getItem('isDarkMode');
  isDarkMode.value = savedTheme !== null ? JSON.parse(savedTheme) : true;

  await loadSlim(tsParticles);
  loadParticles(particleOptions.value);

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

</script>

<template>
  <div ref="particlesContainer" id="tsparticles" class="fixed w-full h-full top-0 left-0 -z-10"></div>

  <div class="relative z-10 text-secondary">
    <main class="container mx-auto px-6 py-12 md:py-20">

      <section id="home" class="min-h-[80vh] flex items-center scroll-target">
        <div class="absolute top-6 right-6">
          <button @click="isDarkMode = !isDarkMode" class="p-2 rounded-full bg-surface/80 backdrop-blur-sm transition-colors duration-300 border border-card-border">
            <Sun v-if="isDarkMode" class="w-6 h-6 text-yellow-500" />
            <Moon v-else class="w-6 h-6 text-indigo-700" />
          </button>
        </div>
        <div class="max-w-3xl">
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
              <div class="mt-auto pt-6 flex justify-end gap-4">
                <a :href="project.liveUrl" target="_blank" class="text-secondary hover:text-accent transition-colors duration-300 flex items-center gap-2">
                  <ExternalLink class="w-4 h-4" /> Live Demo
                </a>
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
