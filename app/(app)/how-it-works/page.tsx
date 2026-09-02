import Link from "next/link";
import { Panel } from "@/components/ui/panel";
import { LinkButton } from "@/components/ui/button";

/**
 * Раздел «Как это работает».
 *
 * Тексты намеренно сдержанны: обещать «запомните навсегда» легко, но это
 * враньё. Каждое утверждение здесь либо описывает поведение приложения,
 * либо опирается на работу, названную в конце страницы.
 */
export const metadata = {
  title: "How it works — Memorizer",
  description: "Why testing yourself and spacing reviews beats re-reading, and what this app does about it.",
};

const STUDIES = [
  {
    what: "Forgetting has a shape",
    who: "Hermann Ebbinghaus, 1885 · Über das Gedächtnis",
    finding:
      "The first systematic memory experiments. Recall of new material drops steeply within hours and days, then flattens. Forgetting is not random — it follows a curve, which means it can be anticipated.",
  },
  {
    what: "Spacing beats cramming",
    who: "Cepeda, Pashler, Vul, Wixted & Rohrer, 2006 · Psychological Bulletin",
    finding:
      "A meta-analysis of hundreds of experiments on distributed practice. The same total study time, split across separate sessions, produces substantially better retention than one continuous block.",
  },
  {
    what: "The gap should grow with the horizon",
    who: "Cepeda et al., 2008 · Psychological Science",
    finding:
      "The best interval is not fixed: it scales with how long you need to remember. Wanting recall months from now calls for wider gaps than wanting it next week.",
  },
  {
    what: "Retrieving is the learning, not the test",
    who: "Roediger & Karpicke, 2006 · Psychological Science",
    finding:
      "Students who tested themselves outperformed those who re-read the same material — despite feeling less confident. Pulling an answer out of memory strengthens it more than seeing it again.",
  },
  {
    what: "Two techniques out of ten actually earned a high rating",
    who: "Dunlosky, Rawson, Marsh, Nathan & Willingham, 2013 · Psychological Science in the Public Interest",
    finding:
      "A review of ten popular study techniques. Practice testing and distributed practice came out on top; highlighting, re-reading and summarising did not.",
  },
  {
    what: "Difficulty that helps",
    who: "Robert & Elizabeth Bjork, 1992 · A new theory of disuse",
    finding:
      "Memory has two strengths: how well something is stored, and how easily it comes to mind right now. Effortful recall — retrieving something you almost forgot — is what raises storage strength. Easy review feels productive and does little.",
  },
  {
    what: "Pictures are remembered better than words",
    who: "Allan Paivio, dual-coding theory, from 1971 onward",
    finding:
      "Material encoded both verbally and visually has two routes to retrieval instead of one. This is why a diagram on the card is not decoration.",
  },
];

export default function HowItWorksPage() {
  return (
    <>
      <header className="border-b border-line pb-5">
        <p className="label-micro">How it works</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          Why this beats reading the same page again
        </h1>
        <p className="mt-3 max-w-prose text-muted">
          Two findings from memory research carry almost all the weight here: you remember what you
          retrieve, and you remember longer when reviews are spread out. Everything the app does is
          an attempt to make those two things cheap enough to happen daily.
        </p>
      </header>

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          {
            step: "1",
            title: "You see a question",
            body: "Only the front of the card. No answer in the corner of your eye — that is why the card flips rather than expands.",
          },
          {
            step: "2",
            title: "You try to recall",
            body: "This is the part that does the work. The effort of retrieval is what strengthens the memory, not the reading that follows.",
          },
          {
            step: "3",
            title: "You grade honestly",
            body: "Four buttons, from “Again” to “Easy”. The grade tells the scheduler how close the card is to being forgotten.",
          },
        ].map((item) => (
          <Panel key={item.step} className="p-4">
            <span className="inline-flex size-7 items-center justify-center rounded-lg bg-accent-soft text-sm font-semibold text-accent">
              {item.step}
            </span>
            <h2 className="mt-3 font-semibold">{item.title}</h2>
            <p className="mt-1.5 text-sm text-muted">{item.body}</p>
          </Panel>
        ))}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold tracking-tight">What the scheduler is doing</h2>
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          <Panel className="p-4 sm:p-5">
            <h3 className="font-semibold">It aims at a target, not a calendar</h3>
            <p className="mt-2 text-sm text-muted">
              The app uses FSRS. For every card it keeps two numbers: <strong>stability</strong> —
              how long the memory holds — and <strong>difficulty</strong> — how hard this
              particular card is for you. From those it estimates the moment your chance of
              recalling it drops to the retention target, and schedules the review there.
            </p>
            <p className="mt-2 text-sm text-muted">
              The default target is 0.90. Raise it and you review more often and forget less; lower
              it and you save time at the cost of more failures. It is a dial in{" "}
              <Link href="/settings" className="text-accent underline underline-offset-4">
                Settings
              </Link>
              , not a hidden constant.
            </p>
          </Panel>

          <Panel className="p-4 sm:p-5">
            <h3 className="font-semibold">Why the interval jumps around</h3>
            <p className="mt-2 text-sm text-muted">
              A card you answer easily moves far into the future — there is no value in showing it
              tomorrow. A card you fail comes back within minutes and then restarts with short
              gaps. Growth is not a fixed multiplier; each grade updates the estimate.
            </p>
            <p className="mt-2 text-sm text-muted">
              This is why an empty queue is a result, not a bug. If nothing is due, the schedule
              says nothing is close to being forgotten yet.
            </p>
          </Panel>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold tracking-tight">Where the ideas come from</h2>
        <p className="mt-1.5 max-w-prose text-sm text-muted">
          Listed by author, year and journal rather than by link, so you can look them up yourself
          rather than take this page&rsquo;s word for it.
        </p>
        <ul className="mt-4 flex flex-col gap-3">
          {STUDIES.map((study) => (
            <li key={study.what}>
              <Panel className="p-4">
                <h3 className="font-semibold">{study.what}</h3>
                <p className="mt-0.5 label-micro">{study.who}</p>
                <p className="mt-2 text-sm text-muted">{study.finding}</p>
              </Panel>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold tracking-tight">What this will not do for you</h2>
        <Panel className="mt-3 p-4 sm:p-5">
          <ul className="flex list-disc flex-col gap-2 pl-5 text-sm text-muted">
            <li>
              <strong className="text-ink">It does not replace understanding.</strong> Spaced
              repetition keeps what you already understood. A card holding a definition you never
              grasped becomes a phrase you can recite and cannot use.
            </li>
            <li>
              <strong className="text-ink">It does not survive a skipped month.</strong> The
              schedule assumes you show up. Miss long enough and the queue turns into a backlog
              that feels like punishment.
            </li>
            <li>
              <strong className="text-ink">Bad cards stay bad.</strong> Two ideas on one side, or an
              answer that is a paragraph, will keep failing no matter how clever the scheduler is.
              One card, one thing.
            </li>
            <li>
              <strong className="text-ink">The scheduler starts generic.</strong> FSRS ships with
              default weights. They are reasonable averages, not a model of your memory — that
              would need a long history of your own reviews.
            </li>
          </ul>
        </Panel>
      </section>

      <div className="mt-8 flex flex-wrap gap-2">
        <LinkButton href="/review" tone="primary" size="lg">
          Start reviewing
        </LinkButton>
        <LinkButton href="/decks" size="lg">
          Browse sets
        </LinkButton>
      </div>
    </>
  );
}
