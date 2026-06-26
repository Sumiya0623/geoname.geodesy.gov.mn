# -*- coding: utf-8 -*-
"""Claude Opus 4.8 vision-ээр толийн хуудсыг бүтэцлэн уншина (Batch API)."""
import base64
import json
import time

MODEL = "claude-opus-4-8"

# Бүтэцлэсэн гаралтын схем: хуудас доторх зүйлсийг уншсан дарааллаар.
SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["items"],
    "properties": {
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["kind"],
                "properties": {
                    "kind": {"type": "string", "enum": ["header", "entry"]},
                    "header": {"type": "string"},   # kind=header үед: АРАЛ, АСГА...
                    "name": {"type": "string"},     # kind=entry: тод кирилл нэр
                    "aimag": {"type": "string"},    # аймаг
                    "sum": {"type": "string"},      # сум
                    "uncertain": {"type": "boolean"},  # бүдэг/эргэлзээтэй мөр
                },
            },
        }
    },
}

SYSTEM = (
    "Чи Монгол газар нутгийн нэрийн зүйлчилсэн толийн скан хуудсыг уншиж байна. "
    "Хуудас 2 баганатай. Баганыг зүүнээс баруун, мөрийг дээрээс доош уншина. "
    "Толгойн ТОМ үсэгт үг (АРАЛ, АРЦ, АСГА, АЦ гэх мэт) нь kind='header'. "
    "Бусад мөр kind='entry': тод бичсэн монгол нэр=name, дараа нь аймаг, сум. "
    "Латин галигийг бүү буцаа — зөвхөн кирилл нэр, аймаг, сумыг буцаа. "
    "Кирилл үсгийг яг хуулж буцаа (ө,ү,й зөв). Бүдэгрсэн/эргэлзээтэй мөрд uncertain=true. "
    "Хүн-уншихуйц текст бус, зөвхөн бүтэцлэсэн өгөгдөл буцаа."
)
USER_TEXT = "Энэ хуудсыг бүтэцлэн унш. Бүх толгой ба мөрийг дарааллаар нь буцаа."


def _content(png_bytes):
    return [
        {"type": "image", "source": {"type": "base64", "media_type": "image/png",
                                     "data": base64.standard_b64encode(png_bytes).decode()}},
        {"type": "text", "text": USER_TEXT},
    ]


def parse_message(message):
    """Batch-ийн амжилттай message-ээс items жагсаалт гаргана."""
    text = next((b.text for b in message.content if b.type == "text"), None)
    if not text:
        return []
    return json.loads(text).get("items", [])


def submit_batch(client, items, max_tokens=8000):
    """items: [(custom_id, png_bytes)] → batch id."""
    from anthropic.types.message_create_params import MessageCreateParamsNonStreaming
    from anthropic.types.messages.batch_create_params import Request

    requests = [
        Request(custom_id=cid, params=MessageCreateParamsNonStreaming(
            model=MODEL,
            max_tokens=max_tokens,
            system=SYSTEM,
            messages=[{"role": "user", "content": _content(png)}],
            output_config={"format": {"type": "json_schema", "schema": SCHEMA}},
        ))
        for cid, png in items
    ]
    return client.messages.batches.create(requests=requests).id


def wait_batch(client, batch_id, poll=30, log=print):
    while True:
        b = client.messages.batches.retrieve(batch_id)
        if b.processing_status == "ended":
            log(f"batch {batch_id}: ended "
                f"(ok={b.request_counts.succeeded} err={b.request_counts.errored})")
            return b
        log(f"batch {batch_id}: {b.processing_status} "
            f"processing={b.request_counts.processing}")
        time.sleep(poll)


def collect_results(client, batch_id):
    """custom_id -> {'items': [...]} эсвэл {'error': '...'}"""
    out = {}
    for r in client.messages.batches.results(batch_id):
        if r.result.type == "succeeded":
            out[r.custom_id] = {"items": parse_message(r.result.message)}
        else:
            out[r.custom_id] = {"error": r.result.type}
    return out
