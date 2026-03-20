import Link from "next/link";

export default function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-light text-black/80 dark:text-white/80">
        Page not found
      </h1>
      <Link
        href="/"
        className="text-sm text-black/40 hover:text-black/70 dark:text-white/40 dark:hover:text-white/70"
      >
        Back to docs
      </Link>
    </div>
  );
}
