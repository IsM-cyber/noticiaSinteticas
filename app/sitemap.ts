import { MetadataRoute } from 'next';
import { loadNews } from '@/lib/stories';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const data = await loadNews();
  const stories = data.stories;

  return [
    {
      url: 'https://noticiasinteticas.vercel.app',
      lastModified: new Date(data.generated_at),
      changeFrequency: 'hourly',
      priority: 1,
    },
    ...stories.map((story) => ({
      url: `https://noticiasinteticas.vercel.app/news/${story.key}`, // Asumiendo que vamos a implementar rutas dinámicas, o usando el link principal
      lastModified: new Date(story.first_seen),
      changeFrequency: 'daily' as const,
      priority: 0.8,
    })),
  ];
}
