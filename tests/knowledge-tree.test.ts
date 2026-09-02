import { describe, expect, it } from "vitest";
import {
  isStudySet,
  kindInEffect,
  branchOf,
  canDrop,
  depthOf,
  hierarchyEdges,
  placeAfterDrop,
  type TreeNode,
} from "@/lib/knowledge-tree";

/*
  Psychology
  ├── Self-Coaching
  ├── Habits
  └── Cognitive Biases
      ├── Hindsight Bias
      └── Confirmation Bias
  Economics
  └── Microeconomics
*/
const tree: TreeNode[] = [
  { id: "psy", parentId: null, position: 0 },
  { id: "coach", parentId: "psy", position: 0 },
  { id: "habits", parentId: "psy", position: 1 },
  { id: "bias", parentId: "psy", position: 2 },
  { id: "hindsight", parentId: "bias", position: 0 },
  { id: "confirmation", parentId: "bias", position: 1 },
  { id: "eco", parentId: null, position: 1 },
  { id: "micro", parentId: "eco", position: 0 },
];

describe("ветка узла", () => {
  it("включает сам узел и всех потомков", () => {
    expect(branchOf(tree, "psy")).toEqual(
      new Set(["psy", "coach", "habits", "bias", "hindsight", "confirmation"]),
    );
  });

  it("у листа состоит из него одного", () => {
    expect(branchOf(tree, "hindsight")).toEqual(new Set(["hindsight"]));
  });

  it("не зацикливается на испорченном дереве", () => {
    // такого быть не должно, но если петля всё же попала в базу,
    // обход обязан завершиться, а не повесить страницу
    const broken: TreeNode[] = [
      { id: "a", parentId: "b" },
      { id: "b", parentId: "a" },
    ];
    expect(branchOf(broken, "a").size).toBe(2);
  });
});

describe("что можно уронить и куда", () => {
  it("узел нельзя вложить в самого себя", () => {
    expect(canDrop(tree, "bias", "bias", "inside")).toBe(false);
    expect(canDrop(tree, "bias", "bias", "before")).toBe(false);
  });

  it("родителя нельзя вложить в собственного ребёнка", () => {
    expect(canDrop(tree, "psy", "bias", "inside")).toBe(false);
    expect(canDrop(tree, "psy", "hindsight", "inside")).toBe(false);
  });

  it("родителя нельзя поставить рядом с собственным потомком: это та же петля", () => {
    // «до Hindsight» означает «внутрь Cognitive Biases», а та лежит под Psychology
    expect(canDrop(tree, "psy", "hindsight", "before")).toBe(false);
  });

  it("ребёнка можно вынести наверх, встав рядом с корневым узлом", () => {
    expect(canDrop(tree, "hindsight", "eco", "before")).toBe(true);
  });

  it("перенос в чужую ветку разрешён", () => {
    expect(canDrop(tree, "hindsight", "micro", "inside")).toBe(true);
    expect(canDrop(tree, "bias", "eco", "inside")).toBe(true);
  });
});

describe("куда встанет узел", () => {
  it("вложение делает узел последним ребёнком цели", () => {
    const place = placeAfterDrop(tree, "hindsight", "eco", "inside");
    expect(place).toEqual({ parentId: "eco", siblings: ["micro", "hindsight"] });
  });

  it("«до» ставит узел перед целью среди её братьев", () => {
    const place = placeAfterDrop(tree, "bias", "coach", "before");
    expect(place).toEqual({ parentId: "psy", siblings: ["bias", "coach", "habits"] });
  });

  it("«после» ставит узел следом за целью", () => {
    const place = placeAfterDrop(tree, "coach", "habits", "after");
    expect(place).toEqual({ parentId: "psy", siblings: ["habits", "coach", "bias"] });
  });

  it("порядок возвращается целиком, без дыр и повторов", () => {
    const place = placeAfterDrop(tree, "hindsight", "habits", "after");
    expect(place?.siblings).toEqual(["coach", "habits", "hindsight", "bias"]);
    expect(new Set(place?.siblings).size).toBe(place?.siblings.length);
  });

  it("переезд в корень даёт parentId = null", () => {
    const place = placeAfterDrop(tree, "hindsight", "eco", "after");
    expect(place?.parentId).toBeNull();
    expect(place?.siblings).toEqual(["psy", "eco", "hindsight"]);
  });

  it("запрещённый сброс не даёт размещения вовсе", () => {
    expect(placeAfterDrop(tree, "psy", "bias", "inside")).toBeNull();
  });

  it("перестановка внутри своих братьев не теряет узел", () => {
    const place = placeAfterDrop(tree, "confirmation", "hindsight", "before");
    expect(place).toEqual({ parentId: "bias", siblings: ["confirmation", "hindsight"] });
  });
});

describe("рёбра иерархии", () => {
  it("по одному на каждую пару родитель — ребёнок", () => {
    expect(hierarchyEdges(tree)).toHaveLength(6);
  });

  it("корни рёбер не порождают", () => {
    const edges = hierarchyEdges(tree);
    expect(edges.some((e) => e.target === "psy" || e.target === "eco")).toBe(false);
  });

  it("ссылка на пропавшего родителя ребра не даёт", () => {
    // осиротевший узел рисуется сам по себе, а не тянет ребро в никуда
    const orphan: TreeNode[] = [{ id: "x", parentId: "ghost" }];
    expect(hierarchyEdges(orphan)).toEqual([]);
  });

  it("идентификаторы рёбер уникальны", () => {
    const ids = hierarchyEdges(tree).map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("глубина", () => {
  it("у корня ноль", () => {
    expect(depthOf(tree, "psy")).toBe(0);
  });

  it("считает предков, а не детей", () => {
    expect(depthOf(tree, "bias")).toBe(1);
    expect(depthOf(tree, "hindsight")).toBe(2);
  });

  it("на петле возвращает бесконечность, а не виснет", () => {
    const broken: TreeNode[] = [
      { id: "a", parentId: "b" },
      { id: "b", parentId: "a" },
    ];
    expect(depthOf(broken, "a")).toBe(Infinity);
  });
});

describe("набор или контейнер", () => {
  it("узел с собственными карточками — набор", () => {
    expect(isStudySet({ ownCards: 4, hasChildren: false })).toBe(true);
  });

  it("пустой лист — тоже набор: его только что создали", () => {
    expect(isStudySet({ ownCards: 0, hasChildren: false })).toBe(true);
  });

  it("узел с детьми и без своих карточек — контейнер", () => {
    // «Books» держит четыре карточки в подкатегории, а своих не имеет:
    // учить в нём нечего, и Practice обещал бы то, чего нет
    expect(isStudySet({ ownCards: 0, hasChildren: true })).toBe(false);
  });

  it("узел с детьми и своими карточками — всё-таки набор", () => {
    expect(isStudySet({ ownCards: 3, hasChildren: true })).toBe(true);
  });
});

describe("род узла сильнее догадки по данным", () => {
  it("пустая группа остаётся группой", () => {
    // её только что создали внутри категории и ещё не наполнили
    expect(isStudySet({ ownCards: 0, hasChildren: false, kind: "deck" })).toBe(true);
  });

  it("группа с подгруппами остаётся группой", () => {
    expect(isStudySet({ ownCards: 0, hasChildren: true, kind: "deck" })).toBe(true);
  });

  it("категория не становится колодой из-за случайно попавшей карточки", () => {
    expect(isStudySet({ ownCards: 5, hasChildren: false, kind: "area" })).toBe(false);
  });

  it("источник — не колода", () => {
    expect(isStudySet({ ownCards: 12, hasChildren: false, kind: "source" })).toBe(false);
  });

  it("без рода работает прежняя догадка: миграция могла быть не применена", () => {
    expect(isStudySet({ ownCards: 0, hasChildren: true })).toBe(false);
    expect(isStudySet({ ownCards: 3, hasChildren: true, kind: null })).toBe(true);
  });
});

describe("введено ли разделение на роды", () => {
  it("сразу после добавления колонки все узлы — категории, и разделение не действует", () => {
    // именно это состояние и спрятало весь список наборов: миграция 0015
    // ставит area по умолчанию, а перевод в deck делает следующая
    expect(kindInEffect(["area", "area", "area"])).toBe(false);
  });

  it("колонки ещё нет — тем более не действует", () => {
    expect(kindInEffect([undefined, undefined])).toBe(false);
    expect(kindInEffect([null, null])).toBe(false);
    expect(kindInEffect([])).toBe(false);
  });

  it("появилась хотя бы одна группа — правило включается", () => {
    expect(kindInEffect(["area", "deck", "area"])).toBe(true);
  });

  it("источники разделения не вводят: они были и до него", () => {
    expect(kindInEffect(["area", "source"])).toBe(false);
  });
});
