import { PipelinePageClient } from "@/components/pipeline/pipeline-page-client";
import { getPipelineQualitySnapshot } from "@/lib/pipeline-quality";

export default async function PipelinePage() {
  const qualitySnapshot = await getPipelineQualitySnapshot();

  return <PipelinePageClient initialQualitySnapshot={qualitySnapshot} />;
}
