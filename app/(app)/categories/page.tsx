import Link from "next/link";

export default function CategoriesPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center">
      <h1 className="font-display text-2xl">Categories</h1>
      <p className="mt-2 text-sm text-ink-3">Coming soon.</p>
      <Link href="/home" className="mt-4 text-sm text-indigo-500 underline">
        Back to Home
      </Link>
    </main>
  );
}
