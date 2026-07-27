# -*- coding: utf-8 -*-
# Байр зүйн объектын каталог (INSPIRE/ISO 19110) — model-ууд apps/map/map_models.py-д
# тодорхойлогдсон. Django энэ app-д бүртгэхийн тулд энд импортлоно. DB router (core.
# db_routers.MapRouter) эдгээрийг `basemap` DB рүү чиглүүлнэ.
from .map_models import *  # noqa: F401,F403
