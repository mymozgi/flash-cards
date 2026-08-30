"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTopic, deleteTopic, renameTopic, type TopicState } from "./actions";
import type { TopicNode } from "@/lib/types";

const initial: TopicState = { error: null };

export function TopicManager({ topics }: { topics: TopicNode[] }) {
  const [state, formAction, pending] = useActionState(createTopic, initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  const router = useRouter();

  const rename = (topic: TopicNode) => {
    const name = prompt("New topic name", topic.name);
    if (!name || name === topic.name) return;
    startTransition(async () => {
      const res = await renameTopic(topic.id, name);
      setError(res.error);
      if (!res.error) router.refresh();
    });
  };

  const remove = (topic: TopicNode) => {
    const withCards = confirm(
      `Delete “${topic.name}”.

OK — delete it with the cards in this branch.
Cancel — move cards and subtopics up to the parent.`,
    );
    startTransition(async () => {
      const res = await deleteTopic(topic.id, withCards ? "cascade" : "reparent");
      setError(res.error);
      if (!res.error) router.refresh();
    });
  };

  return (
    <>
      <form action={formAction} className="mt-6 flex flex-col gap-2 sm:flex-row">
        <input
          name="path"
          placeholder="Medicine / Anatomy / Upper limb"
          className="min-w-0 flex-1 rounded border border-line bg-surface px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-accent px-4 py-2 text-sm font-medium text-accent-ink disabled:opacity-60"
        >
          Create
        </button>
      </form>
      <p className="mt-2 text-xs text-faint">
        Missing levels are created automatically. Depth is limited to three levels.
      </p>

      {(state.error || error) && (
        <p role="alert" className="mt-3 rounded border-l-[3px] border-rust bg-rust-soft px-3 py-2 text-sm">
          {state.error ?? error}
        </p>
      )}

      {topics.length === 0 ? (
        <p className="mt-8 text-sm text-muted">No topics yet.</p>
      ) : (
        <ul className={`mt-6 divide-y divide-line rounded border border-line bg-surface ${busy ? "opacity-60" : ""}`}>
          {topics.map((topic) => (
            <li
              key={topic.id}
              className="flex items-center gap-3 py-2.5 pr-3 text-sm"
              style={{ paddingLeft: `${12 + topic.depth * 18}px` }}
            >
              <span className={`min-w-0 flex-1 truncate ${topic.depth === 0 ? "font-medium" : "text-muted"}`}>
                {topic.name}
              </span>
              <span className="font-mono text-xs tabular-nums text-faint">{topic.cardCount}</span>
              <button type="button" onClick={() => rename(topic)} className="text-faint hover:text-ink">
                Rename
              </button>
              <button type="button" onClick={() => remove(topic)} className="text-faint hover:text-rust">
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
