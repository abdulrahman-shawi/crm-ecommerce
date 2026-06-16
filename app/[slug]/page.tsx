import { getPageBySlug, getPublishedPages } from '@/server/page';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';

interface PageProps {
  params: { slug: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const res = await getPageBySlug(params.slug);

  if (!res.success || !res.data) {
    return {
      title: 'الصفحة غير موجودة',
    };
  }

  const page = res.data;

  return {
    title: page.metaTitle || page.title,
    description: page.metaDescription || page.title,
  };
}

export async function generateStaticParams() {
  const res = await getPublishedPages();
  if (!res.success || !res.data) return [];

  return res.data.map((page: any) => ({
    slug: page.slug,
  }));
}

export default async function StaticPage({ params }: PageProps) {
  const res = await getPageBySlug(params.slug);

  if (!res.success || !res.data) {
    notFound();
  }

  const page = res.data;

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 py-12 px-4 sm:px-6 lg:px-8" dir="rtl">
      <article className="max-w-4xl mx-auto bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="p-8 sm:p-12">
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white mb-8 text-right">
            {page.title}
          </h1>

          <div
            className="prose prose-lg dark:prose-invert max-w-none text-right text-slate-700 dark:text-slate-300
              prose-headings:text-right prose-p:text-right prose-ul:text-right prose-ol:text-right
              [&_ul]:pr-6 [&_ol]:pr-6 [&_li]:marker:text-blue-600"
            dangerouslySetInnerHTML={{ __html: page.content }}
          />
        </div>
      </article>
    </main>
  );
}
