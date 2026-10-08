import type { LocalizedString } from '../types/portfolio';

export const translations = {
  nav: {
    projects: { id: 'Proyek', en: 'Projects' },
    skills: { id: 'Keahlian', en: 'Skills' },
    contact: { id: 'Kontak', en: 'Contact' },
    themeDark: { id: 'Beralih ke mode terang', en: 'Switch to light mode' },
    themeLight: { id: 'Beralih ke mode gelap', en: 'Switch to dark mode' },
    switchLanguage: { id: 'Ganti bahasa', en: 'Switch language' }
  },
  hero: {
    greeting: { id: 'Halo, saya', en: 'Hello, I am' },
    role: { id: 'Junior Web Developer', en: 'Junior Web Developer' },
    bio: {
      id: 'Seorang mahasiswa dari Universitas Negeri Semarang yang bersemangat dalam dunia pengembangan web. Saya memiliki minat kuat pada pengembangan back-end dan front-end, dan selalu antusias untuk belajar teknologi baru serta berkontribusi dalam proyek-proyek yang menantang.',
      en: 'A student from Universitas Negeri Semarang who is passionate about web development. I have a strong interest in both back-end and front-end development, always eager to learn new technologies and contribute to challenging projects.'
    },
    viewProjects: { id: 'Lihat Proyek Saya', en: 'View My Projects' },
    downloadCv: { id: 'Unduh CV', en: 'Download CV' }
  },
  projects: {
    titlePrefix: { id: 'Proyek', en: 'Projects' },
    titleSuffix: { id: ' yang Pernah Saya Buat', en: ' I Have Built' },
    subtitle: {
      id: 'Berikut adalah beberapa proyek pilihan yang menunjukkan keahlian dan minat saya.',
      en: 'Here are selected projects showcasing my skills and technical interests.'
    },
    flagship: { id: 'Proyek Utama', en: 'Flagship' },
    sourceCode: { id: 'Kode', en: 'Code' }
  },
  skills: {
    titlePrefix: { id: 'Keterampilan', en: 'Skills' },
    titleSuffix: { id: ' & Teknologi', en: ' & Technologies' },
    subtitle: {
      id: 'Teknologi dan alat yang terbukti digunakan dalam proyek-proyek yang saya kembangkan.',
      en: 'Technologies and tools proven and applied in the projects I have developed.'
    }
  },
  contact: {
    title: { id: 'Mari Terhubung!', en: "Let's Connect!" },
    subtitle: {
      id: 'Saya selalu terbuka untuk diskusi, kolaborasi, atau peluang baru.',
      en: 'I am always open to discussions, collaborations, or new opportunities.'
    },
    button: { id: 'Hubungi Saya', en: 'Get In Touch' }
  },
  footer: {
    builtWith: { id: 'Dibuat dengan', en: 'Built with' },
    usingVue: { id: 'menggunakan Vue.js.', en: 'using Vue.js.' }
  }
} as const;

export const personalInfo = {
  nama: 'Nanda Willy Atmaja',
  email: 'Justturtle30@students.unnes.ac.id',
  cvUrl: 'https://drive.google.com/file/d/1LbcVmTRIcsnJLWUIXpECe6zi2pdWYbG3/view?usp=drive_link'
};
