import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-paper text-center">
      <h1 className="font-display text-3xl">Page not found</h1>
      <p className="mt-2 text-sm text-ink-3">
        This thought drifted away.
      </p>
      <Link href="/home" className="mt-6 text-sm font-medium text-indigo-500 underline">
        Back to your mind
      </Link>
    </main>
  );
}
