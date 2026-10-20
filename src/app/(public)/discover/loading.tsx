import { PageSkeleton } from "@/components/ui/layout";

export default function DiscoverLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageSkeleton />
    </div>
  );
}