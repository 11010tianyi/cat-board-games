export type MusicCategoryId = "study" | "album";

export type MusicTrack = {
  id: string;
  title: string;
  originalTitle?: string;
  url: string;
};

export type MusicCategory = {
  id: MusicCategoryId;
  name: string;
  tone: string;
  blurb: string;
  credit: string;
  tracks: MusicTrack[];
};

export const STUDY_CREDIT = "Music by Kevin MacLeod (incompetech.com), Creative Commons BY.";
export const ALBUM_CREDIT = "艺名 花小妖与小花生 / Suno.";

export const musicCatalog: readonly MusicCategory[] = [
  {
    id: "study",
    name: "棋局氛围",
    tone: "木 · 墨 · 茶",
    blurb: "安静的器乐，陪着落子。",
    credit: STUDY_CREDIT,
    tracks: [
      {
        id: "eastern-thought",
        title: "东方思绪",
        originalTitle: "Eastern Thought",
        url: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Eastern%20Thought.mp3",
      },
      {
        id: "guzheng-city",
        title: "筝城",
        originalTitle: "Guzheng City",
        url: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Guzheng%20City.mp3",
      },
      {
        id: "meditation-01",
        title: "即兴冥想 1",
        originalTitle: "Meditation Impromptu 01",
        url: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Meditation%20Impromptu%2001.mp3",
      },
      {
        id: "meditation-02",
        title: "即兴冥想 2",
        originalTitle: "Meditation Impromptu 02",
        url: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Meditation%20Impromptu%2002.mp3",
      },
      {
        id: "meditation-03",
        title: "即兴冥想 3",
        originalTitle: "Meditation Impromptu 03",
        url: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Meditation%20Impromptu%2003.mp3",
      },
      {
        id: "water-lily",
        title: "睡莲",
        originalTitle: "Water Lily",
        url: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Water%20Lily.mp3",
      },
      {
        id: "midnight-tale",
        title: "午夜小谚",
        originalTitle: "Midnight Tale",
        url: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Midnight%20Tale.mp3",
      },
      {
        id: "thinking-music",
        title: "思考曲",
        originalTitle: "Thinking Music",
        url: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Thinking%20Music.mp3",
      },
      {
        id: "kalimba",
        title: "卡林巴舒缓",
        originalTitle: "Kalimba Relaxation Music",
        url: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Kalimba%20Relaxation%20Music.mp3",
      },
    ],
  },
  {
    id: "album",
    name: "花小妖与小花生",
    tone: "花 · 家人",
    blurb: "家里的歌，暖一点。",
    credit: ALBUM_CREDIT,
    tracks: [
      {
        id: "hua-xiaoyao",
        title: "花小妖与小花生",
        url: "https://cdn.acedata2.cloud/suno/299b566d-7dce-4c4c-a7d0-fda0e3a96f0d.mp3",
      },
      {
        id: "lakeside-sprite",
        title: "湖边小花妖",
        url: "https://cdn.acedata2.cloud/suno/6c764841-c493-4a3c-b6d7-fae5530efa5a.mp3",
      },
      {
        id: "full-and-asleep",
        title: "吃饱了睡好了",
        url: "https://cdn.acedata2.cloud/suno/e5805f72-2b19-4cd0-8c44-6b6a32b7ea52.mp3",
      },
      {
        id: "peanut-talk",
        title: "小花生学说话",
        url: "https://cdn.acedata2.cloud/suno/854817d6-85b6-4ac4-97c2-df6acff8c1f3.mp3",
      },
      {
        id: "warm-all-over",
        title: "通身热热",
        url: "https://cdn.acedata2.cloud/suno/28ede0a6-09bf-4780-88f3-3b7c51e2dbdd.mp3",
      },
      {
        id: "grandpa-stay",
        title: "爷爷别走",
        url: "https://cdn.acedata2.cloud/suno/3b5a0f3a-28e5-451b-95e6-f88fe6cdcbbe.mp3",
      },
      {
        id: "jgirl",
        title: "Jgirl",
        url: "https://cdn.acedata2.cloud/suno/dbbfc8e3-5729-43f6-9ef1-d799296a2018.mp3",
      },
      {
        id: "grandma-return",
        title: "奶奶快回来",
        url: "https://cdn.acedata2.cloud/suno/7f8c7c91-bad1-4cf5-a18c-78c5886ca210.mp3",
      },
      {
        id: "smiling-peanut",
        title: "爱笑花生",
        url: "https://cdn.acedata2.cloud/suno/253bf1be-43e4-4c04-9522-fe4199f298ae.mp3",
      },
      {
        id: "the-way-here",
        title: "来时路",
        url: "https://cdn.acedata2.cloud/suno/575cf7b4-68d1-4990-8fd6-620e8271a6cd.mp3",
      },
    ],
  },
];

export function categoryById(id: MusicCategoryId) {
  const category = musicCatalog.find((item) => item.id === id);
  if (!category) throw new Error(`Unknown music category: ${id}`);
  return category;
}

export function findTrack(trackId: string) {
  for (const category of musicCatalog) {
    const index = category.tracks.findIndex((track) => track.id === trackId);
    if (index >= 0) return { category, track: category.tracks[index], index };
  }
  return null;
}

export function stepTrackId(categoryId: MusicCategoryId, trackId: string, delta: number) {
  const tracks = categoryById(categoryId).tracks;
  const current = tracks.findIndex((track) => track.id === trackId);
  const index = current < 0 ? 0 : current;
  const next = (index + delta + tracks.length * 8) % tracks.length;
  return tracks[next].id;
}
