"use client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-800">
        <h1 className="text-xl font-bold">Unable to complete this screen action</h1>
        <p className="mt-2 text-sm">
          The app hit an unexpected error while loading or saving this page. Try again, and share the digest with support if it repeats.
        </p>
        {error.digest && <p className="mt-2 text-sm font-semibold">Digest: {error.digest}</p>}
        <button className="btn mt-4" onClick={reset}>Try Again</button>
      </div>
    </main>
  );
}
