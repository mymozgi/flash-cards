import { getQueue, getSettings } from "@/lib/data";
import { ReviewSession } from "./session";

export default async function ReviewPage(props: {
  searchParams: Promise<{ free?: string; topic?: string; tag?: string }>;
}) {
  const params = await props.searchParams;
  const free = params.free === "1";
  const settings = await getSettings();

  const queue = await getQueue(settings, {
    ignoreSchedule: free,
    topicIds: params.topic ? [params.topic] : undefined,
    tagIds: params.tag ? [params.tag] : undefined,
    limit: free ? 500 : undefined,
  });

  return (
    <ReviewSession
      initialQueue={queue}
      requestRetention={settings.request_retention}
      free={free}
    />
  );
}
