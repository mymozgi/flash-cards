"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Grade } from "ts-fsrs";
import { fromFsrsCard, scheduler, toFsrsCard } from "@/lib/fsrs";
import { renderMarkdown } from "@/lib/markdown";
import { hostLabel, safeUrl } from "@/lib/url";
import type { QueueCard } from "@/lib/types";
import { CARD_MAX_HEIGHT, CardRenderer, cardFrameStyle } from "@/components/card-renderer";
import { Button, LinkButton } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Classification } from "@/components/ui/classification";
import { ArrowLeftIcon, ArrowRightIcon, CloseIcon, FlipIcon } from "@/components/icons";
import {
  nextSpan,
  queueAfterGrade,
  queueAfterSkip,
  RELEARN_HORIZON_MS,
  SKIP_LIMIT,
} from "@/lib/session";
import { gradeCard, undoReview, type GradeResult } from "./actions";

type HistoryEntry = { card: QueueCard; pending: Promise<GradeResult>; relearn: boolean };

export function ReviewSession({
  initialQueue,
  requestRetention,
  free,
}: {
  initialQueue: QueueCard[];
  requestRetention: number;
  free: boolean;
}) {
  const [queue, setQueue] = useState(initialQueue);
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(0);
  /**
   * Знаменатель полосы прогресса. Не `done + queue.length`, потому что очередь
   * растёт: проваленная карточка возвращается в эту же сессию. Здесь копится
   * наибольшая работа, какую сессия себя показала, — так полоса не дёргается
   * от каждого провала.
   */
  const [span, setSpan] = useState(initialQueue.length);
  /** Часть уже сделанного, что пришлось переучивать. Рисуется янтарным. */
  const [lapses, setLapses] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const history = useRef<HistoryEntry[]>([]);
  // заполняется эффектом при показе карточки: Date.now() в теле рендера — нечистый вызов
  const shownAt = useRef(0);

  const current = queue[0];

  useEffect(() => {
    shownAt.current = Date.now();
  }, [current?.card.id, revealed]);

  /** Полосу нужно не только видеть: без этого скринридер скажет «графика». */
  const progressLabel = useMemo(
    () =>
      lapses > 0
        ? `${done} of ${span} cards graded, ${lapses} sent back to relearn`
        : `${done} of ${span} cards graded`,
    [done, lapses, span],
  );

  const frontHtml = useMemo(
    () => (current ? renderMarkdown(current.card.front_md) : ""),
    [current],
  );
  const backHtml = useMemo(() => (current ? renderMarkdown(current.card.back_md) : ""), [current]);
  const noteHtml = useMemo(
    () => (current?.card.note_md ? renderMarkdown(current.card.note_md) : ""),
    [current],
  );

  const sourceUrl = useMemo(() => safeUrl(current?.card.link_url), [current]);
  const sourceHost = useMemo(() => hostLabel(current?.card.link_url), [current]);

  const frontMedia = useMemo(
    () => (current?.media ?? []).filter((m) => m.side === "front"),
    [current],
  );
  const backMedia = useMemo(
    () => (current?.media ?? []).filter((m) => m.side === "back"),
    [current],
  );

  // Изображения двух следующих карточек подгружаются заранее (NFR-3),
  // иначе после оценки экран моргает пустым местом
  useEffect(() => {
    for (const next of queue.slice(1, 3)) {
      for (const image of next.media) {
        const preload = new Image();
        preload.src = image.url;
      }
    }
  }, [queue]);

  /**
   * Применение оценки. Сейчас ничем не вызывается: кнопки оценок убраны по
   * решению владельца продукта.
   *
   * Оставлено намеренно и на виду, а не удалено. Это единственная точка,
   * через которую карточка двигается по расписанию: вместе с ней пришлось бы
   * выкинуть обёртку над FSRS, правила очереди и запись истории — то есть
   * весь механизм, который в том же решении велено было сохранить. Вернуть
   * оценки — значит снова позвать эту функцию из разметки, и больше ничего.
   */
  const grade = useCallback(
    (rating: Grade) => {
      if (!current) return;
      const now = new Date();
      const { card: after } = scheduler(requestRetention).next(
        toFsrsCard(current.scheduling),
        now,
        rating,
      );
      const nextScheduling = { ...current.scheduling, ...fromFsrsCard(current.card.id, after) };

      // Оптимистично: интерфейс не ждёт сервера (NFR-2), но истина — ответ действия
      const pending = gradeCard(current.card.id, rating, Date.now() - shownAt.current);
      pending.then((res) => {
        if (!res.ok) setError(res.error);
      });
      const dueIn = new Date(nextScheduling.due).getTime() - now.getTime();
      const relearn = !free && dueIn < RELEARN_HORIZON_MS;
      history.current.push({ card: current, pending, relearn });

      setQueue((prev) => queueAfterGrade(prev, relearn, { ...current, scheduling: nextScheduling }));
      setRevealed(false);
      setDone((d) => d + 1);
      // Карточка вернулась — работы в сессии стало на одну больше, и эта одна
      // честно помечена как повторная
      if (relearn) {
        setSpan((n) => nextSpan(n, done, "relearn"));
        setLapses((n) => n + 1);
      }
    },
    [current, done, free, requestRetention],
  );

  /**
   * Пропуск: карточка уезжает в конец очереди без оценки. Расписание при этом
   * не трогается вовсе — в том и смысл: «сейчас не хочу» не то же самое, что
   * «не помню», и алгоритму об этом знать нечего.
   */
  const skips = useRef(new Map<string, number>());
  const skip = useCallback(() => {
    if (!current || queue.length < 2) return;
    const times = (skips.current.get(current.card.id) ?? 0) + 1;
    skips.current.set(current.card.id, times);
    const drop = times >= SKIP_LIMIT;
    setQueue((prev) => queueAfterSkip(prev, times));
    // выбывшая карточка перестаёт быть работой этой сессии — иначе полоса
    // никогда не дойдёт до конца
    if (drop) setSpan((n) => nextSpan(n, done, "skip-drop"));
    setRevealed(false);
  }, [current, done, queue.length]);

  const undo = useCallback(async () => {
    const last = history.current.pop();
    if (!last) return;
    const res = await last.pending;
    if (res.ok) {
      const undone = await undoReview(res.reviewId);
      if (!undone.ok) {
        setError(undone.error ?? "Could not undo");
        return;
      }
    }
    setQueue((prev) => [last.card, ...prev.filter((c) => c.card.id !== last.card.card.id)]);
    setRevealed(false);
    setDone((d) => Math.max(0, d - 1));
    // `span` не уменьшаем: это отметка наибольшей работы, а не текущий счёт
    if (last.relearn) setLapses((n) => Math.max(0, n - 1));
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && ["INPUT", "TEXTAREA"].includes(event.target.tagName))
        return;
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        if (!revealed) setRevealed(true);
        return;
      }
      if (
        event.key.toLowerCase() === "z" ||
        event.key.toLowerCase() === "я" ||
        event.key === "ArrowLeft"
      ) {
        event.preventDefault();
        void undo();
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        skip();
        return;
      }
      // Клавиши 1–4 больше не оценивают: кнопок нет, и невидимая оценка
      // по случайному нажатию хуже видимой кнопки.
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [revealed, skip, undo]);

  // Ссылка на неиспользуемый сейчас механизм: см. комментарий у `grade`.
  void grade;

  /*
    Свайпа здесь больше нет, и это осознанный отказ от §11 спеки.
    Причина появилась вместе со стрелками: вправо стрелка откладывает
    карточку, а свайп вправо ставил оценку «Хорошо» — одно направление,
    два несовместимых смысла на одном экране. Развести их подписями значит
    объяснять противоречие, а не убирать его.
    Выбран смысл, который работает везде: горизонтальный жест перемещает по
    карточкам, и живёт он там, где есть куда перемещаться, — в просмотре
    набора. Оценка ставится кнопками и клавишами 1–4. Побочная выгода
    измерима: случайный жест больше не может записать оценку в расписание,
    а отменять её потом дороже, чем поставить.
  */

  if (!current) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          {free ? "Practice finished" : "Session finished"}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {done > 0 ? `Cards graded: ${done}` : "Nothing is due right now"}
        </p>

        {/* Пустая очередь — это не тупик: расписание отодвинуло карточки вперёд,
            но повторить их вне расписания можно в любой момент. */}
        {!free && (
          <p className="mt-4 text-sm text-muted">
            Cards you graded moved into the future — that is what spaced repetition does. To go
            through them again anyway, use free practice: it ignores the schedule and leaves it
            untouched.
          </p>
        )}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          {!free && (
            <LinkButton href="/review?free=1" tone="primary" size="lg">
              Practice again
            </LinkButton>
          )}
          <LinkButton href="/" tone={free ? "primary" : "secondary"} size="lg">
            Back to Today
          </LinkButton>
          <LinkButton href="/decks" size="lg">
            Browse decks
          </LinkButton>
          {done > 0 && (
            <Button size="lg" onClick={() => void undo()}>
              Back to the last card
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    /*
      svh, а не dvh. Динамическая высота меняется вместе с адресной строкой
      браузера, и в её наибольшем значении столбец оказывался выше экрана —
      под содержимым появлялась пустая полоса, в которую можно прокрутить и
      ничего там не найти. svh берёт наименьшую высоту, и такой полосы нет
      ни в одном состоянии браузера.
    */
    <div className="flex min-h-[calc(100svh-8rem)] flex-col">
      <div className="flex items-center justify-between gap-3 pb-2.5">
        <div className="flex min-w-0 items-center gap-2">
          {/*
            Выход из сессии. Без него экран повторения был тупиком: боковое
            меню на телефоне скрыто за гамбургером, а на широком экране взгляд
            держится на карточке, и «как отсюда уйти» становится вопросом.

            Подтверждения нет намеренно: оценки записываются сразу, и уйти
            на середине ничего не теряет. Спрашивать «точно уйти?» там, где
            терять нечего, — это обучать не читать подтверждения.
          */}
          <LinkButton
            href="/"
            tone="ghost"
            size="icon"
            aria-label="Leave the session"
            title="Leave — everything you graded is already saved"
          >
            <CloseIcon />
          </LinkButton>
          {/* Классификация вместо пути строкой: две подписи читаются быстрее,
              чем «Medicine / Pharmacology» мелким моноширинным */}
          <Classification path={current.topicPath} className="min-w-0" />
        </div>
        <span className="label-micro shrink-0 tabular-nums">
          {done} / {span}
        </span>
      </div>
      <Progress
        value={done}
        max={span}
        warn={lapses}
        label={progressLabel}
      />

      {error && (
        <p role="alert" className="mt-3 rounded border-l-[3px] border-rust bg-rust-soft px-3 py-2 text-sm">
          {error}
        </p>
      )}

      <div className="flip-scene flex flex-1 flex-col items-center justify-center gap-4 py-5">
        {/* Клик по полотну переворачивает карточку. Это div, а не button:
            внутри лежат кнопки изображений, а кнопку в кнопку вкладывать нельзя. */}
        {/*
          Ширина считается из допустимой высоты, а не наоборот. Прежде здесь
          стояли `w-full` и `maxHeight`, и пропорция ломалась: `aspect-ratio`
          при заданной ширине не уменьшает её из-за потолка высоты — он просто
          обрезает высоту, и карточка 2:3 выходила пейзажем.

          `shrink-0` нужен по той же причине с другой стороны: рамка лежит в
          колоночном флексе и по умолчанию сжималась, когда снизу разворачивался
          ряд оценок, — отсюда и скачок высоты при перевороте.
        */}
        <div
          role="button"
          tabIndex={0}
          aria-label={revealed ? "Show the question" : "Show the answer"}
          onClick={() => setRevealed((r) => !r)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setRevealed((r) => !r);
            }
          }}
          className="mx-auto max-w-2xl shrink-0 cursor-pointer"
          style={cardFrameStyle(current.card.shape, CARD_MAX_HEIGHT)}
        >
          <div className="flip-inner" data-flipped={revealed}>
            {/* обе грани рисует тот же компонент, что и предпросмотр в редакторе */}
            {/* onImageClick не передаётся намеренно: в повторении нажатие по
                любой части полотна переворачивает карточку. Лупа перехватывала
                этот клик на изображении — то есть на всей карточке, если
                раскладка «во всё полотно». Рассматривать картинку можно в
                просмотре набора, где переворота нет и клик свободен. */}
            <CardRenderer
              fill
              className="flip-face flip-face--front"
              shape={current.card.shape}
              layout={current.card.layout}
              imagePosition={current.card.image_position}
              html={frontHtml}
              images={frontMedia}
            />
            <CardRenderer
              fill
              className="flip-face flip-face--back"
              shape={current.card.shape}
              layout={current.card.layout}
              imagePosition={current.card.image_position}
              html={backHtml + noteHtml}
              images={backMedia}
            />
          </div>
        </div>

        {/*
          Источник живёт под полотном, а не на нём. На полотне ссылка
          перехватывала бы нажатие, которое переворачивает карточку, — а
          переворот здесь главное действие. Открывается в новой вкладке, чтобы
          сессия не потерялась.
        */}
        {sourceUrl && (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => event.stopPropagation()}
            className="mt-5 inline-flex max-w-full items-center gap-1.5 text-sm text-accent hover:underline"
          >
            <span className="label-micro shrink-0 text-accent">Source</span>
            <span className="truncate">{sourceHost}</span>
          </a>
        )}

      </div>

      {/*
        Оценок здесь больше нет — решение владельца продукта. Кнопки убраны
        из интерфейса, но расписание, FSRS и история повторений остались в
        базе нетронутыми: в том же задании сказано не менять модель данных
        без нужды, и так решение обратимо одной правкой этого блока.

        Следствие назвать надо прямо: пока оценок нет, карточка не двигается
        по расписанию. Очередь «на сегодня» не убывает, прогресс усвоения не
        растёт, и экран стал перелистыванием того, что подошло к сроку.
      */}
      <div className="sticky bottom-4 flex flex-col gap-2 sm:bottom-6">
        <div className="flex items-center justify-center gap-2">
          <Button
            size="icon"
            onClick={() => void undo()}
            disabled={done === 0}
            aria-label="Back — previous card"
            title="Previous card"
          >
            <ArrowLeftIcon />
          </Button>
          <Button tone="soft" onClick={() => setRevealed((r) => !r)} className="min-w-48">
            <FlipIcon />
            {revealed ? "Show the question" : "Flip the card"}
          </Button>
          <Button
            size="icon"
            onClick={skip}
            disabled={queue.length < 2}
            aria-label="Next card"
            title="Next card"
          >
            <ArrowRightIcon />
          </Button>
        </div>
      </div>
    </div>
  );
}
