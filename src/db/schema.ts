import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

/**
 * Una sala de ahorcado. El "status" sigue la máquina:
 * lobby -> writing -> playing -> finished -> (lobby otra vez)
 */
export const rooms = pgTable(
  "hangman_rooms",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: varchar("code", { length: 8 }).notNull().unique(),
    /** "public" aparece en Buscar partida; "private" solo por código. */
    visibility: varchar("visibility", { length: 12 }).notNull().default("public"),
    /** "online" (nube) o "lan" (misma red Wi-Fi). */
    network: varchar("network", { length: 12 }).notNull().default("online"),
    title: varchar("title", { length: 40 }),
    /** Máximo de jugadores que el anfitrión permite (2–11). */
    maxPlayers: integer("max_players").notNull().default(11),
    status: varchar("status", { length: 20 }).notNull().default("lobby"),
    round: integer("round").notNull().default(0),
    word: text("word"),
    hint: text("hint"),
    guessed: text("guessed").notNull().default(""),
    currentTurnId: uuid("current_turn_id"),
    lastWriterId: uuid("last_writer_id"),
    winner: varchar("winner", { length: 20 }),
    lastEvent: varchar("last_event", { length: 56 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("hangman_rooms_code_idx").on(t.code)],
);

export const players = pgTable(
  "hangman_players",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 24 }).notNull(),
    /** Identidad externa: UID de Firebase o "guest:<uuid>" */
    uid: varchar("uid", { length: 128 }),
    photo: text("photo"),
    passHash: varchar("pass_hash", { length: 128 }).notNull(),
    token: uuid("token").notNull().defaultRandom(),
    color: varchar("color", { length: 24 }).notNull().default("#f4f1ea"),
    isHost: boolean("is_host").notNull().default(false),
    role: varchar("role", { length: 12 }).notNull().default("guesser"),
    failsUsed: integer("fails_used").notNull().default(0),
    failsTotal: integer("fails_total").notNull().default(0),
    status: varchar("status", { length: 12 }).notNull().default("alive"),
    /** Nivel y XP cacheados del perfil (se sincronizan al entrar/actualizar). */
    level: integer("level").notNull().default(1),
    xp: integer("xp").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("hangman_players_room_idx").on(t.roomId),
    index("hangman_players_room_name_idx").on(t.roomId, t.name),
    index("hangman_players_room_uid_idx").on(t.roomId, t.uid),
  ],
);

/**
 * Jugadores baneados de una sala (no pueden volver a entrar).
 */
export const bannedPlayers = pgTable(
  "hangman_banned_players",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    uid: varchar("uid", { length: 128 }).notNull(),
    name: varchar("name", { length: 24 }).notNull(),
    bannedAt: timestamp("banned_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("hangman_banned_room_uid_idx").on(t.roomId, t.uid),
  ],
);

/**
 * Correos que aceptaron los términos (vía el formulario de Google).
 * Funciona como caché local de la hoja de respuestas.
 */
export const verifiedEmails = pgTable(
  "hangman_verified_emails",
  {
    email: varchar("email", { length: 160 }).primaryKey(),
    source: varchar("source", { length: 24 }).notNull().default("form"),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull().defaultNow(),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("hangman_verified_emails_idx").on(t.email)],
);

export type RoomRow = typeof rooms.$inferSelect;
export type PlayerRow = typeof players.$inferSelect;
export type VerifiedEmailRow = typeof verifiedEmails.$inferSelect;
