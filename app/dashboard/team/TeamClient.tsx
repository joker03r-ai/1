"use client";

import { useEffect, useState } from "react";
import Topbar from "@/components/Topbar";
import { useEsc } from "@/lib/useEsc";
import { IconPlus } from "@/components/icons";
import { avatarColor } from "@/lib/users";
import {
  Member,
  Role,
  ROLE_LABELS,
  ROLE_HINTS,
  loadTeam,
  addMember,
  removeMember,
  updateMember,
  currentMember,
  canManage,
  AVATARS,
  avatarGrad,
  TEAM_LIMIT,
} from "@/lib/team";

// Аватарка участника: выбранный эмодзи на градиенте либо инициалы.
function Avatar({ m, onClick }: { m: Member; onClick?: () => void }) {
  if (m.avatar) return <span className={`team-ava${onClick ? " team-ava--btn" : ""}`} style={{ background: avatarGrad(m.username || m.name) }} onClick={onClick}>{m.avatar}</span>;
  return <span className={`user-ava${onClick ? " team-ava--btn" : ""}`} style={{ background: avatarColor(m.username || m.name) }} onClick={onClick}>{initials(m.name)}</span>;
}

function AvatarPicker({ value, onPick }: { value?: string; onPick: (a: string) => void }) {
  return (
    <div className="team-avgrid">
      {AVATARS.map((a) => (
        <button key={a} type="button" className={`team-avopt${value === a ? " on" : ""}`} onClick={() => onPick(a)}>{a}</button>
      ))}
    </div>
  );
}

function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (!p.length) return "?";
  return (p.length === 1 ? p[0].slice(0, 2) : p[0][0] + p[1][0]).toUpperCase();
}

export default function TeamClient() {
  const [team, setTeam] = useState<Member[]>([]);
  const [meCanManage, setMeCanManage] = useState(false);
  const [adding, setAdding] = useState(false);
  const [confirm, setConfirm] = useState<Member | null>(null);
  const [avEdit, setAvEdit] = useState<Member | null>(null);
  const full = team.length >= TEAM_LIMIT;

  useEffect(() => {
    const t = loadTeam();
    setTeam(t);
    setMeCanManage(canManage(currentMember(t).role));
  }, []);

  function refresh() {
    setTeam(loadTeam());
  }
  function changeRole(m: Member, role: Role) {
    updateMember(m.id, { role });
    refresh();
  }
  function remove(m: Member) {
    removeMember(m.id);
    setConfirm(null);
    refresh();
  }

  return (
    <>
      <Topbar crumbs={["Основной проект", "Команда"]} />
      <div className="content" style={{ maxWidth: 820 }}>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
          <div>
            <h1 className="h1" style={{ marginBottom: 2 }}>Команда <span className="team-count">{team.length} / {TEAM_LIMIT}</span></h1>
            <p className="muted" style={{ margin: 0 }}>
              Сотрудники, роли и права доступа. До {TEAM_LIMIT} человек. Владелец и администратор
              управляют командой; оператор видит только выданные ему чаты.
            </p>
          </div>
          {meCanManage && (
            <button className="btn btn-primary" onClick={() => setAdding(true)} disabled={full} title={full ? `Достигнут лимит ${TEAM_LIMIT} человек` : ""}>
              <IconPlus className="ico" /> Добавить сотрудника
            </button>
          )}
        </div>
        {meCanManage && full && (
          <div className="hint" style={{ marginBottom: 12 }}>Достигнут лимит команды — {TEAM_LIMIT} человек. Удалите кого-то, чтобы добавить нового.</div>
        )}

        {!meCanManage && (
          <div className="hint" style={{ marginBottom: 12 }}>
            🔒 Управлять командой может только владелец или администратор.
          </div>
        )}

        <div className="team-list">
          {team.map((m) => (
            <div key={m.id} className="team-row card">
              <Avatar m={m} onClick={meCanManage ? () => setAvEdit(m) : undefined} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700 }}>{m.name}</div>
                {m.username && <div className="muted" style={{ fontSize: 12 }}>{m.username}</div>}
              </div>
              <div className="team-role">
                {meCanManage && m.role !== "owner" ? (
                  <select className="select" value={m.role} onChange={(e) => changeRole(m, e.target.value as Role)}>
                    {(Object.keys(ROLE_LABELS) as Role[]).filter((r) => r !== "owner").map((r) => (
                      <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                    ))}
                  </select>
                ) : (
                  <span className={`team-badge ${m.role}`}>{ROLE_LABELS[m.role]}</span>
                )}
                <div className="team-role__hint">{ROLE_HINTS[m.role]}</div>
              </div>
              {meCanManage && m.role !== "owner" && (
                <button className="user-act del" onClick={() => setConfirm(m)}>Удалить</button>
              )}
            </div>
          ))}
        </div>
      </div>

      {adding && (
        <AddMemberModal
          onClose={() => setAdding(false)}
          onAdd={(m) => {
            const added = addMember(m);
            setAdding(false);
            refresh();
            if (!added) alert(`Достигнут лимит команды — ${TEAM_LIMIT} человек.`);
          }}
        />
      )}

      {avEdit && (
        <div className="modal-overlay" onClick={() => setAvEdit(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <div className="modal__head"><b>Аватарка · {avEdit.name}</b><button className="fn__x dark" onClick={() => setAvEdit(null)}>✕</button></div>
            <div className="field" style={{ marginTop: 12 }}>
              <AvatarPicker value={avEdit.avatar} onPick={(a) => { updateMember(avEdit.id, { avatar: a }); setAvEdit(null); refresh(); }} />
            </div>
            {avEdit.avatar && <button className="btn btn-sm" style={{ marginTop: 8 }} onClick={() => { updateMember(avEdit.id, { avatar: undefined }); setAvEdit(null); refresh(); }}>Сбросить на инициалы</button>}
          </div>
        </div>
      )}

      {confirm && (
        <div className="modal-overlay" onClick={() => setConfirm(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal__head">
              <b>Удалить сотрудника</b>
              <button className="fn__x dark" onClick={() => setConfirm(null)}>✕</button>
            </div>
            <p className="muted" style={{ marginTop: 12 }}>
              <b>{confirm.name}</b> потеряет доступ к кабинету. Действие можно повторить,
              добавив сотрудника заново.
            </p>
            <div className="row" style={{ justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
              <button className="btn" onClick={() => setConfirm(null)}>Отменить</button>
              <button className="btn btn-danger" onClick={() => remove(confirm)}>Удалить</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function AddMemberModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (m: { name: string; username?: string; role: Role; chatAccess: string[]; avatar?: string }) => void;
}) {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<Role>("operator");
  const [avatar, setAvatar] = useState<string | undefined>(undefined);
  useEsc(true, onClose);

  function submit() {
    if (!name.trim()) return;
    onAdd({ name: name.trim(), username: username.trim() || undefined, role, chatAccess: [], avatar });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <b>Добавить сотрудника</b>
          <button className="fn__x dark" onClick={onClose}>✕</button>
        </div>
        <div className="field" style={{ marginTop: 16 }}>
          <label className="label">Имя</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Пётр Смирнов" autoFocus />
        </div>
        <div className="field">
          <label className="label">Telegram (необязательно)</label>
          <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="@petr_s" />
        </div>
        <div className="field">
          <label className="label">Роль</label>
          <select className="select" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {(Object.keys(ROLE_LABELS) as Role[]).filter((r) => r !== "owner").map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]} — {ROLE_HINTS[r]}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="label">Аватарка</label>
          <AvatarPicker value={avatar} onPick={(a) => setAvatar(a === avatar ? undefined : a)} />
        </div>
        <div className="row" style={{ justifyContent: "flex-end", gap: 10, marginTop: 6 }}>
          <button className="btn" onClick={onClose}>Отменить</button>
          <button className="btn btn-primary" onClick={submit}>Добавить</button>
        </div>
      </div>
    </div>
  );
}
