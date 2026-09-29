import {
  clone,
  evaluateEntity,
  num,
  ownerOf,
  upsertKey,
  type Command,
  type Entity,
  type StudioDocument,
  type Track,
} from "./model";
export function pathScope(profileId: string) {
  return profileId === "desktop" ? "base" : profileId;
}
export function pathTrack(
  d: StudioDocument,
  e: Entity,
  property: string,
  profileId: string,
): Track | undefined {
  return (
    d.tracks.find(
      (t) =>
        t.entityId === e.id &&
        t.property === property &&
        t.profileId === profileId,
    ) ??
    d.tracks.find(
      (t) =>
        t.entityId === e.id &&
        t.property === property &&
        t.profileId === "base",
    )
  );
}
export function pathAvailability(
  d: StudioDocument,
  e: Entity | undefined,
  profileId: string,
): string | null {
  if (!e) return "Select an element to author its path.";
  if (e.parentId)
    return "Path handles currently use page coordinates. Select a page-level element.";
  if (["x", "y"].some((k) => ownerOf(d, e, k, profileId) === "signal"))
    return "Release the position signal before editing a path.";
  return null;
}
export function pathNodes(d: StudioDocument, e: Entity, profileId: string) {
  const times = [
    ...new Set(
      ["x", "y"].flatMap(
        (p) => pathTrack(d, e, p, profileId)?.keys.map((k) => k.time) ?? [],
      ),
    ),
  ].sort((a, b) => a - b);
  return times.map((time) => {
    const p = evaluateEntity(d, e, profileId, time);
    return { time, x: num(p, "x"), y: num(p, "y") };
  });
}
export function positionKeyCommands(
  d: StudioDocument,
  e: Entity,
  profileId: string,
  time: number,
  x: number,
  y: number,
): Command[] {
  const unavailable = pathAvailability(d, e, profileId);
  if (unavailable) throw new Error(unavailable);
  const scope = pathScope(profileId),
    at = Math.min(d.duration, Math.max(0, Math.round(time * 100) / 100));
  return ["x", "y"].map(
    (property): Command => ({
      type: "track",
      track: upsertKey(d, e.id, property, scope, at, property === "x" ? x : y),
    }),
  );
}
export function deletePositionKeyCommands(
  d: StudioDocument,
  e: Entity,
  profileId: string,
  time: number,
): Command[] {
  const scope = pathScope(profileId);
  return ["x", "y"].flatMap((property): Command[] => {
    const original = pathTrack(d, e, property, profileId);
    if (!original) return [];
    const track = clone(original);
    if (track.profileId !== scope)
      throw new Error(
        "Edit or add a profile key first to fork the inherited path.",
      );
    const keys = track.keys.filter((k) => k.time !== time);
    return keys.length
      ? [{ type: "track", track: { ...track, keys } }]
      : [{ type: "remove-track", id: track.id }];
  });
}
