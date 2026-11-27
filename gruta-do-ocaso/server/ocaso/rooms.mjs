import { randomBytes, randomUUID } from 'node:crypto';
import { body, json, assert } from '../security.mjs';
import { regions, ORIGINAL } from '../../games/gruta-do-ocaso/src/regions.js';
import {
  CLASSES,
  createMatch,
  tick,
  setInput,
  snapshot,
  forfeit,
} from '../../games/gruta-do-ocaso/src/rules.js';

export function createCaveRooms() {
  const rooms = new Map(),
    arrivals = new Map();
  let timer = null,
    last = 0;
  function leave(room, id) {
    if (room.match) forfeit(room.match, id);
    room.members.delete(id);
    if (room.host === id) room.host = room.members.keys().next().value;
    if (!room.members.size) rooms.delete(room.code);
  }
  function advance() {
    const now = Date.now(),
      elapsed = Math.min(0.5, (now - last) / 1000);
    last = now;
    for (const room of rooms.values()) {
      for (const m of room.members.values()) {
        if (now - m.seen > 60000) {
          leave(room, m.id);
          continue;
        }
        if (room.match && now - m.seen > 500) {
          const p = room.match.players.find((p) => p.id === m.id);
          p.input.x = 0;
          p.input.y = 0;
          p.input.attack = false;
        }
      }
      if (!room.match) continue;
      let time = elapsed;
      while (time > 0.00001) {
        const step = Math.min(1 / 30, time);
        tick(room.match, step);
        time -= step;
      }
    }
    for (const [key, value] of arrivals) if (now > value.until) arrivals.delete(key);
    if (!rooms.size && !arrivals.size) {
      clearInterval(timer);
      timer = null;
    }
  }
  function startClock() {
    if (!timer) {
      last = Date.now();
      timer = setInterval(advance, 1000 / 30);
      timer.unref();
    }
  }
  async function handle(req, res, origin) {
    try {
      assert(req.method === 'POST', 405, 'Use POST.');
      assert(req.headers.origin === origin, 403, 'Origem inválida.');
      const data = await body(req, 2048);
      let room = rooms.get(data.code),
        member;
      if (data.action === 'create' || data.action === 'join') {
        const ip = req.socket.remoteAddress,
          now = Date.now();
        let window = arrivals.get(ip);
        if (!window || window.until <= now) {
          window = { count: 0, until: now + 60000 };
          arrivals.set(ip, window);
        }
        startClock();
        assert(++window.count <= 48, 429, 'Aguarde um minuto para entrar em outra sala.');
        assert(Object.hasOwn(CLASSES, data.kind), 400, 'Escolha uma classe.');
        const name = typeof data.name === 'string' ? data.name.trim().slice(0, 20) : '';
        assert(name.length > 0, 400, 'Digite seu nome.');
        if (data.action === 'create') {
          const mapId = data.mapId ?? ORIGINAL;
          assert(
            typeof mapId === 'string' && Object.hasOwn(regions, mapId),
            400,
            'Escolha um mapa válido.',
          );
          assert(rooms.size < 80, 429, 'Todas as salas estão ocupadas.');
          let code;
          do {
            code = randomBytes(3).toString('hex').toUpperCase();
          } while (rooms.has(code));
          room = { code, mapId, host: null, members: new Map(), match: null };
          rooms.set(code, room);
        }
        assert(room && !room.match, 409, 'Sala indisponível ou já iniciada.');
        assert(room.members.size < 12, 409, 'A sala está cheia.');
        member = {
          id: randomUUID(),
          token: randomBytes(24).toString('hex'),
          kind: data.kind,
          name,
          seen: now,
          lastPoll: 0,
        };
        room.members.set(member.id, member);
        room.host ??= member.id;
        return json(res, 201, { code: room.code, id: member.id, token: member.token });
      }
      member = room?.members.get(data.id);
      assert(member && member.token === data.token, 403, 'Conexão com a sala encerrada.');
      member.seen = Date.now();
      if (data.action === 'leave') {
        leave(room, member.id);
        return json(res, 200, { left: true });
      }
      if (data.action === 'start') {
        assert(room.host === member.id, 403, 'Apenas o anfitrião pode começar.');
        assert(
          !room.match && room.members.size >= 4,
          409,
          'São necessários pelo menos quatro jogadores.',
        );
        room.match = createMatch([...room.members.values()], room.mapId);
      } else assert(data.action === 'sync', 400, 'Ação desconhecida.');
      assert(member.seen - member.lastPoll >= 15, 429, 'Muitas atualizações.');
      member.lastPoll = member.seen;
      if (!room.match)
        return json(res, 200, {
          lobby: true,
          mapId: room.mapId,
          host: room.host,
          members: [...room.members.values()].map(({ id, kind, name }) => ({ id, kind, name })),
        });
      const player = room.match.players.find((p) => p.id === member.id);
      if (data.input && player.alive && room.match.phase !== 'end') setInput(player, data.input);
      return json(res, 200, {
        state: snapshot(room.match, member.id),
        ...(data.map ? { rocks: room.match.rocks, layout: room.match.layout } : {}),
      });
    } catch (e) {
      return json(res, e.status || 500, { error: e.status ? e.message : 'A sala não respondeu.' });
    }
  }
  return {
    handle,
    close() {
      clearInterval(timer);
      rooms.clear();
      arrivals.clear();
    },
  };
}
