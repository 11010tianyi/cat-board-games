import assert from "node:assert/strict";
import test from "node:test";
import { ALBUM_CREDIT, musicCatalog, stepTrackId, STUDY_CREDIT } from "../src/music-catalog.ts";
import {
  coercePersisted,
  createInitialRuntime,
  decidePlayback,
  DEFAULT_VOLUME,
} from "../src/music-player.ts";

const studyUrls = [
  "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Eastern%20Thought.mp3",
  "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Guzheng%20City.mp3",
  "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Meditation%20Impromptu%2001.mp3",
  "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Meditation%20Impromptu%2002.mp3",
  "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Meditation%20Impromptu%2003.mp3",
  "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Water%20Lily.mp3",
  "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Midnight%20Tale.mp3",
  "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Thinking%20Music.mp3",
  "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Kalimba%20Relaxation%20Music.mp3",
];

const albumUrls = [
  "https://cdn.acedata2.cloud/suno/299b566d-7dce-4c4c-a7d0-fda0e3a96f0d.mp3",
  "https://cdn.acedata2.cloud/suno/6c764841-c493-4a3c-b6d7-fae5530efa5a.mp3",
  "https://cdn.acedata2.cloud/suno/e5805f72-2b19-4cd0-8c44-6b6a32b7ea52.mp3",
  "https://cdn.acedata2.cloud/suno/854817d6-85b6-4ac4-97c2-df6acff8c1f3.mp3",
  "https://cdn.acedata2.cloud/suno/28ede0a6-09bf-4780-88f3-3b7c51e2dbdd.mp3",
  "https://cdn.acedata2.cloud/suno/3b5a0f3a-28e5-451b-95e6-f88fe6cdcbbe.mp3",
  "https://cdn.acedata2.cloud/suno/dbbfc8e3-5729-43f6-9ef1-d799296a2018.mp3",
  "https://cdn.acedata2.cloud/suno/7f8c7c91-bad1-4cf5-a18c-78c5886ca210.mp3",
  "https://cdn.acedata2.cloud/suno/253bf1be-43e4-4c04-9522-fe4199f298ae.mp3",
  "https://cdn.acedata2.cloud/suno/575cf7b4-68d1-4990-8fd6-620e8271a6cd.mp3",
];

test("music catalog keeps the verified study and album streams", () => {
  const study = musicCatalog[0];
  const album = musicCatalog[1];
  assert.equal(study.name, "棋局氛围");
  assert.equal(album.name, "花小妖与小花生");
  assert.equal(study.credit, STUDY_CREDIT);
  assert.equal(album.credit, ALBUM_CREDIT);
  assert.deepEqual(study.tracks.map((track) => track.url), studyUrls);
  assert.deepEqual(album.tracks.map((track) => track.url), albumUrls);
  assert.deepEqual(
    study.tracks.map((track) => track.originalTitle),
    [
      "Eastern Thought",
      "Guzheng City",
      "Meditation Impromptu 01",
      "Meditation Impromptu 02",
      "Meditation Impromptu 03",
      "Water Lily",
      "Midnight Tale",
      "Thinking Music",
      "Kalimba Relaxation Music",
    ],
  );
  for (const url of [...studyUrls, ...albumUrls]) {
    assert.equal(url.startsWith("https://"), true);
  }
});

test("loading a saved session never starts playback", () => {
  const runtime = createInitialRuntime({
    categoryId: "album",
    trackIds: { album: "jgirl", study: "water-lily" },
    volume: 0.2,
    musicOn: true,
    playing: true,
  });
  assert.equal(runtime.playing, false);
  assert.equal(runtime.loadedTrackId, null);
  assert.equal(runtime.persisted.musicOn, true);
  assert.equal(runtime.persisted.categoryId, "album");
  assert.equal(runtime.persisted.trackIds.album, "jgirl");
  assert.equal(runtime.persisted.trackIds.study, "water-lily");
  assert.equal(runtime.persisted.volume, 0.2);
});

test("invalid saved music falls back without throwing", () => {
  const persisted = coercePersisted({
    categoryId: "jazz",
    trackIds: { study: "missing", album: 4 },
    volume: Number.NaN,
    musicOn: "yes",
  });
  assert.equal(persisted.categoryId, "study");
  assert.equal(persisted.trackIds.study, musicCatalog[0].tracks[0].id);
  assert.equal(persisted.trackIds.album, musicCatalog[1].tracks[0].id);
  assert.equal(persisted.volume, DEFAULT_VOLUME);
  assert.equal(persisted.musicOn, false);
  assert.equal(createInitialRuntime(null).playing, false);
});

test("category changes and paused track choices do not ask to start audio", () => {
  assert.equal(decidePlayback(false, "show-category"), "keep");
  assert.equal(decidePlayback(true, "show-category"), "keep");
  assert.equal(decidePlayback(false, "select-track"), "keep");
  assert.equal(decidePlayback(false, "previous"), "keep");
  assert.equal(decidePlayback(false, "next"), "keep");
  assert.equal(decidePlayback(true, "select-track"), "start");
  assert.equal(decidePlayback(true, "next"), "start");
  assert.equal(decidePlayback(false, "toggle"), "start");
  assert.equal(decidePlayback(true, "toggle"), "pause");
  assert.equal(decidePlayback(true, "ended"), "start");
  assert.equal(decidePlayback(false, "ended"), "keep");
});

test("next and previous wrap inside the current category", () => {
  const study = musicCatalog[0];
  const album = musicCatalog[1];
  const lastStudy = study.tracks.at(-1);
  const lastAlbum = album.tracks.at(-1);
  assert.ok(lastStudy);
  assert.ok(lastAlbum);
  assert.equal(stepTrackId("study", lastStudy.id, 1), study.tracks[0].id);
  assert.equal(stepTrackId("study", study.tracks[0].id, -1), lastStudy.id);
  assert.equal(stepTrackId("album", lastAlbum.id, 1), album.tracks[0].id);
  assert.equal(stepTrackId("album", album.tracks[0].id, -1), lastAlbum.id);
  assert.equal(stepTrackId("album", "jgirl", 1), "grandma-return");
});
