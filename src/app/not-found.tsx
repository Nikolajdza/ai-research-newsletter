import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <p className="text-5xl font-semibold text-accent">404</p>
      <p className="mt-3 text-lg font-medium">This page drifted out of the loop.</p>
      <Link href="/" className="mt-6 inline-block rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white">
        Back to Home
      </Link>
    </div>
  );
}
