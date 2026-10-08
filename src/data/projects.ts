import type { Project } from '../types/portfolio';

export const projects: Project[] = [
  {
    title: 'MyShuttle UNNES',
    description: {
      id: 'Sistem pemantauan shuttle kampus full-stack untuk melacak rute shuttle, lokasi shuttle, halte terdekat, dan okupansi penumpang. Laravel mendukung aplikasi lengkap, sementara Python menjalankan model YOLOv8n yang dilatih khusus untuk deteksi penumpang.',
      en: 'Full-stack campus shuttle monitoring system for tracking shuttle routes, shuttle locations, nearby stops, and passenger occupancy. Laravel powers the full application, while Python runs a custom-trained YOLOv8n model for passenger detection.'
    },
    imageUrl: '/projects/myshuttle-unnes.webp',
    technologies: ['Laravel', 'Python', 'YOLOv8n', 'Leaflet'],
    imageAlt: {
      id: 'Pratinjau sistem pemantauan MyShuttle UNNES',
      en: 'MyShuttle UNNES monitoring system preview'
    },
    mediaFit: 'cover'
  },
  {
    title: 'Doremi',
    description: {
      id: 'Aplikasi bertenaga AI yang dibangun dengan Laravel dan Retrieval-Augmented Generation (RAG).',
      en: 'AI-powered application built with Laravel and Retrieval-Augmented Generation (RAG).'
    },
    imageUrl: '/projects/doremi.gif',
    technologies: ['Laravel', 'RAG'],
    imageAlt: {
      id: 'Pratinjau aplikasi Doremi',
      en: 'Doremi application preview'
    },
    mediaFit: 'contain'
  },
  {
    title: 'WhatsApp Bot',
    description: {
      id: 'Bot WhatsApp yang dibangun sepenuhnya dengan Laravel, menggunakan WhatsApp API resmi untuk pengiriman pesan dan otomasi berbasis webhook.',
      en: 'WhatsApp bot built entirely with Laravel, using the official WhatsApp API for webhook-based messaging and automation.'
    },
    imageUrl: '/projects/whatsapp-bot.gif',
    technologies: ['Laravel', 'WhatsApp API', 'Webhook'],
    imageAlt: {
      id: 'Pratinjau aplikasi WhatsApp Bot',
      en: 'WhatsApp Bot application preview'
    },
    mediaFit: 'contain'
  },
  {
    title: 'Presensi',
    description: {
      id: 'Sistem presensi pengenalan wajah yang dibangun dengan FastAPI dan FaceNet, dengan frontend HTML, CSS, dan JavaScript murni.',
      en: 'Face recognition attendance system built with FastAPI and FaceNet, with a pure HTML, CSS, and JavaScript frontend.'
    },
    imageUrl: '/projects/presensi.webp',
    technologies: ['FastAPI', 'FaceNet', 'HTML', 'CSS', 'JavaScript'],
    imageAlt: {
      id: 'Pratinjau sistem presensi pengenalan wajah',
      en: 'Face recognition attendance system preview'
    },
    mediaFit: 'cover'
  },
  {
    title: 'Webnovel Scraper',
    description: {
      id: 'Alat scraping Webnovel berbasis Python yang dibangun dengan Playwright, dilengkapi tampilan scraping khusus, hasil ekstraksi, dan skrip sumber.',
      en: 'Python-based Webnovel scraping tool built with Playwright, with a dedicated scraping view, extracted results, and the source script.'
    },
    imageUrl: '/projects/webnovel-scraper.gif',
    technologies: ['Python', 'Playwright'],
    imageAlt: {
      id: 'Pratinjau alat scraping Webnovel',
      en: 'Webnovel scraping tool preview'
    },
    mediaFit: 'cover'
  }
];
