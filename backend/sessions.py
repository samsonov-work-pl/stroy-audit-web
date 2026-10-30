"""Временные отчёты и чаты по токену. Исходные файлы не сохраняются."""

from __future__ import annotations

import json
import logging
import os
import smtplib
import uuid
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from typing import Any
from urllib import error as urlerror
from urllib import request as urlrequest

from fastapi import APIRouter, HTTPException, Request

log = logging.getLogger("report-sessions")
router = APIRouter()

MAX_CHAT_MESSAGES = 30
ONE_TIME_DAYS = 14
SUBSCRIPTION_DAYS = 30
MAX_REPORT_CHARS = 200_000
MAX_INPUT_CHARS = 4000

CREATE_SQL = """
CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    report_content TEXT NOT NULL,
    chat_history JSONB NOT NULL DEFAULT '[]'::jsonb,
    message_count INTEGER NOT NULL DEFAULT 0,
    tier TEXT NOT NULL,
    jurisdiction TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
"""


def database_url() -> str:
    dsn = (os.getenv("DATABASE_URL") or "").strip()
    if not dsn:
        raise HTTPException(status_code=503, detail="DATABASE_URL не задан.")
    return dsn


def connect():
    import psycopg

    return psycopg.connect(database_url())


def ensure_table(conn) -> None:
    with conn.cursor() as cur:
        cur.execute(CREATE_SQL)
        cur.execute("DELETE FROM sessions WHERE expires_at <= NOW()")
    conn.commit()


def session_days(tier: str) -> int:
    return SUBSCRIPTION_DAYS if tier == "developer" else ONE_TIME_DAYS


def public_url(token: str) -> str:
    base = (os.getenv("SITE_URL") or "http://localhost:3000").rstrip("/")
    return f"{base}/report/{token}"


def discard_upload(upload: Any) -> None:
    """Исходный PDF/CAD не пишется на диск: поток закрывается сразу."""
    file_obj = getattr(upload, "file", None)
    if file_obj is not None:
        file_obj.close()
    log.info("Исходный файл отброшен и не сохранён")


def send_email(to: str, url: str, days: int) -> bool:
    subject = "Ваш отчёт СтройАудит.ai"
    text = (
        "Ваш отчёт СтройАудит.ai готов.\n\n"
        f"Ссылка на отчёт и чат активна {days} дн.:\n{url}\n\n"
        "В чате по этому отчёту можно задать до 30 вопросов. Исходные файлы на сервере не хранятся.\n"
    )
    resend_key = (os.getenv("RESEND_API_KEY") or "").strip()
    sender = (os.getenv("EMAIL_FROM") or "СтройАудит.ai <reports@stroyaudit-ai.com>").strip()
    if resend_key:
        payload = json.dumps(
            {
                "from": sender,
                "reply_to": "hello@stroyaudit-ai.com",
                "to": [to],
                "subject": subject,
                "text": text,
            },
            ensure_ascii=False,
        ).encode("utf-8")
        req = urlrequest.Request(
            "https://api.resend.com/emails",
            data=payload,
            headers={"Authorization": f"Bearer {resend_key}", "Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urlrequest.urlopen(req, timeout=20) as response:
                return 200 <= response.status < 300
        except urlerror.URLError:
            log.exception("Resend не принял письмо")
            return False

    host = (os.getenv("SMTP_HOST") or "").strip()
    if not host:
        return False
    message = EmailMessage()
    message["From"] = sender
    message["Reply-To"] = "hello@stroyaudit-ai.com"
    message["To"] = to
    message["Subject"] = subject
    message.set_content(text)
    port = int(os.getenv("SMTP_PORT") or "587")
    user = (os.getenv("SMTP_USER") or "").strip()
    password = os.getenv("SMTP_PASSWORD") or ""
    try:
        with smtplib.SMTP(host, port, timeout=20) as smtp:
            smtp.starttls()
            if user:
                smtp.login(user, password)
            smtp.send_message(message)
        return True
    except OSError:
        log.exception("SMTP не отправил письмо")
        return False


def ask_model(report: str, history: list[dict[str, str]], question: str) -> str:
    key = (os.getenv("OPENROUTER_API_KEY") or "").strip()
    if not key:
        raise HTTPException(status_code=503, detail="OPENROUTER_API_KEY не задан.")
    model = (os.getenv("CHAT_MODEL") or "google/gemini-2.5-pro").strip()
    messages = [
        {
            "role": "system",
            "content": (
                "Ты — инженер-эксперт сервиса СтройАудит.ai. Отвечай по-русски только по отчёту ниже. "
                "Не заменяй официальную экспертизу.\n\n=== ОТЧЁТ ===\n"
                f"{report}\n=== КОНЕЦ ОТЧЁТА ==="
            ),
        },
        *history[-40:],
        {"role": "user", "content": question},
    ]
    payload = json.dumps({"model": model, "messages": messages}, ensure_ascii=False).encode("utf-8")
    req = urlrequest.Request(
        "https://openrouter.ai/api/v1/chat/completions",
        data=payload,
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json", "X-Title": "StroyAudit.ai"},
        method="POST",
    )
    try:
        with urlrequest.urlopen(req, timeout=60) as response:
            data = json.loads(response.read().decode("utf-8"))
    except urlerror.URLError as exc:
        log.exception("Модель не ответила")
        raise HTTPException(status_code=502, detail="Не удалось получить ответ ассистента.") from exc
    try:
        return str(data["choices"][0]["message"]["content"]).strip()
    except (KeyError, IndexError, TypeError) as exc:
        raise HTTPException(status_code=502, detail="Пустой ответ модели.") from exc


async def read_payload(request: Request) -> dict[str, Any]:
    content_type = request.headers.get("content-type") or ""
    if "multipart/form-data" in content_type:
        form = await request.form()
        upload = form.get("file")
        if upload is not None and not isinstance(upload, str):
            discard_upload(upload)
        return {key: value for key, value in form.items() if isinstance(value, str)}
    try:
        payload = await request.json()
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Некорректный запрос.") from exc
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Ожидался объект JSON.")
    return payload


@router.post("/api/sessions")
async def create_session(request: Request) -> dict[str, Any]:
    payload = await read_payload(request)
    report = str(payload.get("report") or payload.get("report_content") or "")
    email = str(payload.get("email") or "").strip().lower()
    tier = str(payload.get("tier") or "full")
    jurisdiction = payload.get("jurisdiction")
    if tier not in {"full", "developer"}:
        raise HTTPException(status_code=400, detail="Некорректный тариф.")
    if len(report.strip()) < 50 or len(report) > MAX_REPORT_CHARS:
        raise HTTPException(status_code=400, detail="Некорректный текст отчёта.")
    if "@" not in email or len(email) > 254:
        raise HTTPException(status_code=400, detail="Укажите email, на который отправить отчёт.")

    token = str(uuid.uuid4())
    days = session_days(tier)
    expires_at = datetime.now(timezone.utc) + timedelta(days=days)
    with connect() as conn:
        ensure_table(conn)
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO sessions (token, email, report_content, chat_history, message_count, tier, jurisdiction, expires_at)
                VALUES (%s, %s, %s, '[]'::jsonb, 0, %s, %s, %s)
                """,
                (token, email, report, tier, jurisdiction if isinstance(jurisdiction, str) else None, expires_at),
            )
        conn.commit()
    url = public_url(token)
    email_sent = send_email(email, url, days)
    return {"token": token, "url": url, "days": days, "expires_at": expires_at.isoformat(), "email_sent": email_sent}


@router.get("/api/sessions/{token}")
def read_session(token: str) -> dict[str, Any]:
    try:
        uuid.UUID(token)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Ссылка недействительна.") from exc
    with connect() as conn:
        ensure_table(conn)
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT email, report_content, chat_history, message_count, tier, expires_at
                FROM sessions WHERE token = %s AND expires_at > NOW()
                """,
                (token,),
            )
            row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Ссылка недействительна или срок истёк.")
    history = row[2] if isinstance(row[2], list) else []
    return {
        "token": token,
        "email": row[0],
        "report_content": row[1],
        "chat_history": history,
        "message_count": row[3],
        "remaining": max(0, MAX_CHAT_MESSAGES - int(row[3])),
        "limit": MAX_CHAT_MESSAGES,
        "tier": row[4],
        "expires_at": row[5].isoformat(),
    }


@router.post("/api/sessions/{token}/chat")
async def chat(token: str, request: Request) -> dict[str, Any]:
    try:
        uuid.UUID(token)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Ссылка недействительна.") from exc
    payload = await read_payload(request)
    question = str(payload.get("message") or "").strip()
    if not question or len(question) > MAX_INPUT_CHARS:
        raise HTTPException(status_code=400, detail="Некорректное сообщение.")

    with connect() as conn:
        ensure_table(conn)
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE sessions
                SET message_count = message_count + 1
                WHERE token = %s AND expires_at > NOW() AND message_count < %s
                RETURNING report_content, chat_history, message_count
                """,
                (token, MAX_CHAT_MESSAGES),
            )
            row = cur.fetchone()
        conn.commit()
    if not row:
        raise HTTPException(status_code=404, detail="Ссылка недействительна, срок истёк или лимит вопросов исчерпан.")

    history = row[1] if isinstance(row[1], list) else []
    turns = [
        {"role": item.get("role"), "content": item.get("content")}
        for item in history
        if isinstance(item, dict) and item.get("role") in {"user", "assistant"} and isinstance(item.get("content"), str)
    ]
    try:
        reply = ask_model(row[0], turns, question) or "Не удалось сформулировать ответ. Уточните вопрос."
    except HTTPException:
        with connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE sessions SET message_count = GREATEST(message_count - 1, 0) WHERE token = %s",
                    (token,),
                )
            conn.commit()
        raise

    new_turns = [{"role": "user", "content": question}, {"role": "assistant", "content": reply}]
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE sessions
                SET chat_history = COALESCE(chat_history, '[]'::jsonb) || %s::jsonb
                WHERE token = %s
                """,
                (json.dumps(new_turns, ensure_ascii=False), token),
            )
        conn.commit()
    count = int(row[2])
    return {"reply": reply, "remaining": max(0, MAX_CHAT_MESSAGES - count), "limit": MAX_CHAT_MESSAGES}
