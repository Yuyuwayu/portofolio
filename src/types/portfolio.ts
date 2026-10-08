export type Language = 'id' | 'en';

export interface LocalizedString {
  id: string;
  en: string;
}

export interface Project {
  title: string;
  description: LocalizedString;
  technologies: string[];
  imageUrl: string;
  imageAlt: LocalizedString;
  mediaFit?: 'contain' | 'cover';
  sourceUrl?: string;
}

export interface SkillItem {
  name: string;
  iconUrl?: string;
  iconName?: string;
}

export interface SkillCategory {
  id: string;
  title: LocalizedString;
  skills: SkillItem[];
}

export interface PersonalInfo {
  nama: string;
  jabatan: LocalizedString;
  sapaan: LocalizedString;
  bio: LocalizedString;
  email: string;
  cvUrl: string;
}
