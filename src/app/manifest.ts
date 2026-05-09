import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'たすくま Web - タスクシュート式タスク管理',
    short_name: 'たすくま',
    description:
      'タスクシュート式のタスク・時間管理Webアプリ。AIによるタスク提案機能付き。',
    start_url: '/',
    display: 'standalone',
    background_color: '#fef3c7',
    theme_color: '#f59e0b',
    orientation: 'portrait',
    lang: 'ja',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icon.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
      {
        src: '/apple-icon.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  };
}
