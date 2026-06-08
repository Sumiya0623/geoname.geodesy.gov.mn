# -*- coding: utf-8 -*-
"""Газар зүйн нэрийн өөрчлөх хүсэлтийн А4 маягтыг PDF болгон татах view."""

from django.http import HttpResponse, Http404

from core.models import RequestName

from .pdf import build_request_pdf


def request_form(request, pk):
    """RequestName(pk)-ийн өргөдлийн маягтыг А4 PDF болгон буцаана."""
    try:
        req = (
            RequestName.objects
            .select_related("name", "name__type", "user")
            .prefetch_related(
                "option",
                "namecontacts",
                "name__orders",
                "name__unit",
                "name__nomek",
            )
            .get(pk=pk)
        )
    except RequestName.DoesNotExist:
        raise Http404("Хүсэлт олдсонгүй")

    pdf_bytes = build_request_pdf(req)
    resp = HttpResponse(pdf_bytes, content_type="application/pdf")
    resp["Content-Disposition"] = f'attachment; filename="request_{pk}.pdf"'
    return resp
