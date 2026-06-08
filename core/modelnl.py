from django.db import models
from django.contrib.postgres.indexes import GinIndex
from django.contrib.postgres.search import SearchVectorField
from django.utils import timezone

# -------- Intents / Slots --------
class Intent(models.Model):
    code        = models.SlugField(unique=True)
    name        = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    is_active   = models.BooleanField(default=True)
    def __str__(self): return self.code

class SlotType(models.Model):
    code      = models.SlugField(unique=True)
    name      = models.CharField(max_length=200)
    required  = models.BooleanField(default=False)
    data_type = models.CharField(
        max_length=20,
        choices=[("str","str"),("int","int"),("date","date"),("json","json")]
    )
    def __str__(self): return self.code

class IntentSlot(models.Model):
    intent   = models.ForeignKey(Intent, on_delete=models.CASCADE, related_name="intent_slots")
    slot     = models.ForeignKey(SlotType, on_delete=models.CASCADE, related_name="slot_intents")
    required = models.BooleanField(default=False)
    priority = models.PositiveSmallIntegerField(default=5)
    class Meta:
        unique_together = ("intent", "slot")

# -------- Entities / Aliases --------
class EntityType(models.Model):
    code = models.SlugField(unique=True)
    name = models.CharField(max_length=200)
    def __str__(self): return self.code

class Entity(models.Model):
    type        = models.ForeignKey(EntityType, on_delete=models.CASCADE, related_name="entities")
    canonical   = models.CharField(max_length=200, db_index=True)
    meta        = models.JSONField(blank=True, null=True)
    is_active   = models.BooleanField(default=True)
    class Meta:
        unique_together = ("type", "canonical")
        indexes = [models.Index(fields=["canonical"])]
    def __str__(self): return f"{self.type.code}:{self.canonical}"

class EntityAlias(models.Model):
    entity  = models.ForeignKey(Entity, on_delete=models.CASCADE, related_name="aliases")
    text    = models.CharField(max_length=200, db_index=True)
    weight  = models.FloatField(default=1.0)
    class Meta:
        unique_together = ("entity", "text")

# -------- Rules / Gazetteer --------
class RegexRule(models.Model):
    slot      = models.ForeignKey(SlotType, on_delete=models.CASCADE, related_name="regex_rules")
    pattern   = models.CharField(max_length=500)  # raw regex
    flags     = models.CharField(max_length=50, blank=True, null=True)  # e.g. "i"
    priority  = models.PositiveSmallIntegerField(default=5)
    is_active = models.BooleanField(default=True)
    note      = models.CharField(max_length=200, blank=True, null=True)
    class Meta:
        ordering = ("priority", "id",)

class GazetteerLink(models.Model):
    entity_type = models.ForeignKey(EntityType, on_delete=models.CASCADE, related_name="gazetteer_links")
    scope       = models.CharField(max_length=50, default="any")  # "any" | intent.code
    min_score   = models.FloatField(default=0.30)
    priority    = models.PositiveSmallIntegerField(default=5)
    is_active   = models.BooleanField(default=True)

# -------- Training / Templates --------
class TrainingUtterance(models.Model):
    text        = models.TextField()
    intent      = models.ForeignKey(Intent, on_delete=models.SET_NULL, null=True, blank=True)
    slots_json  = models.JSONField(default=dict)
    locale      = models.CharField(max_length=10, default="mn")
    source      = models.CharField(max_length=50, default="manual")
    created_at  = models.DateTimeField(default=timezone.now)
    sv          = SearchVectorField(null=True)
    class Meta:
        indexes = [GinIndex(fields=["sv"])]

class ResponseTemplate(models.Model):
    intent     = models.ForeignKey(Intent, on_delete=models.CASCADE, related_name="responses")
    code       = models.SlugField()
    template   = models.TextField()
    is_active  = models.BooleanField(default=True)
    class Meta:
        unique_together = ("intent", "code")

# -------- Conversations / Logs --------
class Conversation(models.Model):
    user_id     = models.IntegerField(null=True, blank=True)
    started_at  = models.DateTimeField(default=timezone.now)
    meta        = models.JSONField(blank=True, null=True)

class Message(models.Model):
    ROLE_USER = "user"
    ROLE_BOT  = "bot"
    roles = [(ROLE_USER,"user"), (ROLE_BOT,"bot")]
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="messages")
    role         = models.CharField(max_length=10, choices=roles)
    text         = models.TextField()
    created_at   = models.DateTimeField(default=timezone.now)
    meta         = models.JSONField(blank=True, null=True)

