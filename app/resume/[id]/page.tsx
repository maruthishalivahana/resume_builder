import { redirect } from "next/navigation";

export default async function ResumeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolved = await params;
  redirect(`/resume/${resolved.id}/overview`);
}
